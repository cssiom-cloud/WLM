import { useCallback, useEffect, useMemo, useState } from 'react';
import AnimatedCard, { DossierOverlay, originFromEvent } from '../components/AnimatedCard.jsx';
import ImageCropper from '../components/ImageCropper.jsx';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { GENDERS, biographyParagraphs, parsePersonnelName } from '../../js/domain.js';
import { isAdmin, visiblePersonnel } from '../lib/access.js';
import { fetchPersonnelRoster, fetchSettingsMap, fetchUnitBoard, updatePersonnelRecord, uploadPersonnelImage, writeActivityLog } from '../lib/services.js';
import { btnPrimary, fieldClass, glassClass, CommandSelect } from '../lib/ui.jsx';
import DossierEditor from '../components/DossierEditor.jsx';

function visibleName(row, fallback) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || fallback || 'Unassigned name';
}

export default function Dashboard() {
  const { supabase, lang, t, formatPersonnelName, activePersonnel, refresh, session, isAdmin: adminFlag } = useCommand();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState([]);
  const [units, setUnits] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [settingsMap, setSettingsMap] = useState({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', gender: '', biography: '' });
  const [selected, setSelected] = useState(null);
  const [dossierEdit, setDossierEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [crop, setCrop] = useState(null);
  const person = activePersonnel;
  const admin = adminFlag || isAdmin(activePersonnel);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [people, board, settings] = await Promise.all([
        fetchPersonnelRoster(supabase),
        fetchUnitBoard(supabase).catch(() => ({ units: [], ranks: [] })),
        fetchSettingsMap(supabase).catch(() => ({}))
      ]);
      setRoster(visiblePersonnel(people, person));
      setUnits(board.units || []);
      setRanks(board.ranks || []);
      setSettingsMap(settings);
    } catch {
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [person, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!person) {
      return;
    }
    const history = biographyParagraphs(person, true);
    setForm({
      name: formatPersonnelName(person),
      age: person.age ?? '',
      gender: person.gender || '',
      biography: String(person.biography || '').trim() || [history.paragraphIdentity, history.paragraphService].filter(Boolean).join('\n\n')
    });
  }, [formatPersonnelName, person]);

  const unitName = units.find((unit) => unit.id === person?.unit_id)?.name || person?.wlc_agency || '';
  const unitRank = ranks.find((rank) => rank.id === person?.unit_rank_id)?.title || '';
  const history = person ? biographyParagraphs(person, true) : { paragraphIdentity: '', paragraphService: '' };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = roster.filter((row) => row.id !== person?.id);
    if (!needle) {
      return rows;
    }
    return rows.filter((row) =>
      [visibleName(row), row.military_rank, row.organization_role, row.military_branch].join(' ').toLowerCase().includes(needle)
    );
  }, [person, query, roster]);

  async function saveProfile() {
    if (!person) {
      return;
    }
    const ageValue = String(form.age || '').trim();
    const age = ageValue === '' ? null : Number(ageValue);
    if (age != null && (!Number.isFinite(age) || age < 17)) {
      toast.alert('Age must be 17 or older.');
      return;
    }
    try {
      await updatePersonnelRecord(supabase, person.id, {
        ...parsePersonnelName(form.name),
        biography: form.biography,
        age,
        gender: form.gender || null
      });
      await writeActivityLog(supabase, {
        userId: person.id,
        roleSnapshot: person.role,
        actionType: 'profile_update',
        details: 'Updated name, biography, age, and gender'
      });
      await refresh?.();
      setEditing(false);
      toast.success(t('common.save'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function onPickImage(event, field) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !person) {
      return;
    }
    setCrop({ file, field, aspectId: field === 'cover_url' ? '16:9' : '1:1' });
  }

  async function confirmCrop(file) {
    const targetId = crop?.personnelId || person?.id;
    if (!targetId || !crop) {
      return;
    }
    try {
      await uploadPersonnelImage(supabase, targetId, file, crop.field, session?.user?.id);
      await writeActivityLog(supabase, {
        userId: person?.id || targetId,
        roleSnapshot: person?.role,
        actionType: crop.field === 'avatar_url' ? 'avatar_update' : 'profile_update',
        details: crop.field === 'avatar_url' ? 'Updated profile avatar' : 'Updated banner'
      });
      setCrop(null);
      await refresh?.();
      await load();
      toast.success(t('img.saved'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('home.kicker')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('home.commandTitle')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t('home.lead')}</p>
      </header>

      {person ? (
        <article className={`${glassClass} mb-10 overflow-visible`}>
          <div className="relative z-20">
            <div className="aspect-[16/9] overflow-hidden rounded-t-2xl bg-stone-900">
              {person.cover_url || person.banner_url ? (
                <img
                  src={person.cover_url || person.banner_url}
                  alt=""
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="h-full w-full" />
              )}
              <label className="absolute right-3 top-3 cursor-pointer rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-950/80 dark:text-slate-200">
                {t('home.editCover')}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => onPickImage(event, 'cover_url')} />
              </label>
            </div>
            <div className="absolute left-6 top-full z-20 -translate-y-1/2">
              {person.avatar_url ? (
                <img src={person.avatar_url} alt="" className="h-20 w-20 rounded-2xl border-4 border-[var(--bg-elevated)] object-cover" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-[var(--bg-elevated)] bg-slate-200 text-lg font-semibold dark:bg-slate-800">
                  WLR
                </div>
              )}
            </div>
          </div>
          <div className="px-6 pb-6 pt-14">
            <div className="mb-4 flex flex-wrap gap-2">
              <label className={`${btnPrimary} cursor-pointer`}>
                {t('home.uploadPhoto')}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => onPickImage(event, 'avatar_url')} />
              </label>
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10" onClick={() => setEditing((value) => !value)}>
                {t('home.editProfile')}
              </button>
            </div>
            {editing ? (
              <div className="grid gap-3">
                <input className={fieldClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                <p className="text-sm text-slate-500">{person.military_rank}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t('home.age')}
                    <input className={fieldClass} type="number" min="17" value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {t('home.gender')}
                    <CommandSelect
                      value={form.gender}
                      onChange={(value) => setForm((current) => ({ ...current, gender: value }))}
                      placeholder="—"
                      options={[{ value: '', label: '—' }, ...GENDERS.map((item) => ({ value: item, label: item }))]}
                    />
                  </label>
                </div>
                <textarea className={`${fieldClass} min-h-32 py-3`} rows={6} value={form.biography} onChange={(event) => setForm((current) => ({ ...current, biography: event.target.value }))} />
                <button type="button" className={btnPrimary} onClick={saveProfile}>
                  {t('common.save')}
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatPersonnelName(person) || t('profiles.empty')}</h2>
                <p className="mt-1 text-sm text-slate-500">{person.military_rank}</p>
                {unitName ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {t('home.unit')}: {unitName}
                    {unitRank ? ` · ${unitRank}` : ''}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">
                  {t('home.age')}: {person.age ?? '-'} · {t('home.gender')}: {person.gender || '-'}
                </p>
                {Array.isArray(person.honor_ranks) && person.honor_ranks.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {person.honor_ranks.map((rank) => (
                      <span key={rank} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                        {rank}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <p>{history.paragraphIdentity}</p>
                  {history.paragraphService ? <p>{history.paragraphService}</p> : null}
                </div>
              </>
            )}
          </div>
        </article>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('dir.kicker')}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('dir.title')}</h2>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('dir.search')}
          className={`${fieldClass} sm:max-w-xs`}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
          ))}
        </div>
      ) : filtered.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ perspective: 1200 }}>
            {filtered.map((row) => (
              <AnimatedCard
                key={row.id}
                id={row.id}
                name={formatPersonnelName(row) || visibleName(row, t('profiles.empty'))}
                rank={row.military_rank}
                role={row.organization_role}
                avatarUrl={row.avatar_url}
                actionLabel={t('dir.view')}
                onClick={(event) => setSelected({ row, origin: originFromEvent(event) })}
              />
            ))}
          </div>
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
              setDossierEdit(selected?.row);
              setSelected(null);
            }}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">{t('dir.empty')}</p>
      )}
      {dossierEdit ? (
        <DossierEditor
          record={dossierEdit}
          t={t}
          onCancel={() => setDossierEdit(null)}
          onSave={async (payload) => {
            try {
              await updatePersonnelRecord(supabase, dossierEdit.id, payload);
              setDossierEdit(null);
              toast.success(t('common.save'));
              await load();
            } catch (error) {
              toast.alert(error.message);
            }
          }}
          onPickImage={(event, field) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              setCrop({ file, field, aspectId: field === 'cover_url' ? '16:9' : '1:1', personnelId: dossierEdit.id });
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
    </section>
  );
}
