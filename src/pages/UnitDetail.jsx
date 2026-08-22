import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { canManageUnit, linkedAnnouncements, membersOf, ownPending, ranksOf } from '../lib/access.js';
import { applyToUnit, fetchUnitBoard } from '../lib/services.js';
import { BackLink, StatusBadge, UnitLogo, btnPrimary, glassClass } from '../lib/ui.jsx';
import FloatTilt from '../components/FloatTilt.jsx';

export default function UnitDetail() {
  const { code } = useParams();
  const { supabase, t, activePersonnel, formatPersonnelName, refresh } = useCommand();
  const toast = useToast();
  const [board, setBoard] = useState({ units: [], ranks: [], personnel: [], applications: [], announcements: [], links: [] });

  const load = useCallback(async () => {
    setBoard(await fetchUnitBoard(supabase));
  }, [supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  const unit = board.units.find((row) => row.code === decodeURIComponent(code || '')) || null;
  if (!unit) {
    return (
      <section>
        <BackLink to="/units">{t('units.back')}</BackLink>
        <p className="mt-4 text-sm text-slate-500">{t('units.notFound')}</p>
      </section>
    );
  }

  const members = membersOf(board, unit.id);
  const ranks = ranksOf(board, unit.id);
  const announcements = linkedAnnouncements(board, unit.id);
  const pending = ownPending(board, activePersonnel);
  const assigned = Boolean(activePersonnel?.unit_id);
  const isMember = activePersonnel?.unit_id === unit.id;
  const full = members.length >= Number(unit.max_capacity || 0);
  const canManage = canManageUnit(activePersonnel, unit);
  const myRank = ranks.find((rank) => rank.id === activePersonnel?.unit_rank_id)?.title || t('units.noUnitRank');

  async function handleApply() {
    try {
      await applyToUnit(supabase, unit.id);
      toast.success(t('units.applied'));
      await load();
      await refresh?.();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="units-scene mx-auto max-w-4xl">
      <BackLink to="/units">{t('units.back')}</BackLink>
      <nav className="mt-4 flex gap-2" aria-label={t('units.tabs')}>
        <span className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-ink)]">{t('units.tabHome')}</span>
        {canManage ? (
          <Link to={`/units/${encodeURIComponent(unit.code)}/manage`} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 no-underline dark:text-slate-300">
            {t('units.tabManage')}
          </Link>
        ) : null}
      </nav>
      <FloatTilt intensity={8} className="mt-4">
      <article className={`${glassClass} unit-card-3d p-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <UnitLogo unit={unit} className="h-20 w-20" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{unit.code}</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{unit.name}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{unit.content || t('units.noContent')}</p>
            <p className="mt-3 text-sm text-slate-500">
              {t('units.capacity')}: {members.length}/{unit.max_capacity}
            </p>
            <p className="text-sm text-slate-500">
              {t('units.head')}: {unit.head_user_id ? formatPersonnelName(board.personnel.find((row) => row.id === unit.head_user_id) || {}) || t('units.unnamed') : t('units.unassigned')}
            </p>
            {isMember ? (
              <p className="mt-2 text-sm">
                {t('units.yourRank')}: {myRank}
              </p>
            ) : null}
            <div className="mt-4">
              {isMember ? (
                <StatusBadge tone="open">{t('units.member')}</StatusBadge>
              ) : pending ? (
                pending.unit_id === unit.id ? <StatusBadge>{t('units.pending')}</StatusBadge> : <p className="text-sm text-slate-500">{t('units.waitOther')}</p>
              ) : assigned ? (
                <p className="text-sm text-slate-500">{t('units.alreadyAssigned')}</p>
              ) : full ? (
                <StatusBadge tone="full">{t('units.full')}</StatusBadge>
              ) : (
                <button type="button" className={btnPrimary} onClick={handleApply}>
                  {t('units.apply')}
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t('units.members')}</h2>
          {members.length ? (
            <ul className="grid gap-2">
              <li className="grid grid-cols-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span>{t('units.memberName')}</span>
                <span>{t('units.serviceRank')}</span>
                <span>{t('units.yourRank')}</span>
              </li>
              {members
                .slice()
                .sort((a, b) => (a.id === unit.head_user_id ? 0 : 1) - (b.id === unit.head_user_id ? 0 : 1))
                .map((member) => (
                  <li key={member.id} className="grid grid-cols-3 rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-white/5">
                    <span>
                      {formatPersonnelName(member) || t('units.unnamed')}
                      {member.id === unit.head_user_id ? <span className="ml-2 text-xs text-[var(--accent)]">{t('units.head')}</span> : null}
                    </span>
                    <span>{member.military_rank || '—'}</span>
                    <span>{ranks.find((rank) => rank.id === member.unit_rank_id)?.title || t('units.noUnitRank')}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t('units.noMembers')}</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t('units.linkedAnnouncements')}</h2>
          {announcements.length ? (
            <ul className="grid gap-2">
              {announcements.map((item) => (
                <li key={item.id} className="rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-white/5">
                  <Link to={`/announcements/${item.id}`} className="font-medium text-slate-800 no-underline hover:underline dark:text-slate-100">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t('units.noAnnouncements')}</p>
          )}
        </section>
      </article>
      </FloatTilt>
    </section>
  );
}
