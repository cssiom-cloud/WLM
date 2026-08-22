import { useCallback, useEffect, useMemo, useState } from 'react';
import AnimatedCard, { DossierOverlay, originFromEvent } from '../components/AnimatedCard.jsx';
import DossierEditor from '../components/DossierEditor.jsx';
import DossierHandoffBridge from '../components/DossierHandoffBridge.jsx';
import ImageCropper from '../components/ImageCropper.jsx';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin, visiblePersonnel } from '../lib/access.js';
import { fetchPersonnelRoster, fetchSettingsMap, fetchUnitBoard, updatePersonnelRecord, uploadPersonnelImage } from '../lib/services.js';
import { PageHeader, fieldClass } from '../lib/ui.jsx';
import { startDossierExportFromJsx } from '../../js/ui-mode.js';

function visibleName(row, empty) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || empty;
}

export default function Directory() {
  const { supabase, lang, t, formatPersonnelName, activePersonnel, session } = useCommand();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState([]);
  const [units, setUnits] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [settingsMap, setSettingsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [crop, setCrop] = useState(null);
  const admin = isAdmin(activePersonnel);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [people, board, settings] = await Promise.all([
        fetchPersonnelRoster(supabase),
        fetchUnitBoard(supabase).catch(() => ({ units: [], ranks: [] })),
        fetchSettingsMap(supabase).catch(() => ({}))
      ]);
      setRoster(visiblePersonnel(people, activePersonnel));
      setUnits(board.units || []);
      setRanks(board.ranks || []);
      setSettingsMap(settings);
    } finally {
      setLoading(false);
    }
  }, [activePersonnel, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return roster;
    }
    return roster.filter((row) =>
      [visibleName(row), row.military_rank, row.organization_role, row.military_branch, row.wlc_agency]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [query, roster]);

  async function saveDossier(payload) {
    try {
      await updatePersonnelRecord(supabase, editing.id, payload);
      toast.success(t('common.save'));
      setEditing(null);
      setSelected(null);
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function confirmCrop(file) {
    if (!editing || !crop) {
      return;
    }
    try {
      const updated = await uploadPersonnelImage(supabase, editing.id, file, crop.field, session?.user?.id);
      setEditing((current) => (current ? { ...current, ...updated } : current));
      setCrop(null);
      toast.success(t('img.saved'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  function exportDossier(row) {
    if (!row?.id) {
      return;
    }
    toast.success(t('dir.handoff'));
    startDossierExportFromJsx({ id: row.id });
  }

  return (
    <section className="mx-auto max-w-6xl">
      <DossierHandoffBridge roster={roster} onOpen={(row) => setSelected({ row, origin: null })} />
      <PageHeader
        kicker={t('dir.kicker')}
        title={t('dir.title')}
        actions={
          <input type="search" className={`${fieldClass} sm:w-72`} placeholder={t('dir.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
        }
      />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ perspective: 1200 }}>
            {filtered.map((row) => (
              <AnimatedCard
                key={row.id}
                id={row.id}
                name={formatPersonnelName(row) || visibleName(row, t('profiles.empty'))}
                rank={row.military_rank}
                role={row.organization_role || row.military_branch}
                avatarUrl={row.avatar_url}
                actionLabel={t('dir.view')}
                onClick={(event) => setSelected({ row, origin: originFromEvent(event) })}
              />
            ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t('dir.empty')}</p>
      )}
      <DossierOverlay
        record={selected?.row}
        origin={selected?.origin}
        lang={lang}
        t={t}
        units={units}
        ranks={ranks}
        bioPublic={settingsMap[selected?.row?.id]?.bio_public !== false}
        canEdit={admin}
        onClose={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected?.row);
          setSelected(null);
        }}
        onExport={exportDossier}
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
      {crop ? (
        <ImageCropper
          file={crop.file}
          aspectId={crop.aspectId}
          title={t('img.crop')}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setCrop(null)}
          onConfirm={confirmCrop}
        />
      ) : null}
      <p className="mt-4 text-xs text-slate-400">
        {roster.length} {t('dir.loaded')}
      </p>
    </section>
  );
}
