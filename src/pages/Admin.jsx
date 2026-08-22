import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { AGE_BRACKETS, GENDERS, MILITARY_BRANCHES, NATIONALITIES, RACES, RANK_STRUCTURE } from '../../js/domain.js';
import { isAdmin, isDev, visiblePersonnel } from '../lib/access.js';
import { uniqueAgencyValues, deletePersonnelAccount, fetchPersonnelRoster, updatePersonnelRecord, uploadPersonnelImage, writeActivityLog } from '../lib/services.js';
import { PageHeader, FileUploadButton, btnDanger, btnGhost, btnPrimary, fieldClass, glassClass, CommandSelect } from '../lib/ui.jsx';
import ImageCropper from '../components/ImageCropper.jsx';

export default function Admin() {
  const { supabase, t, activePersonnel, formatPersonnelName, session } = useCommand();
  const toast = useToast();
  const [roster, setRoster] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ rank: '', race: '', gender: '', agency: '', nationality: '', age: '', branch: '' });
  const [editing, setEditing] = useState(null);
  const [honorRanks, setHonorRanks] = useState([]);
  const [honorNew, setHonorNew] = useState('');
  const [crop, setCrop] = useState(null);
  const admin = isAdmin(activePersonnel);
  const viewerIsDev = isDev(activePersonnel);

  const load = useCallback(async () => {
    const people = await fetchPersonnelRoster(supabase);
    setRoster(visiblePersonnel(people, activePersonnel));
  }, [activePersonnel, supabase]);

  useEffect(() => {
    if (admin) {
      load().catch((error) => toast.alert(error.message));
    }
  }, [admin, load, toast]);

  const agencies = useMemo(() => uniqueAgencyValues(roster), [roster]);
  const filtered = roster.filter((record) => {
    if (filters.rank && record.military_rank !== filters.rank) return false;
    if (filters.race && record.race !== filters.race) return false;
    if (filters.gender && record.gender !== filters.gender) return false;
    if (filters.agency && record.wlc_agency !== filters.agency) return false;
    if (filters.nationality && record.nationality !== filters.nationality) return false;
    if (filters.branch && record.military_branch !== filters.branch) return false;
    if (filters.age) {
      const bracket = AGE_BRACKETS.find((item) => item.label === filters.age);
      if (!bracket || record.age == null) return false;
      if (record.age < bracket.min) return false;
      if (bracket.max != null && record.age > bracket.max) return false;
    }
    return true;
  });

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  function openEditor(record) {
    setEditing({ ...record });
    setHonorRanks(Array.isArray(record.honor_ranks) ? [...record.honor_ranks] : []);
  }

  async function saveEditor(event) {
    event.preventDefault();
    try {
      await updatePersonnelRecord(supabase, editing.id, {
        first_name: editing.first_name,
        middle_name: editing.middle_name,
        last_name: editing.last_name,
        age: editing.age === '' ? null : Number(editing.age),
        nationality: editing.nationality || null,
        gender: editing.gender || null,
        race: editing.race || null,
        religion: editing.religion || null,
        wlc_agency: editing.wlc_agency || null,
        training_course: editing.training_course || null,
        military_branch: editing.military_branch || null,
        organization_role: editing.organization_role || null,
        military_rank: editing.military_rank || null,
        avatar_url: editing.avatar_url || null,
        medals: Array.isArray(editing.medals) ? editing.medals : [],
        completed_missions: Array.isArray(editing.completed_missions) ? editing.completed_missions : [],
        service_skills: editing.service_skills || {},
        service_timeline: editing.service_timeline || [],
        honor_ranks: honorRanks
      });
      await writeActivityLog(supabase, {
        userId: activePersonnel.id,
        roleSnapshot: activePersonnel.role,
        actionType: 'personnel_edit',
        details: `Edited ${formatPersonnelName(editing)}`
      });
      setEditing(null);
      toast.success(t('common.save'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        kicker="Command"
        title="Admin Page"
        actions={
          <button type="button" className={btnGhost} onClick={() => setFiltersOpen((value) => !value)}>
            Filter
          </button>
        }
      />
      {filtersOpen ? (
        <div className={`${glassClass} mb-4 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4`}>
          {[
            { key: 'rank', label: 'Rank', options: RANK_STRUCTURE.map((row) => row.rankTitle) },
            { key: 'branch', label: 'Branch', options: MILITARY_BRANCHES },
            { key: 'race', label: 'Race', options: RACES },
            { key: 'gender', label: 'Gender', options: GENDERS },
            { key: 'agency', label: 'Agency', options: agencies },
            { key: 'nationality', label: 'Nationality', options: NATIONALITIES },
            { key: 'age', label: 'Age', options: AGE_BRACKETS.map((row) => row.label) }
          ].map((item) => (
            <label key={item.key} className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
              <CommandSelect
                value={filters[item.key]}
                onChange={(value) => setFilters((current) => ({ ...current, [item.key]: value }))}
                placeholder="All"
                options={[{ value: '', label: 'All' }, ...item.options.map((option) => ({ value: option, label: option }))]}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5">
            <tr>
              {['Photo', 'Name', 'Rank', 'Branch', 'Race', 'Gender', 'Agency', 'Nationality', 'Age', 'Role', 'Action'].map((header) => (
                <th key={header} className="px-3 py-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => (
              <tr key={record.id} className="border-t border-slate-200/80 dark:border-white/10">
                <td className="px-3 py-2">
                  {record.avatar_url ? (
                    <img src={record.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-[0.6rem] font-semibold dark:bg-slate-800">
                      {(formatPersonnelName(record) || 'WLR').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{formatPersonnelName(record) || t('units.unnamed')}</td>
                <td className="px-3 py-2">{record.military_rank}</td>
                <td className="px-3 py-2">{record.military_branch}</td>
                <td className="px-3 py-2">{record.race}</td>
                <td className="px-3 py-2">{record.gender}</td>
                <td className="px-3 py-2">{record.wlc_agency}</td>
                <td className="px-3 py-2">{record.nationality}</td>
                <td className="px-3 py-2">{record.age}</td>
                <td className="px-3 py-2">{record.role}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={btnGhost} onClick={() => openEditor(record)}>
                      {t('common.edit')}
                    </button>
                    {record.role !== 'admin' ? (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          await updatePersonnelRecord(supabase, record.id, { role: 'admin' });
                          toast.success('Admin role assigned.');
                          await load();
                        }}
                      >
                        Add Admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          await updatePersonnelRecord(supabase, record.id, { role: 'user' });
                          toast.success('Admin role removed.');
                          await load();
                        }}
                      >
                        Remove Admin
                      </button>
                    )}
                    {viewerIsDev ? (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          await updatePersonnelRecord(supabase, record.id, { is_dev: !record.is_dev });
                          toast.success(record.is_dev ? t('admin.revokeDev') : t('admin.grantDev'));
                          await load();
                        }}
                      >
                        {record.is_dev ? t('admin.revokeDev') : t('admin.grantDev')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={async () => {
                        if (!window.confirm(t('admin.confirmDeleteUser'))) {
                          return;
                        }
                        await deletePersonnelAccount(supabase, record.id);
                        toast.success(t('admin.deletedUser'));
                        await load();
                      }}
                    >
                      {t('admin.deleteUser')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/50 p-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
          <form className={`${glassClass} max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto p-6`} onSubmit={saveEditor}>
            <h2 className="mb-4 text-xl font-semibold">Edit</h2>
            <div className="mb-4 flex items-center gap-4">
              {editing.avatar_url ? (
                <img src={editing.avatar_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-slate-200 text-sm font-semibold dark:bg-slate-800">WLR</span>
              )}
              <div className="flex flex-wrap gap-2">
                <FileUploadButton
                  variant="primary"
                  hint={t('img.crop')}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      setCrop({ file, field: 'avatar_url' });
                    }
                  }}
                />
                <FileUploadButton
                  hint={t('dir.cover')}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      setCrop({ file, field: 'cover_url' });
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 sm:col-span-2">
                Email
                <input className={fieldClass} type="email" readOnly value={editing.email || ''} />
              </label>
              {['first_name', 'middle_name', 'last_name', 'religion', 'wlc_agency', 'training_course', 'organization_role', 'avatar_url'].map((key) => (
                <label key={key} className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {key.replaceAll('_', ' ')}
                  <input className={fieldClass} value={editing[key] || ''} onChange={(event) => setEditing((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Age
                <input className={fieldClass} type="number" min={17} value={editing.age ?? ''} onChange={(event) => setEditing((current) => ({ ...current, age: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Nationality
                <CommandSelect
                  value={editing.nationality || ''}
                  onChange={(value) => setEditing((current) => ({ ...current, nationality: value }))}
                  placeholder="—"
                  options={[{ value: '', label: '—' }, ...NATIONALITIES.map((item) => ({ value: item, label: item }))]}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Gender
                <CommandSelect
                  value={editing.gender || ''}
                  onChange={(value) => setEditing((current) => ({ ...current, gender: value }))}
                  placeholder="—"
                  options={[{ value: '', label: '—' }, ...GENDERS.map((item) => ({ value: item, label: item }))]}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Race
                <CommandSelect
                  value={editing.race || ''}
                  onChange={(value) => setEditing((current) => ({ ...current, race: value }))}
                  placeholder="—"
                  options={[{ value: '', label: '—' }, ...RACES.map((item) => ({ value: item, label: item }))]}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Branch
                <CommandSelect
                  value={editing.military_branch || ''}
                  onChange={(value) => setEditing((current) => ({ ...current, military_branch: value }))}
                  placeholder="—"
                  options={[{ value: '', label: '—' }, ...MILITARY_BRANCHES.map((item) => ({ value: item, label: item }))]}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Rank
                <CommandSelect
                  value={editing.military_rank || ''}
                  onChange={(value) => setEditing((current) => ({ ...current, military_rank: value }))}
                  placeholder="—"
                  options={[{ value: '', label: '—' }, ...RANK_STRUCTURE.map((item) => ({ value: item.rankTitle, label: item.rankTitle }))]}
                />
              </label>
            </div>
            <div className="mt-3">
              <FileUploadButton
                hint="Upload / crop photo"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    setCrop({ file, field: 'avatar_url' });
                  }
                }}
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">{t('admin.honorRanks')}</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {honorRanks.map((rank, index) => (
                  <button
                    key={`${rank}-${index}`}
                    type="button"
                    className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"
                    onClick={() => setHonorRanks((current) => current.filter((_, i) => i !== index))}
                  >
                    {rank} ×
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={fieldClass} maxLength={80} value={honorNew} onChange={(event) => setHonorNew(event.target.value)} />
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    if (!honorNew.trim()) {
                      toast.alert(t('admin.honorRequired'));
                      return;
                    }
                    setHonorRanks((current) => (current.includes(honorNew.trim()) ? current : [...current, honorNew.trim()]));
                    setHonorNew('');
                  }}
                >
                  {t('admin.addHonor')}
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className={btnPrimary}>
                {t('common.save')}
              </button>
              <button type="button" className={btnGhost} onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {crop && editing ? (
        <ImageCropper
          file={crop.file}
          aspectId="1:1"
          title={t('img.crop')}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setCrop(null)}
          onConfirm={async (file) => {
            try {
              const updated = await uploadPersonnelImage(supabase, editing.id, file, crop.field, session?.user?.id);
              setEditing((current) => ({ ...current, avatar_url: updated.avatar_url, cover_url: updated.cover_url || current.cover_url }));
              setCrop(null);
              toast.success(t('img.saved'));
            } catch (error) {
              toast.alert(error.message);
            }
          }}
        />
      ) : null}
    </section>
  );
}
