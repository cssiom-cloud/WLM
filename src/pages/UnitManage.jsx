import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { canManageUnit, linkedAnnouncements, membersOf, pendingOf, ranksOf } from '../lib/access.js';
import {
  deleteUnitRank,
  fetchUnitBoard,
  removeUnitMember,
  reviewUnitApplication,
  saveUnitDetails,
  saveUnitRank,
  setUnitAnnouncements,
  setUnitHead,
  setUnitMemberRank,
  uploadUnitLogo
} from '../lib/services.js';
import { BackLink, FileUploadButton, UnitLogo, btnDanger, btnGhost, btnPrimary, fieldClass, glassClass, CommandCheck, CommandSelect } from '../lib/ui.jsx';
import FloatTilt from '../components/FloatTilt.jsx';

export default function UnitManage() {
  const { code } = useParams();
  const { supabase, t, activePersonnel, formatPersonnelName } = useCommand();
  const toast = useToast();
  const [board, setBoard] = useState({ units: [], ranks: [], personnel: [], applications: [], announcements: [], links: [] });
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoLink, setLogoLink] = useState('');
  const [headId, setHeadId] = useState('');
  const [rankTitle, setRankTitle] = useState('');
  const [linkedIds, setLinkedIds] = useState([]);

  const load = useCallback(async () => {
    const next = await fetchUnitBoard(supabase);
    setBoard(next);
    const unit = next.units.find((row) => row.code === decodeURIComponent(code || ''));
    if (unit) {
      setName(unit.name || '');
      setContent(unit.content || '');
      setCapacity(unit.max_capacity || 1);
      setLogoUrl(unit.logo_url || '');
      setLogoLink(unit.logo_link || '');
      setHeadId(unit.head_user_id || '');
      setLinkedIds(next.links.filter((row) => row.unit_id === unit.id).map((row) => row.announcement_id));
    }
  }, [code, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  const unit = board.units.find((row) => row.code === decodeURIComponent(code || ''));
  if (!unit) {
    return (
      <section>
        <BackLink to="/units">{t('units.back')}</BackLink>
        <p className="mt-4">{t('units.notFound')}</p>
      </section>
    );
  }
  if (!canManageUnit(activePersonnel, unit)) {
    return (
      <section>
        <BackLink to={`/units/${encodeURIComponent(unit.code)}`}>{t('units.back')}</BackLink>
        <p className="mt-4">{t('units.notFound')}</p>
      </section>
    );
  }

  const members = membersOf(board, unit.id);
  const ranks = ranksOf(board, unit.id);
  const apps = pendingOf(board, unit.id);

  async function saveDetails(event) {
    event.preventDefault();
    if (Number(capacity) < 1) {
      toast.alert(t('units.invalidCapacity'));
      return;
    }
    try {
      await saveUnitDetails(supabase, unit.id, {
        name,
        content,
        max_capacity: Number(capacity),
        logo_url: logoUrl || null,
        logo_link: logoLink || null
      });
      await setUnitAnnouncements(supabase, unit.id, linkedIds);
      toast.success(t('units.saved'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="units-scene mx-auto max-w-4xl">
      <BackLink to="/units">{t('units.back')}</BackLink>
      <nav className="mt-4 flex gap-2" aria-label={t('units.tabs')}>
        <Link to={`/units/${encodeURIComponent(unit.code)}`} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 no-underline dark:text-slate-300">
          {t('units.tabHome')}
        </Link>
        <span className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-ink)]">{t('units.tabManage')}</span>
      </nav>

      <FloatTilt intensity={7} className="mt-4">
      <article className={`${glassClass} unit-card-3d grid gap-6 p-6`}>
        <div className="flex items-center gap-4">
          <UnitLogo unit={{ ...unit, logo_url: logoUrl || unit.logo_url }} className="h-16 w-16" />
          <FileUploadButton
            hint={t('units.logoUpload')}
            variant="ghost"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) {
                return;
              }
              try {
                const url = await uploadUnitLogo(supabase, unit.id, file);
                setLogoUrl(url);
                toast.success(t('units.logoSaved'));
              } catch (error) {
                toast.alert(error.message);
              }
            }}
          />
        </div>

        <form className="grid gap-3" onSubmit={saveDetails}>
          <h2 className="text-lg font-semibold">{t('units.details')}</h2>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('units.logoUrl')}
            <input className={fieldClass} value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('units.logoLink')}
            <input className={fieldClass} value={logoLink} onChange={(event) => setLogoLink(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('units.content')}
            <textarea className={`${fieldClass} min-h-32 py-3`} rows={6} value={content} onChange={(event) => setContent(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('units.maxCapacity')}
            <input className={fieldClass} type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('units.appointHead')}
            <CommandSelect
              value={headId}
              onChange={setHeadId}
              placeholder={t('units.unassigned')}
              options={[
                { value: '', label: t('units.unassigned') },
                ...members.map((member) => ({
                  value: member.id,
                  label: formatPersonnelName(member) || t('units.unnamed')
                }))
              ]}
            />
          </label>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              await setUnitHead(supabase, unit.id, headId || null);
              toast.success(t('units.headSaved'));
              await load();
            }}
          >
            {t('units.appointHead')}
          </button>
          <fieldset className="grid gap-1">
            <legend className="mb-2 text-sm font-semibold">{t('units.linkedAnnouncements')}</legend>
            {(board.announcements || []).map((item) => (
              <CommandCheck
                key={item.id}
                className="mb-1 w-full"
                checked={linkedIds.includes(item.id)}
                onChange={(on) =>
                  setLinkedIds((current) => (on ? [...current, item.id] : current.filter((id) => id !== item.id)))
                }
              >
                {item.title}
              </CommandCheck>
            ))}
          </fieldset>
          <button type="submit" className={btnPrimary}>
            {t('common.save')}
          </button>
        </form>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('units.ranks')}</h2>
          {ranks.length ? (
            ranks.map((rank) => (
              <div key={rank.id} className="mb-2 flex items-center gap-2">
                <span className="flex-1 text-sm">{rank.title}</span>
                <button
                  type="button"
                  className={btnDanger}
                  onClick={async () => {
                    if (!window.confirm(t('common.confirmDelete'))) {
                      return;
                    }
                    await deleteUnitRank(supabase, rank.id);
                    toast.success(t('units.rankDeleted'));
                    await load();
                  }}
                >
                  {t('common.delete')}
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">{t('units.noRanks')}</p>
          )}
          <div className="mt-3 flex gap-2">
            <input className={fieldClass} placeholder={t('units.rankPlaceholder')} value={rankTitle} onChange={(event) => setRankTitle(event.target.value)} />
            <button
              type="button"
              className={btnGhost}
              onClick={async () => {
                if (!rankTitle.trim()) {
                  toast.alert(t('units.rankRequired'));
                  return;
                }
                await saveUnitRank(supabase, { unit_id: unit.id, title: rankTitle.trim(), sort_order: ranks.length });
                setRankTitle('');
                toast.success(t('units.rankSaved'));
                await load();
              }}
            >
              {t('common.add')}
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('units.applications')}</h2>
          {apps.length ? (
            apps.map((app) => {
              const person = board.personnel.find((row) => row.id === app.user_id);
              return (
                <div key={app.id} className="mb-2 flex items-center gap-2">
                  <span className="flex-1 text-sm">{formatPersonnelName(person || {}) || t('units.unnamed')}</span>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={async () => {
                      await reviewUnitApplication(supabase, app.id, true);
                      toast.success(t('units.approved'));
                      await load();
                    }}
                  >
                    {t('units.approve')}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={async () => {
                      await reviewUnitApplication(supabase, app.id, false);
                      toast.success(t('units.rejected'));
                      await load();
                    }}
                  >
                    {t('units.reject')}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">{t('units.noApps')}</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('units.members')}</h2>
          {members.length ? (
            members.map((member) => (
              <div key={member.id} className="mb-2 flex flex-wrap items-center gap-2">
                <span className="min-w-40 flex-1 text-sm">{formatPersonnelName(member) || t('units.unnamed')}</span>
                <CommandSelect
                  className="min-w-[12rem]"
                  value={member.unit_rank_id || ''}
                  onChange={async (value) => {
                    await setUnitMemberRank(supabase, member.id, value || null);
                    toast.success(t('units.rankAssigned'));
                    await load();
                  }}
                  placeholder={t('units.noUnitRank')}
                  options={[
                    { value: '', label: t('units.noUnitRank') },
                    ...ranks.map((rank) => ({ value: rank.id, label: rank.title }))
                  ]}
                />
                <button
                  type="button"
                  className={btnDanger}
                  onClick={async () => {
                    if (!window.confirm(t('units.confirmRemove'))) {
                      return;
                    }
                    await removeUnitMember(supabase, member.id);
                    toast.success(t('units.removed'));
                    await load();
                  }}
                >
                  {t('units.remove')}
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">{t('units.noMembers')}</p>
          )}
        </section>
      </article>
      </FloatTilt>
    </section>
  );
}
