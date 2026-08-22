import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DossierOverlay, originFromEvent } from '../components/AnimatedCard.jsx';
import DossierEditor from '../components/DossierEditor.jsx';
import DossierHandoffBridge from '../components/DossierHandoffBridge.jsx';
import ImageCropper from '../components/ImageCropper.jsx';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin, visiblePersonnel } from '../lib/access.js';
import { fetchPersonnelRoster, fetchRankStructure, fetchUnitBoard, updatePersonnelRecord, uploadPersonnelImage } from '../lib/services.js';
import { buildHierarchyTree } from '../../js/hierarchy.js';
import { PageHeader, btnGhost } from '../lib/ui.jsx';
import { startDossierExportFromJsx } from '../../js/ui-mode.js';

const COLLAPSE_FROM_SORT = 8;

function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function branchKey(branch) {
  if (branch === 'Marines') return 'marines';
  if (branch === 'Unassigned') return 'unassigned';
  return 'navy';
}

function nodeId(node) {
  return `${node.type}-${node.branch || 'command'}-${node.sortOrder ?? 'top'}-${node.rank || 'staff'}`;
}

function PersonCard({ person, formatPersonnelName, t, onOpen }) {
  const name = formatPersonnelName(person) || t('profiles.empty');
  const tone = branchKey(person.military_branch);
  const role = person.organization_role || person.wlc_agency || person._nato || '';
  return (
    <button className={`org-card org-card-${tone}`} type="button" onClick={(event) => onOpen(person, event)}>
      <span className="org-card-glare" aria-hidden="true" />
      <span className="org-avatar-wrap">
        {person.avatar_url ? (
          <img className="org-avatar" src={person.avatar_url} alt="" />
        ) : (
          <div className="org-avatar-fallback" aria-hidden="true">
            {initialsFromName(name) || 'WLR'}
          </div>
        )}
      </span>
      <span className="org-card-copy">
        <strong>{name}</strong>
        <span className="org-card-rank">{person.military_rank || '—'}</span>
        {role ? <span className="org-card-role">{role}</span> : null}
      </span>
      {person._nato ? <span className="org-card-nato">{person._nato}</span> : null}
    </button>
  );
}

function PeopleRow({ people, ...rest }) {
  if (!people?.length) {
    return null;
  }
  return (
    <div className="org-people">
      {people.map((person) => (
        <PersonCard key={person.id} person={person} {...rest} />
      ))}
    </div>
  );
}

