import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin } from '../lib/access.js';
import { deleteLoreEntry, fetchLoreEntries, saveLoreEntry } from '../lib/services.js';
import { ConfirmDialog, PageHeader, btnDanger, btnGhost, btnPrimary, fieldClass, glassClass, CommandSelect } from '../lib/ui.jsx';

const ease = [0.22, 1, 0.36, 1];
const emptyForm = { id: null, category: 'timeline', title: '', meta1: '', meta2: '', body: '', sort_order: 0 };

const CATEGORIES = [
  { id: 'timeline', headingKey: 'lore.timeline', meta1: 'Era', meta2: null },
  { id: 'geopolitics', headingKey: 'lore.geopolitics', meta1: 'Standing', meta2: null },
  { id: 'naval', headingKey: 'lore.naval', meta1: 'Type', meta2: 'Complement' }
];

export default function Lore() {
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const admin = isAdmin(activePersonnel);
  const [entries, setEntries] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const grouped = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        ...category,
        rows: entries.filter((entry) => entry.category === category.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      })),
    [entries]
  );
  const active = entries.find((entry) => entry.id === activeId) || entries[0] || null;
  const activeMeta = CATEGORIES.find((item) => item.id === (active?.category || form.category)) || CATEGORIES[0];

  const load = useCallback(async () => {
    const rows = await fetchLoreEntries(supabase);
    setEntries(rows);
    setActiveId((current) => current || rows[0]?.id || null);
  }, [supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  async function handleSave(event) {
    event.preventDefault();
    try {
      await saveLoreEntry(supabase, form);
      toast.success(t('common.save'));
      setMode(null);
      setForm(emptyForm);
      await load();
      if (form.id) {
        setActiveId(form.id);
      }
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function handleDelete() {
    if (!active) {
      return;
    }
    try {
      await deleteLoreEntry(supabase, active.id);
      setConfirmOpen(false);
      setActiveId(null);
      await load();
      toast.success(t('lore.deleted'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <motion.section className="mx-auto max-w-6xl" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      <PageHeader
        kicker={t('lore.kicker')}
        title={t('lore.title')}
        actions={
          admin ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setForm(emptyForm);
                setMode('create');
                setConfirmOpen(false);
              }}
            >
              {t('lore.addTopic')}
            </button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <motion.nav className={`${glassClass} max-h-[70vh] overflow-auto p-3`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease, delay: 0.05 }}>
          {grouped.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              <p className="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{t(group.headingKey)}</p>
              {group.rows.length ? (
                group.rows.map((entry, index) => (
                  <motion.button
                    key={entry.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease, delay: 0.03 * index }}
                    className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                      entry.id === (active?.id || '') ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-white/60 dark:hover:bg-white/5'
                    }`}
                    onClick={() => {
                      setActiveId(entry.id);
                      setMode(null);
                      setConfirmOpen(false);
                    }}
                  >
                    {entry.title}
                  </motion.button>
                ))
              ) : (
                <p className="px-3 pb-2 text-xs text-slate-400">{t('lore.empty')}</p>
              )}
            </div>
          ))}
        </motion.nav>
        <motion.article className={`${glassClass} overflow-hidden p-6`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: 0.08 }}>
          <AnimatePresence mode="wait">
            {mode ? (
              <motion.form
                key="editor"
                className="grid gap-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease }}
                onSubmit={handleSave}
              >
                <h2 className="text-xl font-semibold">{t('lore.entry')}</h2>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('lore.category')}
                  <CommandSelect
                    value={form.category}
                    onChange={(value) => setForm((current) => ({ ...current, category: value }))}
                    options={CATEGORIES.map((item) => ({ value: item.id, label: t(item.headingKey) }))}
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Title
                  <input className={fieldClass} required maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {CATEGORIES.find((item) => item.id === form.category)?.meta1}
                  <input className={fieldClass} maxLength={120} value={form.meta1} onChange={(event) => setForm((current) => ({ ...current, meta1: event.target.value }))} />
                </label>
                {CATEGORIES.find((item) => item.id === form.category)?.meta2 ? (
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {CATEGORIES.find((item) => item.id === form.category)?.meta2}
                    <input className={fieldClass} maxLength={60} value={form.meta2} onChange={(event) => setForm((current) => ({ ...current, meta2: event.target.value }))} />
                  </label>
                ) : null}
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('lore.details')}
                  <textarea className={`${fieldClass} min-h-24 py-3`} rows={6} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('lore.order')}
                  <input className={fieldClass} type="number" min={0} max={999} value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))} />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className={btnPrimary}>
                    {t('common.save')}
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setMode(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </motion.form>
            ) : active ? (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease }}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t(activeMeta.headingKey)}</p>
                    <h2 className="text-2xl font-semibold">{active.title}</h2>
                  </div>
                  {admin ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => {
                          setForm({ ...emptyForm, ...active });
                          setMode('edit');
                          setConfirmOpen(false);
                        }}
                      >
                        {t('common.edit')}
                      </button>
                      <button type="button" className={btnDanger} onClick={() => setConfirmOpen(true)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  ) : null}
                </div>
                <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{activeMeta.meta1}</dt>
                    <dd>{active.meta1 || '—'}</dd>
                  </div>
                  {activeMeta.meta2 ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{activeMeta.meta2}</dt>
                      <dd>{active.meta2 || '—'}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{active.body || '—'}</p>
              </motion.div>
            ) : (
              <motion.p key="empty" className="text-sm text-slate-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {t('lore.empty')}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.article>
      </div>
      <ConfirmDialog
        open={confirmOpen && Boolean(active) && !mode}
        title={t('lore.confirmTitle')}
        message={active ? t('lore.confirmBody').replace('{title}', active.title) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </motion.section>
  );
}
