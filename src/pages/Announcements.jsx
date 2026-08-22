import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin } from '../lib/access.js';
import { closeAnnouncement, deleteAnnouncement, fetchAnnouncementBoard, joinAnnouncement, leaveAnnouncement } from '../lib/services.js';
import { PageHeader, StatusBadge, btnDanger, btnGhost, btnPrimary, glassClass } from '../lib/ui.jsx';

export default function Announcements() {
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const [board, setBoard] = useState([]);
  const admin = isAdmin(activePersonnel);

  const load = useCallback(async () => {
    setBoard(await fetchAnnouncementBoard(supabase, activePersonnel?.id));
  }, [activePersonnel, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        kicker={t('ann.kicker')}
        title={t('ann.title')}
        actions={
          admin ? (
            <Link to="/announcements/create" className={`${btnPrimary} no-underline`}>
              {t('ann.create')}
            </Link>
          ) : null
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {board.length ? (
          board.map((item) => {
            const closed = Boolean(item.ended_at);
            const full = item.signed_count >= item.max_capacity;
            return (
              <article key={item.id} className={`${glassClass} flex flex-col overflow-hidden`}>
                {item.image_url ? (
                  <Link to={`/announcements/${item.id}`} className="block">
                    <img src={item.image_url} alt="" className="h-44 w-full object-cover" />
                  </Link>
                ) : (
                  <Link to={`/announcements/${item.id}`} className="grid h-36 place-items-center bg-stone-200 text-3xl font-semibold text-stone-700 no-underline dark:bg-slate-800 dark:text-slate-200">
                    {String(item.title || 'A')[0]}
                  </Link>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-stone-900 dark:text-slate-50">
                      <Link to={`/announcements/${item.id}`} className="text-inherit no-underline hover:underline">
                        {item.title}
                      </Link>
                    </h2>
                    <StatusBadge tone={closed ? 'closed' : full ? 'full' : 'open'}>{closed ? t('ann.closed') : full ? t('ann.full') : t('ann.open')}</StatusBadge>
                    {item.award_honor_enabled ? (
                      <StatusBadge>{item.ended_at ? t('ann.honorAwarded') : t('ann.honorPending')}</StatusBadge>
                    ) : null}
                  </div>
                  <p className="line-clamp-4 flex-1 whitespace-pre-wrap text-sm leading-6 text-stone-700 dark:text-slate-300">{item.content}</p>
                  <p className="mt-3 text-sm text-stone-600 dark:text-slate-400">
                    {t('ann.signedUp')}: {item.signed_count} · {t('ann.max')}: {item.max_capacity}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Link to={`/announcements/${item.id}`} className={`${btnGhost} no-underline`}>
                      {t('ann.readFull')}
                    </Link>
                    {closed ? (
                      <button type="button" className={btnGhost} disabled>
                        {t('ann.closed')}
                      </button>
                    ) : !activePersonnel ? (
                      <Link to="/login" className={`${btnGhost} no-underline`}>
                        {t('ann.signin')}
                      </Link>
                    ) : item.is_signed ? (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          await leaveAnnouncement(supabase, item.id, activePersonnel.id);
                          toast.success(t('ann.withdrawn'));
                          await load();
                        }}
                      >
                        {t('ann.withdraw')}
                      </button>
                    ) : full ? (
                      <button type="button" className={btnGhost} disabled>
                        {t('ann.full')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={async () => {
                          await joinAnnouncement(supabase, item.id, activePersonnel.id);
                          toast.success(t('ann.joined'));
                          await load();
                        }}
                      >
                        {t('ann.join')}
                      </button>
                    )}
                    {admin && !closed ? (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          if (!window.confirm(t('ann.confirmClose'))) {
                            return;
                          }
                          const result = await closeAnnouncement(supabase, item.id);
                          toast.success(result?.honor_awarded ? t('ann.closedWithHonor') : t('ann.closedOk'));
                          await load();
                        }}
                      >
                        {t('ann.close')}
                      </button>
                    ) : null}
                    {admin ? (
                      <Link to={`/announcements/create?id=${item.id}`} className={`${btnGhost} no-underline`}>
                        {t('ann.edit')}
                      </Link>
                    ) : null}
                    {admin ? (
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={async () => {
                          if (!window.confirm(t('ann.confirmDelete'))) {
                            return;
                          }
                          await deleteAnnouncement(supabase, item.id);
                          toast.success(t('ann.deleted'));
                          await load();
                        }}
                      >
                        {t('ann.delete')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{t('ann.empty')}</p>
        )}
      </div>
    </section>
  );
}