function RankNode({ node, collapsed, onToggle, ...rest }) {
  const id = nodeId(node);
  const nested = collapsed.has(id);
  const hasKids = Boolean(node.children?.length);
  return (
    <div className="org-rank">
      <div className="org-stem" aria-hidden="true" />
      <div className="org-rank-head">
        <p className="org-rank-title">
          {node.rank}
          {node.natoGrade ? ` · ${node.natoGrade}` : ''}
        </p>
        {hasKids ? (
          <button type="button" className={`${btnGhost} !min-h-8 !min-w-8 !px-0`} onClick={() => onToggle(id)}>
            {nested ? '+' : '−'}
          </button>
        ) : null}
      </div>
      <PeopleRow people={node.people} {...rest} />
      {hasKids && !nested ? (
        <div className="org-children">
          {node.children.map((child, index) => (
            <RankNode key={`${child.rank}-${index}`} node={child} collapsed={collapsed} onToggle={onToggle} {...rest} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function OrgChart() {
  const { supabase, t, lang, formatPersonnelName, activePersonnel, isAdmin: adminFlag } = useCommand();
  const toast = useToast();
  const viewportRef = useRef(null);
  const [roster, setRoster] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [units, setUnits] = useState([]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [crop, setCrop] = useState(null);
  const dragging = useRef(null);
  const admin = adminFlag || isAdmin(activePersonnel);

  const load = useCallback(async () => {
    const [people, rankRows, board] = await Promise.all([
      fetchPersonnelRoster(supabase),
      fetchRankStructure(supabase).catch(() => []),
      fetchUnitBoard(supabase).catch(() => ({ units: [] }))
    ]);
    setRoster(visiblePersonnel(people, activePersonnel));
    setRanks(rankRows);
    setUnits(board.units || []);
  }, [activePersonnel, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => buildHierarchyTree(roster, ranks), [ranks, roster]);

  function onPointerDown(event) {
    if (event.target.closest('button')) {
      return;
    }
    dragging.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging.current) {
      return;
    }
    setPan({
      x: dragging.current.panX + (event.clientX - dragging.current.x),
      y: dragging.current.panY + (event.clientY - dragging.current.y)
    });
  }

  function onPointerUp() {
    dragging.current = null;
  }

  function toggleNode(id) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function saveDossier(payload) {
    if (!editing) {
      return;
    }
    try {
      await updatePersonnelRecord(supabase, editing.id, payload);
      setEditing(null);
      toast.success(t('common.save'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  const branchLabel = (branch) => {
    if (branch === 'Marines') return t('org.marines');
    if (branch === 'Unassigned') return t('org.unassigned');
    return t('org.navy');
  };

  const cardProps = {
    formatPersonnelName,
    t,
    onOpen: (person, event) => setSelected({ row: person, origin: originFromEvent(event) })
  };

  return (
    <section className="mx-auto max-w-7xl">
      <DossierHandoffBridge roster={roster} onOpen={(row) => setSelected({ row, origin: null })} />
      <PageHeader kicker={t('org.kicker')} title={t('org.title')} lead={t('org.lead')} />
      <p className="mb-4 text-sm text-stone-700 dark:text-slate-300">{t('org.hint')}</p>
      {roster.length ? (
        <>
          <div
            ref={viewportRef}
            className="org-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="org-canvas"
              style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
            >
              <div className="org-tree">
                <section className="org-command">
                  <h2 className="org-branch-title">{t('org.command')}</h2>
                  <PeopleRow people={tree.people} {...cardProps} />
                </section>
                {tree.children?.length ? (
                  <>
                    <div className="org-stem" aria-hidden="true" />
                    <div className="org-fork" aria-hidden="true" />
                    <div className={`org-branches org-branches-${tree.children.length}`}>
                      {tree.children.map((branch) => (
                        <section key={branch.branch} className={`org-branch org-branch-${branchKey(branch.branch)}`}>
                          <h2 className="org-branch-title">{branchLabel(branch.branch)}</h2>
                          {(branch.children || []).map((child, index) => (
                            <RankNode
                              key={`${branch.branch}-${index}`}
                              node={child}
                              collapsed={collapsed}
                              onToggle={toggleNode}
                              {...cardProps}
                            />
                          ))}
                        </section>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => setScale((value) => Math.max(0.45, value - 0.1))}>
              −
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              {t('org.reset')}
            </button>
            <button type="button" className={btnGhost} onClick={() => setScale((value) => Math.min(1.8, value + 0.1))}>
              +
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() =>
                setCollapsed(
                  new Set(
                    (ranks || [])
                      .filter((row) => Number(row.sort_order) >= COLLAPSE_FROM_SORT)
                      .map((row) => `rank-${row.branch || 'command'}-${row.sort_order}-staff`)
                  )
                )
              }
            >
              {t('org.collapse')}
            </button>
            <button type="button" className={btnGhost} onClick={() => setCollapsed(new Set())}>
              {t('org.expand')}
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-stone-700 dark:text-slate-300">{t('org.empty')}</p>
      )}
      <DossierOverlay
        record={selected?.row}
        origin={selected?.origin}
        lang={lang}
        t={t}
        units={units}
        ranks={ranks}
        canEdit={admin}
        onClose={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected?.row);
          setSelected(null);
        }}
        onExport={(row) => {
          toast.success(t('dir.handoff'));
          startDossierExportFromJsx({ id: row.id });
        }}
      />
      {editing ? (
        <DossierEditor
          record={editing}
          t={t}
          onCancel={() => setEditing(null)}
          onSave={saveDossier}
          onPickImage={(event, field) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              setCrop({ file, field, aspectId: field === 'cover_url' ? '16:9' : '1:1' });
            }
          }}
        />
      ) : null}
      {crop && editing ? (
        <ImageCropper
          file={crop.file}
          aspectId={crop.aspectId}
          title={t('img.crop')}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setCrop(null)}
          onConfirm={async (file) => {
            try {
              const updated = await uploadPersonnelImage(supabase, editing.id, file, crop.field);
              setEditing((current) => ({ ...current, ...updated }));
              setCrop(null);
            } catch (error) {
              toast.alert(error.message);
            }
          }}
        />
      ) : null}
    </section>
  );
}
