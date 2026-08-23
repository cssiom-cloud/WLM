import { useMemo, useState } from 'react';
import { NATIONALITIES, RANK_STRUCTURE } from '../../js/domain.js';
import { RIBBON_PRESETS, SKILL_KEYS, TIMELINE_KINDS, editorTimeline, parseJsonObject, ribbonPalette } from '../lib/dossier.js';
import { FileUploadButton, btnGhost, btnPrimary, fieldClass, CommandSelect } from '../lib/ui.jsx';

export default function DossierEditor({ record, t, onCancel, onSave, onPickImage }) {
  const [tab, setTab] = useState('photo');
  const [draft, setDraft] = useState(() => ({
    military_rank: record.military_rank || '',
    training_course: record.training_course || '',
    organization_role: record.organization_role || '',
    nationality: record.nationality || '',
    medals: Array.isArray(record.medals) ? [...record.medals] : [],
    completed_missions: Array.isArray(record.completed_missions) ? [...record.completed_missions] : [],
    skills: SKILL_KEYS.reduce((acc, key) => {
      const stored = parseJsonObject(record.service_skills);
      acc[key] = Number(stored[key]) || '';
      return acc;
    }, {}),
    timeline: editorTimeline(record)
  }));
  const [medalInput, setMedalInput] = useState('');
  const [missionInput, setMissionInput] = useState('');

  const ribbons = useMemo(() => draft.medals, [draft.medals]);

  function submit(event) {
    event.preventDefault();
    onSave({
      military_rank: draft.military_rank || null,
      training_course: draft.training_course || null,
      organization_role: draft.organization_role || null,
      nationality: draft.nationality || null,
      medals: draft.medals,
      completed_missions: draft.completed_missions,
      service_skills: Object.fromEntries(
        SKILL_KEYS.map((key) => [key, draft.skills[key] === '' ? undefined : Number(draft.skills[key])]).filter(
          ([, value]) => Number.isFinite(value)
        )
      ),
      service_timeline: draft.timeline.filter((entry) => entry.title)
    });
  }

  return (
    <form className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/55 p-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]" onSubmit={submit}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-[var(--text)]">
        <h2 className="mb-4 text-xl font-semibold text-stone-900 dark:text-slate-50">{t('common.edit')}</h2>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-stone-300/80 p-1 dark:border-white/10">
          {[
            { id: 'photo', label: t('img.crop') },
            { id: 'details', label: t('common.edit') }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`min-h-10 rounded-lg text-sm font-semibold ${
                tab === item.id ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-stone-700 dark:text-slate-200'
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === 'photo' && onPickImage ? (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-stone-300 p-4 dark:border-white/15">
            {record.avatar_url ? (
              <img src={record.avatar_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-2xl bg-stone-200 text-sm font-semibold dark:bg-slate-800">WLR</span>
            )}
            <div className="flex flex-wrap gap-2">
              <FileUploadButton variant="primary" hint={`${t('dir.avatar')} · ${t('img.crop')}`} onChange={(event) => onPickImage(event, 'avatar_url')} />
              <FileUploadButton hint={`${t('dir.cover')} · ${t('img.crop')}`} onChange={(event) => onPickImage(event, 'cover_url')} />
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('units.serviceRank')}
            <CommandSelect
              value={draft.military_rank}
              onChange={(value) => setDraft((current) => ({ ...current, military_rank: value }))}
              placeholder="—"
              options={[
                { value: '', label: '—' },
                ...RANK_STRUCTURE.map((item) => ({ value: item.rankTitle, label: item.rankTitle }))
              ]}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('dir.trainingCourse')}
            <input className={fieldClass} value={draft.training_course} onChange={(event) => setDraft((current) => ({ ...current, training_course: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('dir.deployment')}
            <CommandSelect
              value={draft.nationality}
              onChange={(value) => setDraft((current) => ({ ...current, nationality: value }))}
              placeholder="—"
              options={[
                { value: '', label: '—' },
                ...NATIONALITIES.map((item) => ({ value: item, label: item }))
              ]}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('dir.orgRole')}
            <input
              className={fieldClass}
              value={draft.organization_role}
              onChange={(event) => setDraft((current) => ({ ...current, organization_role: event.target.value }))}
              maxLength={120}
            />
          </label>
        </div>
        {onPickImage && tab === 'details' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <FileUploadButton hint={`${t('dir.avatar')} · ${t('img.crop')}`} onChange={(event) => onPickImage(event, 'avatar_url')} />
            <FileUploadButton hint={`${t('dir.cover')} · ${t('img.crop')}`} onChange={(event) => onPickImage(event, 'cover_url')} />
          </div>
        ) : null}

        <h3 className="mt-5 text-sm font-semibold">{t('dir.medals')}</h3>
        <ul className="mt-2 grid gap-2">
          {ribbons.map((name, index) => {
            const [left, center, right] = ribbonPalette(name);
            return (
              <li key={`${name}-${index}`} className="flex items-center gap-2">
                <span className="h-3 w-10 rounded-sm" style={{ background: `linear-gradient(90deg, ${left} 0 28%, ${center} 28% 72%, ${right} 72% 100%)` }} />
                <span className="flex-1 text-sm">{name}</span>
                <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => setDraft((current) => ({ ...current, medals: current.medals.filter((_, i) => i !== index) }))}>
                  {t('common.delete')}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={fieldClass} list="wlr-medal-presets" value={medalInput} onChange={(event) => setMedalInput(event.target.value)} />
          <datalist id="wlr-medal-presets">
            {RIBBON_PRESETS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              if (!medalInput.trim()) {
                return;
              }
              setDraft((current) => ({ ...current, medals: [...current.medals, medalInput.trim()] }));
              setMedalInput('');
            }}
          >
            {t('common.add')}
          </button>
        </div>

        <h3 className="mt-5 text-sm font-semibold">{t('dir.missions')}</h3>
        <ul className="mt-2 grid gap-1 text-sm">
          {draft.completed_missions.map((name, index) => (
            <li key={`${name}-${index}`} className="flex items-center gap-2">
              <span className="flex-1">{name}</span>
              <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => setDraft((current) => ({ ...current, completed_missions: current.completed_missions.filter((_, i) => i !== index) }))}>
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={fieldClass} value={missionInput} onChange={(event) => setMissionInput(event.target.value)} />
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              if (!missionInput.trim()) {
                return;
              }
              setDraft((current) => ({ ...current, completed_missions: [...current.completed_missions, missionInput.trim()] }));
              setMissionInput('');
            }}
          >
            {t('common.add')}
          </button>
        </div>

        <h3 className="mt-5 text-sm font-semibold">{t('dir.skills')}</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {SKILL_KEYS.map((key) => (
            <label key={key} className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t(`dir.skill.${key}`)}
              <input
                className={fieldClass}
                type="number"
                min="0"
                max="100"
                value={draft.skills[key]}
                onChange={(event) => setDraft((current) => ({ ...current, skills: { ...current.skills, [key]: event.target.value } }))}
              />
            </label>
          ))}
        </div>

        <h3 className="mt-5 text-sm font-semibold">{t('dir.timeline')}</h3>
        <p className="mt-1 text-sm text-slate-500">{t('dir.timelineHint')}</p>
        <div className="mt-3 grid gap-3">
          {draft.timeline.map((entry, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={fieldClass} placeholder={t('dir.timelineDate')} value={entry.date} onChange={(event) => setDraft((current) => ({ ...current, timeline: current.timeline.map((row, i) => (i === index ? { ...row, date: event.target.value } : row)) }))} />
                <CommandSelect
                  value={entry.kind}
                  onChange={(value) => setDraft((current) => ({ ...current, timeline: current.timeline.map((row, i) => (i === index ? { ...row, kind: value } : row)) }))}
                  options={TIMELINE_KINDS.map((kind) => ({ value: kind, label: t(`dir.kind.${kind}`) }))}
                />
              </div>
              <input className={fieldClass} placeholder={t('dir.timelineTitle')} value={entry.title} onChange={(event) => setDraft((current) => ({ ...current, timeline: current.timeline.map((row, i) => (i === index ? { ...row, title: event.target.value } : row)) }))} />
              <textarea className={`${fieldClass} min-h-16 py-2`} rows={2} placeholder={t('dir.timelineDetail')} value={entry.description} onChange={(event) => setDraft((current) => ({ ...current, timeline: current.timeline.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)) }))} />
              <button type="button" className="justify-self-start text-xs font-semibold text-rose-600" onClick={() => setDraft((current) => ({ ...current, timeline: current.timeline.filter((_, i) => i !== index) }))}>
                {t('common.delete')}
              </button>
            </div>
          ))}
          <button type="button" className={btnGhost} onClick={() => setDraft((current) => ({ ...current, timeline: [...current.timeline, { date: '', kind: 'other', title: '', description: '' }] }))}>
            {t('common.add')}
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="submit" className={btnPrimary}>
            {t('common.save')}
          </button>
          <button type="button" className={btnGhost} onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </form>
  );
}
