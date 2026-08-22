import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { canEditOperation, unitsForSide } from '../lib/access.js';
import { SITE_LOGO } from '../lib/brand.js';
import { fetchOperationBoard, fetchUnitBoard, saveOperationAar } from '../lib/services.js';
import { SignatureBlock, StatusBadge, UnitLogo, btnGhost, btnPrimary, fieldClass } from '../lib/ui.jsx';
import { TacticalMapViewer } from '../components/TacticalMap.jsx';
import { startOpsExportFromJsx } from '../../js/ui-mode.js';

function filedDate(iso, lang) {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function OperationDetail() {
  const paperRef = useRef(null);
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supabase, t, lang, setLang, activePersonnel } = useCommand();
  const toast = useToast();
  const [operation, setOperation] = useState(null);
  const [units, setUnits] = useState([]);
  const [sides, setSides] = useState([]);
  const [aars, setAars] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [missing, setMissing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportNotice = useRef(false);

  const load = useCallback(async () => {
    const [opsBoard, unitBoard] = await Promise.all([fetchOperationBoard(supabase), fetchUnitBoard(supabase).catch(() => ({ units: [] }))]);
    const found = (opsBoard.operations || []).find((row) => row.id === id);
    if (!found) {
      setMissing(true);
      return;
    }
    setOperation(found);
    setUnits(unitBoard.units || []);
    setSides(opsBoard.sides || []);
    setAars(opsBoard.aars || []);
    const next = {};
    (opsBoard.aars || [])
      .filter((row) => row.operation_id === id)
      .forEach((row) => {
        next[row.unit_id] = row.evaluation || '';
      });
    setEvaluations(next);
  }, [id, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  useEffect(() => {
    if (exportNotice.current) {
      return;
    }
    const exported = searchParams.get('exported');
    const exportError = searchParams.get('exportError');
    if (!exported && !exportError) {
      return;
    }
    exportNotice.current = true;
    if (exportError) {
      toast.alert(t('ops.export.failed'));
    } else {
      toast.success(t('ops.export.ready'));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('exported');
    next.delete('exportError');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);

  if (missing) {
    return <p className="text-sm text-slate-500">{t('ops.missing')}</p>;
  }
  if (!operation) {
    return <p className="text-sm text-slate-500">{t('notice.loading')}</p>;
  }

  const canEdit = canEditOperation(activePersonnel, operation, units, sides);
  const participating = units.filter((unit) => sides.some((row) => row.operation_id === id && row.unit_id === unit.id));
  const allies = unitsForSide(units, sides, id, 'allies');
  const objectives = unitsForSide(units, sides, id, 'objectives');

  async function saveAar(event) {
    event.preventDefault();
    try {
      await Promise.all(
        participating.map((unit) => saveOperationAar(supabase, id, unit.id, evaluations[unit.id] || '', activePersonnel.id))
      );
      toast.success(t('ops.aar.saved'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  function exportDoc(kind) {
    if (exporting) {
      return;
    }
    setExporting(true);
    toast.success(t('ops.export.handoff'));
    startOpsExportFromJsx({ id, format: kind === 'jpg' ? 'jpg' : 'pdf' });
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('ops.kicker')}</p>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            {['en', 'th'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`min-h-10 px-3 text-xs font-semibold uppercase ${lang === code ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : ''}`}
              >
                {code}
              </button>
            ))}
          </div>
          <Link to="/operations" className={`${btnGhost} no-underline`}>
            {t('ops.back')}
          </Link>
          {canEdit ? (
            <Link to={`/operations/${id}/edit`} className={`${btnGhost} no-underline`}>
              {t('ops.edit')}
            </Link>
          ) : null}
          <button type="button" className={btnPrimary} disabled={exporting} onClick={() => exportDoc('pdf')}>
            {exporting ? t('ops.export.generating') : t('ops.export.pdf')}
          </button>
          <button type="button" className={btnGhost} disabled={exporting} onClick={() => exportDoc('jpg')}>
            {exporting ? t('ops.export.generating') : t('ops.export.jpg')}
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <StatusBadge tone={operation.status || 'planning'}>{t(`ops.status.${operation.status || 'planning'}`)}</StatusBadge>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{operation.title}</h1>
      </div>

      <article ref={paperRef} className="ops-doc">
        <div className="ops-doc-brand">
          <img className="ops-doc-logo" src={SITE_LOGO} alt="White Lion Regiment" />
        </div>
        <header className="ops-doc-head">
          <div>
            <p className="ops-doc-command">W.L.R COMMAND</p>
            <p className="ops-doc-banner">{t('ops.doc.title')}</p>
          </div>
          <dl className="ops-doc-meta">
            <div>
              <dt>{t('ops.doc.id')}</dt>
              <dd>{String(operation.id).slice(0, 8)}</dd>
            </div>
            <div>
              <dt>{t('ops.doc.classification')}</dt>
              <dd>{t('ops.doc.restricted')}</dd>
            </div>
            <div>
              <dt>{t('ops.doc.date')}</dt>
              <dd>{filedDate(operation.created_at, lang)}</dd>
            </div>
          </dl>
        </header>

        <section className="ops-doc-section mb-6">
          <h2>{t('ops.doc.overview')}</h2>
          <div className="ops-doc-table-wrap overflow-x-auto">
            <table className="ops-doc-grid">
              <tbody>
                <tr>
                  <th>{t('ops.doc.operationName')}</th>
                  <td>{operation.title}</td>
                  <th>{t('ops.statusLabel')}</th>
                  <td>{t(`ops.status.${operation.status || 'planning'}`)}</td>
                </tr>
                <tr>
                  <th>{t('ops.allies')}</th>
                  <td>{allies.map((unit) => unit.name).join(', ') || t('ops.noUnitsAssigned')}</td>
                  <th>{t('ops.objectives')}</th>
                  <td>{objectives.map((unit) => unit.name).join(', ') || t('ops.noUnitsAssigned')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-doc-section mb-6">
          <h2>{t('ops.doc.briefing')}</h2>
          <div className="ops-doc-box whitespace-pre-wrap text-sm leading-7">
            {operation.briefing || t('ops.noBriefing')}
          </div>
        </section>

        <section className="ops-doc-section ops-doc-map mb-6">
          <h2>{t('ops.doc.map')}</h2>
          <p className="ops-zoom-hint mb-3 text-sm text-slate-500">{t('ops.zoomHint')}</p>
          {operation.map_url ? (
            <TacticalMapViewer mapUrl={operation.map_url} drawings={operation.drawings || []} />
          ) : (
            <p className="text-sm text-slate-500">{t('ops.noMap')}</p>
          )}
        </section>

        <section className="ops-doc-section mb-6">
          <h2>{t('ops.doc.aar')}</h2>
          <div className="export-hide">
          {canEdit ? (
            participating.length ? (
              <form className="grid gap-4" onSubmit={saveAar}>
                <p className="text-sm text-slate-500">{t('ops.aar.leaderHint')}</p>
                {participating.map((unit) => (
                  <section key={unit.id} className="ops-aar-card rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                    <div className="mb-2 flex items-center gap-2">
                      <UnitLogo unit={unit} className="h-10 w-10" />
                      <div>
                        <strong>{unit.name}</strong>
                        <p className="text-xs text-slate-500">{unit.code}</p>
                      </div>
                    </div>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t('ops.aar.unit')}
                      <textarea
                        className={`${fieldClass} min-h-24 py-3`}
                        rows={4}
                        maxLength={2000}
                        value={evaluations[unit.id] || ''}
                        onChange={(event) => setEvaluations((current) => ({ ...current, [unit.id]: event.target.value }))}
                      />
                    </label>
                  </section>
                ))}
                <button type="submit" className={btnPrimary}>
                  {t('ops.aar.save')}
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">{t('ops.aar.noUnits')}</p>
            )
          ) : participating.filter((unit) => evaluations[unit.id]).length ? (
            participating
              .filter((unit) => evaluations[unit.id])
              .map((unit) => (
                <section key={unit.id} className="ops-aar-card mb-3 rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                  <div className="mb-2 flex items-center gap-2">
                    <UnitLogo unit={unit} className="h-10 w-10" />
                    <strong>{unit.name}</strong>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{evaluations[unit.id]}</p>
                </section>
              ))
          ) : (
            <p className="text-sm text-slate-500">{t('ops.aar.empty')}</p>
          )}
          </div>
          <div className="ops-aar-print">
            {participating.filter((unit) => evaluations[unit.id]).length ? (
              participating
                .filter((unit) => evaluations[unit.id])
                .map((unit) => (
                  <section key={`print-${unit.id}`} className="ops-aar-card mb-3">
                    <strong>{unit.name}</strong>
                    <p className="whitespace-pre-wrap text-sm">{evaluations[unit.id]}</p>
                  </section>
                ))
            ) : (
              <p className="text-sm">{t('ops.aar.empty')}</p>
            )}
          </div>
        </section>

        <section className="ops-doc-section ops-auth">
          <h2>{t('ops.doc.auth')}</h2>
          <SignatureBlock t={t} name={operation.commanding_officer} status={operation.status} />
        </section>
        <p className="ops-doc-footer mt-8 text-center text-[0.65rem] tracking-[0.12em]">{t('ops.doc.footer')}</p>
      </article>
    </section>
  );
}
