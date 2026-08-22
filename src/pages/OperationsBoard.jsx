import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { canDeleteOperation, canEditOperation, canPlanOperations, excerptText, unitsForSide } from '../lib/access.js';
import { deleteOperation, fetchOperationBoard, fetchUnitBoard } from '../lib/services.js';
import { StatusBadge, UnitLogo, btnGhost, btnPrimary, glassClass } from '../lib/ui.jsx';

function FactionStack({ units, title, empty }) {
  return (
    <section>
      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      {units.length ? (
        <ul className="mt-2 grid gap-2">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-center gap-2">
              <UnitLogo unit={unit} className="h-8 w-8" />
              <span className="text-sm font-semibold">{unit.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

export default function OperationsBoard() {
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const [operations, setOperations] = useState([]);
  const [sides, setSides] = useState([]);
  const [units, setUnits] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const [opsBoard, unitBoard] = await Promise.all([
        fetchOperationBoard(supabase),
        fetchUnitBoard(supabase).catch(() => ({ units: [] }))
      ]);
      setOperations(opsBoard.operations || []);
      setSides(opsBoard.sides || []);
      setUnits(unitBoard.units || []);
    } catch (error) {
      toast.alert(error.message);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const filteredOperations = useMemo(() => {
    if (statusFilter === 'all') {
      return operations;
    }
    return operations.filter((row) => String(row.status || '').toLowerCase() === statusFilter);
  }, [operations, statusFilter]);

  const canPlan = canPlanOperations(activePersonnel, units);

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('ops.kicker')}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('ops.title')}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{t('ops.lead')}</p>
        </div>
        {canPlan ? (
          <Link to="/operations/create" className={`${btnPrimary} no-underline`}>
            {t('ops.create')}
          </Link>
        ) : null}
      </header>

      <div className={`${glassClass} mb-8 flex flex-wrap items-center gap-3 p-4`}>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('ops.statusLabel')}</p>
        {['all', 'planning', 'active', 'completed'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`min-h-9 rounded-xl px-3 text-xs font-semibold uppercase ${
              statusFilter === status ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-slate-200 dark:border-white/10'
            }`}
          >
            {status === 'all' ? (document.documentElement.lang === 'th' ? 'ทั้งหมด' : 'All') : t(`ops.status.${status}`)}
          </button>
        ))}
        <button type="button" className={`${btnGhost} ml-auto`} onClick={loadBoard} disabled={loading}>
          {t('notice.loading')}
        </button>
      </div>

      <section id="operation-list" className="grid gap-4 md:grid-cols-2">
        {filteredOperations.length ? (
          filteredOperations.map((item) => {
            const allies = unitsForSide(units, sides, item.id, 'allies');
            const objectives = unitsForSide(units, sides, item.id, 'objectives');
            const canEdit = canEditOperation(activePersonnel, item, units, sides);
            const canDelete = canDeleteOperation(activePersonnel, item);
            return (
              <article key={item.id} className={`${glassClass} p-5`}>
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge tone={item.status || 'planning'}>{t(`ops.status.${item.status || 'planning'}`)}</StatusBadge>
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                </div>
                <p className="text-sm text-slate-500">{excerptText(item.briefing, 140) || t('ops.noBriefing')}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <FactionStack units={allies} title={t('ops.allies')} empty={t('ops.noUnitsAssigned')} />
                  <FactionStack units={objectives} title={t('ops.objectives')} empty={t('ops.noUnitsAssigned')} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/operations/${item.id}`} className={`${btnPrimary} no-underline`}>
                    {t('ops.view')}
                  </Link>
                  {canEdit ? (
                    <Link to={`/operations/${item.id}/edit`} className={`${btnGhost} no-underline`}>
                      {t('ops.edit')}
                    </Link>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={async () => {
                        if (!window.confirm(t('ops.confirmDelete'))) {
                          return;
                        }
                        try {
                          await deleteOperation(supabase, item.id);
                          toast.success(t('ops.deleted'));
                          await loadBoard();
                        } catch (error) {
                          toast.alert(error.message);
                        }
                      }}
                    >
                      {t('ops.delete')}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{t('ops.empty')}</p>
        )}
      </section>
    </section>
  );
}
