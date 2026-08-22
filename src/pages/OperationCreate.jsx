import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { canPlanOperations } from '../lib/access.js';
import { fetchOperationBoard, fetchUnitBoard, saveOperation } from '../lib/services.js';
import { PageHeader, SignatureBlock, UnitLogo, btnGhost, btnPrimary, fieldClass, glassClass, CommandSelect } from '../lib/ui.jsx';
import { TacticalMapEditor } from '../components/TacticalMap.jsx';

export default function OperationCreate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const editing = Boolean(id);
  const [units, setUnits] = useState([]);
  const [title, setTitle] = useState('');
  const [briefing, setBriefing] = useState('');
  const [status, setStatus] = useState('planning');
  const [officer, setOfficer] = useState('');
  const [sides, setSides] = useState([]);
  const [mapUrl, setMapUrl] = useState('');
  const [mapFile, setMapFile] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [assignSide, setAssignSide] = useState('allies');
  const [assignUnit, setAssignUnit] = useState('');
  const [allowed, setAllowed] = useState(true);
  const [mapReady, setMapReady] = useState(!id);

  const load = useCallback(async () => {
    const [opsBoard, unitBoard] = await Promise.all([fetchOperationBoard(supabase), fetchUnitBoard(supabase)]);
    setUnits(unitBoard.units || []);
    if (!canPlanOperations(activePersonnel, unitBoard.units || [])) {
      setAllowed(false);
      return;
    }
    if (id) {
      const found = (opsBoard.operations || []).find((row) => row.id === id);
      if (!found) {
        toast.alert(t('ops.missing'));
        return;
      }
      setTitle(found.title || '');
      setBriefing(found.briefing || '');
      setStatus(found.status || 'planning');
      setOfficer(found.commanding_officer || '');
      setMapUrl(found.map_url || '');
      setDrawings(Array.isArray(found.drawings) ? found.drawings : []);
      setSides((opsBoard.sides || []).filter((row) => row.operation_id === id).map((row) => ({ unit_id: row.unit_id, side: row.side })));
    }
    setMapReady(true);
  }, [activePersonnel, id, supabase, t, toast]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  const assignedIds = new Set(sides.map((row) => row.unit_id));
  const remaining = units.filter((unit) => !assignedIds.has(unit.id));
  const alliesLive = units.filter((unit) => sides.some((row) => row.unit_id === unit.id && row.side === 'allies'));
  const objectivesLive = units.filter((unit) => sides.some((row) => row.unit_id === unit.id && row.side === 'objectives'));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim()) {
      toast.alert(t('ops.titleRequired'));
      return;
    }
    try {
      const savedId = await saveOperation(supabase, {
        id: id || undefined,
        title: title.trim(),
        briefing,
        status,
        drawings,
        sides,
        mapFile,
        mapUrl,
        createdBy: activePersonnel.id,
        commandingOfficer: officer
      });
      toast.success(editing ? t('ops.updated') : t('ops.saved'));
      navigate(`/operations/${savedId}`);
    } catch (error) {
      toast.alert(error.message);
    }
  }

  if (!allowed) {
    return <p className="text-sm text-slate-500">{t('ops.create.lead')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t('ops.kicker')}
        title={editing ? t('ops.create.editTitle') : t('ops.create.title')}
        lead={t('ops.create.lead')}
        actions={
          <Link to="/operations" className={`${btnGhost} no-underline`}>
            {t('ops.back')}
          </Link>
        }
      />
      <form className={`${glassClass} grid gap-4 p-6`} onSubmit={handleSubmit}>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('ops.titleLabel')}
          <input className={fieldClass} required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('ops.briefingLabel')}
          <textarea className={`${fieldClass} min-h-40 py-3`} rows={8} maxLength={8000} value={briefing} onChange={(event) => setBriefing(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('ops.statusLabel')}
          <CommandSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: 'planning', label: t('ops.status.planning') },
              { value: 'active', label: t('ops.status.active') },
              { value: 'completed', label: t('ops.status.completed') }
            ]}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 dark:text-slate-300">
          {t('ops.auth.officer')}
          <input className={fieldClass} maxLength={120} autoComplete="name" value={officer} onChange={(event) => setOfficer(event.target.value)} />
        </label>
        <p className="text-sm text-stone-700 dark:text-slate-300">{t('ops.auth.hint')}</p>
        <SignatureBlock t={t} name={officer} status={status} />

        <div>
          <h2 className="text-lg font-semibold">{t('ops.factions')}</h2>
          <p className="text-sm text-slate-500">{t('ops.factionsHint')}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[
              { key: 'allies', rows: alliesLive },
              { key: 'objectives', rows: objectivesLive }
            ].map((group) => (
              <section key={group.key} className="rounded-2xl border border-slate-200/80 p-3 dark:border-white/10">
                <h3 className="mb-2 text-sm font-semibold">{t(`ops.${group.key}`)}</h3>
                {group.rows.length ? (
                  group.rows.map((unit) => (
                    <div key={unit.id} className="mb-2 flex items-center gap-2">
                      <UnitLogo unit={unit} className="h-8 w-8" />
                      <span className="flex-1 text-sm">{unit.name}</span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600"
                        onClick={() => setSides((current) => current.filter((row) => row.unit_id !== unit.id))}
                      >
                        {t('ops.assign.remove')}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t('ops.noUnitsAssigned')}</p>
                )}
              </section>
            ))}
          </div>
          {remaining.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <CommandSelect
                className="min-w-[14rem] flex-1"
                value={assignUnit}
                onChange={setAssignUnit}
                placeholder={t('ops.assign.choose')}
                options={[
                  { value: '', label: t('ops.assign.choose') },
                  ...remaining.map((unit) => ({
                    value: unit.id,
                    label: unit.code ? `(${unit.code}) ${unit.name}` : unit.name
                  }))
                ]}
              />
              <CommandSelect
                className="min-w-[10rem]"
                value={assignSide}
                onChange={setAssignSide}
                options={[
                  { value: 'allies', label: t('ops.allies') },
                  { value: 'objectives', label: t('ops.objectives') }
                ]}
              />
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  if (!assignUnit) {
                    return;
                  }
                  setSides((current) => [...current, { unit_id: assignUnit, side: assignSide }]);
                  setAssignUnit('');
                }}
              >
                {t('ops.assign.add')}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t('ops.noUnitsLeft')}</p>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">{t('ops.map')}</h2>
          <p className="text-sm text-slate-500">{t('ops.mapHint')}</p>
          <div className="mt-3">
            {mapReady ? (
              <TacticalMapEditor
                key={id || 'new'}
                mapUrl={mapUrl}
                drawings={drawings}
                onChange={setDrawings}
                onMapFile={(file, url) => {
                  setMapFile(file);
                  setMapUrl(url);
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">{t('notice.loading')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary}>
            {editing ? t('ops.update') : t('ops.publish')}
          </button>
          <Link to="/operations" className={`${btnGhost} no-underline`}>
            {t('ops.back')}
          </Link>
        </div>
      </form>
    </section>
  );
}
