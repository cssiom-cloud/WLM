import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import CapacityGlass from '../components/CapacityGlass.jsx';
import AnnouncementRoster from '../components/AnnouncementRoster.jsx';
import { isAdmin, visiblePersonnel } from '../lib/access.js';
import { isAnnouncementFull } from '../../js/announce-meta.js';
import { closeAnnouncement, deleteAnnouncement, fetchAnnouncementBoard, joinAnnouncement, leaveAnnouncement } from '../lib/services.js';
import { BackLink, PageHeader, StatusBadge, btnDanger, btnGhost, btnPrimary, glassClass } from '../lib/ui.jsx';

export default function AnnouncementDetail() {
  const { id } = useParams();
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [missing, setMissing] = useState(false);
  const admin = isAdmin(activePersonnel);

  const load = useCallback(async () => {
    const board = await fetchAnnouncementBoard(supabase, activePersonnel?.id);
    const found = board.find((row) => row.id === id) || null;
    setItem(found);
    setMissing(!found);
  }, [activePersonnel?.id, id, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  if (missing) {
    return (
      <section className="mx-auto max-w-3xl">
        <BackLink to="/announcements">{t('ann.back')}</BackLink>
        <p className="mt-4 text-sm text-slate-500">{t('ann.empty')}</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="mx-auto max-w-3xl">
        <p className="text-sm text-slate-500">{t('ann.kicker')}</p>
      </section>
    );
  }

  const closed = Boolean(item.ended_at);
  const full = isAnnouncementFull(item);
  const participants = visiblePersonnel(item.participants || [], activePersonnel);
  const canSeeRoster = item.show_participants !== false || admin;

  return (
    <section className="mx-auto max-w-3xl">
      <BackLink to="/announcements">{t('ann.back')}</BackLink>
      <article className={`${glassClass} mt-6 overflow-hidden`}>
        {item.image_url ? (
          <img src={item.image_url} alt="" className="max-h-[28rem] w-full object-contain object-center bg-stone-200 dark:bg-slate-800" />
        ) : null}
        <div className="p-6 sm:p-8">
          <PageHeader
            kicker={t('ann.kicker')}
            title={item.title}
            actions={
              <StatusBadge tone={closed ? 'closed' : full ? 'full' : 'open'}>
                {closed ? t('ann.closed') : full ? t('ann.full') : t('ann.open')}
              </StatusBadge>
            }
          />
          {item.award_honor_enabled ? (
            <p className="mt-2 text-sm text-slate-500">{item.ended_at ? t('ann.honorAwarded') : t('ann.honorPending')}</p>
          ) : null}
          <div className="mt-6 whitespace-pre-wrap text-base leading-7 text-stone-800 dark:text-slate-200">{item.content}</div>
          <div className="mt-6">
            <CapacityGlass item={item} t={t} />
          </div>
          {canSeeRoster ? (
            <AnnouncementRoster people={participants} t={t} />
          ) : (
            <p className="mt-6 text-sm text-slate-500">{t('ann.hiddenSignups')}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
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
            {admin ? (
              <Link to={`/announcements/create?id=${item.id}`} className={`${btnGhost} no-underline`}>
                {t('ann.edit')}
              </Link>
            ) : null}
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
              <button
                type="button"
                className={btnDanger}
                onClick={async () => {
                  if (!window.confirm(t('ann.confirmDelete'))) {
                    return;
                  }
                  await deleteAnnouncement(supabase, item.id);
                  toast.success(t('ann.deleted'));
                  navigate('/announcements', { replace: true });
                }}
              >
                {t('ann.delete')}
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
