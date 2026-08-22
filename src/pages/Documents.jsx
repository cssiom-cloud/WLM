import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin } from '../lib/access.js';
import { deleteDocument, fetchDocuments, saveDocument } from '../lib/services.js';
import { ConfirmDialog, PageHeader, btnDanger, btnGhost, btnPrimary, fieldClass, glassClass, renderMarkdown } from '../lib/ui.jsx';

const ease = [0.22, 1, 0.36, 1];

export default function Documents() {
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [mode, setMode] = useState(null);
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const admin = isAdmin(activePersonnel);
  const active = documents.find((doc) => doc.id === activeId) || documents[0] || null;

  const load = useCallback(async () => {
    const rows = await fetchDocuments(supabase);
    setDocuments(rows);
    setActiveId((current) => current || rows[0]?.id || null);
  }, [supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  async function handleSave(event) {
    event.preventDefault();
    try {
      const saved = await saveDocument(supabase, { id: mode === 'edit' ? active?.id : undefined, title, markdown });
      toast.success(t('common.save'));
      setMode(null);
      await load();
      setActiveId(saved.id);
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function handleDelete() {
    if (!active) {
      return;
    }
    try {
      await deleteDocument(supabase, active.id);
      setConfirmOpen(false);
      setActiveId(null);
      await load();
      toast.success(t('docs.deleted'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <motion.section className="mx-auto max-w-6xl" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      <PageHeader
        kicker={t('docs.kicker')}
        title={t('docs.title')}
        actions={
          admin ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setMode('create');
                setTitle('');
                setMarkdown('');
                setConfirmOpen(false);
              }}
            >
              {t('docs.create')}
            </button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <motion.nav className={`${glassClass} p-3`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease, delay: 0.05 }}>
          {documents.map((doc, index) => (
            <motion.button
              key={doc.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease, delay: 0.04 * index }}
              className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                doc.id === (active?.id || '') ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-white/60 dark:hover:bg-white/5'
              }`}
              onClick={() => {
                setActiveId(doc.id);
                setMode(null);
                setConfirmOpen(false);
              }}
            >
              {doc.title}
            </motion.button>
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
                <input className={fieldClass} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('create.titleLabel')} />
                <textarea className={`${fieldClass} min-h-64 py-3`} rows={12} value={markdown} onChange={(event) => setMarkdown(event.target.value)} />
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
                  <h2 className="text-2xl font-semibold">{active.title}</h2>
                  {admin ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => {
                          setMode('edit');
                          setTitle(active.title);
                          setMarkdown(active.markdown || '');
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
                <div>{renderMarkdown(active.markdown)}</div>
              </motion.div>
            ) : (
              <motion.p key="empty" className="text-sm text-slate-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {t('ann.empty')}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.article>
      </div>
      <ConfirmDialog
        open={confirmOpen && Boolean(active) && !mode}
        title={t('docs.confirmTitle')}
        message={active ? t('docs.confirmBody').replace('{title}', active.title) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </motion.section>
  );
}
