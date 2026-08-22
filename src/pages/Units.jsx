import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import FloatTilt from '../components/FloatTilt.jsx';
import { excerptText, membersOf } from '../lib/access.js';
import { fetchUnitBoard } from '../lib/services.js';
import { PageHeader, UnitLogo, glassClass } from '../lib/ui.jsx';

export default function Units() {
  const { supabase, t, formatPersonnelName } = useCommand();
  const [board, setBoard] = useState({ units: [], personnel: [] });

  const load = useCallback(async () => {
    setBoard(await fetchUnitBoard(supabase));
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function personName(userId) {
    const person = board.personnel.find((row) => row.id === userId);
    return person ? formatPersonnelName(person) || t('units.unnamed') : t('units.unassigned');
  }

  return (
    <section className="units-scene mx-auto max-w-6xl">
      <PageHeader kicker={t('units.kicker')} title={t('units.title')} lead={t('units.lead')} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(board.units || []).map((unit) => {
          const members = membersOf(board, unit.id);
          return (
            <FloatTilt key={unit.id} intensity={11} className="h-full">
              <Link to={`/units/${encodeURIComponent(unit.code)}`} className={`${glassClass} unit-card-3d block h-full p-5 no-underline`}>
                <UnitLogo unit={unit} className="h-16 w-16" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{unit.code}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{unit.name}</h2>
                  <p className="mt-2 text-sm text-slate-500">{excerptText(unit.content, 90) || t('units.noContent')}</p>
                  <p className="mt-3 text-sm text-slate-500">
                    {t('units.capacity')}: {members.length}/{unit.max_capacity}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t('units.head')}: {unit.head_user_id ? personName(unit.head_user_id) : t('units.unassigned')}
                  </p>
              </Link>
            </FloatTilt>
          );
        })}
      </div>
    </section>
  );
}
