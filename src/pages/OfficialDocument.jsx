import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { canEditMemo, visibleMemoFolders } from '../lib/access.js';
import { deleteOfficialDoc, fetchOfficialDocs, fetchUnitBoard, saveOfficialDoc } from '../lib/services.js';
import { btnDanger, btnGhost, btnPrimary, fieldClass, glassClass, CommandSelect } from '../lib/ui.jsx';
import { exportNodeAsJpg, exportNodeAsPdf } from '../lib/export.js';
import { SITE_LOGO } from '../lib/brand.js';

const FOLDER_META = {
  normal: { key: 'memo.folder.normal', hint: 'memo.folder.normalHint' },
  unit_leader: { key: 'memo.folder.leader', hint: 'memo.folder.leaderHint' },
  admin: { key: 'memo.folder.admin', hint: 'memo.folder.adminHint' },
  dev: { key: 'memo.folder.dev', hint: 'memo.folder.devHint' }
};

const DOC_PREFIX = { normal: 'ธด.', unit_leader: 'หน.', admin: 'อด.', dev: 'พธ.' };
const PREFIX_OPTIONS = ['ธด.', 'หน.', 'อด.', 'พธ.'];
const DEFAULT_CLOSING = 'จึงเรียนมาด้วยเพื่อให้ทราบ และกรุณาแจ้งให้ส่วนราชการในสังกัดทราบ';

function buddhistYear() {
  return new Date().getFullYear() + 543;
}

function defaultThaiDate(lang) {
  const now = new Date();
  const monthsTh = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (lang === 'th') {
    return `${now.getDate()} ${monthsTh[now.getMonth()]} ${now.getFullYear() + 543}`;
  }
  return `${now.getDate()} ${monthsEn[now.getMonth()]} ${now.getFullYear()}`;
}

function parseBody(raw) {
  const text = String(raw || '').trim();
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return {
          paragraph1: parsed.paragraph1 || '',
          paragraph2: parsed.paragraph2 || '',
          closingParagraph: parsed.closingParagraph || DEFAULT_CLOSING
        };
      }
    } catch {
      /* treat as paragraph */
    }
  }
  return { paragraph1: text, paragraph2: '', closingParagraph: DEFAULT_CLOSING };
}

function encodeBody(paragraph1, paragraph2, closingParagraph) {
  return JSON.stringify({ paragraph1: paragraph1 || '', paragraph2: paragraph2 || '', closingParagraph: closingParagraph || '' });
}

function prefixOf(docNo, folder) {
  const value = String(docNo || '').trim();
  return Object.values(DOC_PREFIX).find((item) => value.startsWith(item)) || DOC_PREFIX[folder] || DOC_PREFIX.normal;
}

function withDocPrefix(docNo, prefix) {
  let rest = String(docNo || '').trim();
  Object.values(DOC_PREFIX).forEach((item) => {
    if (rest.startsWith(item)) {
      rest = rest.slice(item.length).trim();
    }
  });
  return rest ? `${prefix} ${rest}` : `${prefix} 001/${buddhistYear()}`;
}

function nextDocNo(docs, folderKey) {
  const prefix = DOC_PREFIX[folderKey] || DOC_PREFIX.normal;
  const year = buddhistYear();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\s*(\\d+)\\/(\\d+)$`);
  let max = 0;
  docs
    .filter((row) => row.folder === folderKey)
    .forEach((row) => {
      const match = String(row.doc_no || '').trim().match(pattern);
      if (match && Number(match[2]) === year) {
        max = Math.max(max, Number(match[1]));
      }
    });
  return `${prefix} ${String(max + 1).padStart(3, '0')}/${year}`;
}

function ensureSarabun() {
  const id = 'wlr-sarabun-font';
  if (document.getElementById(id)) {
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap';
  document.head.appendChild(link);
}

export default function OfficialDocument() {
  const command = useCommand();
  const { lang, t, activePersonnel, formatPersonnelName, supabase } = command;
  const setZenMode = command.setZenMode;
  const toast = useToast();
  const paperRef = useRef(null);
  const [units, setUnits] = useState([]);
  const [docs, setDocs] = useState([]);
  const [folder, setFolder] = useState('normal');
  const [selectedId, setSelectedId] = useState(null);
  const [localZen, setLocalZen] = useState(false);
  const [draft, setDraft] = useState({
    prefix: 'ธด.',
    docNo: '',
    date: '',
    subject: '',
    to: '',
    p1: '',
    p2: '',
    closing: DEFAULT_CLOSING,
    signName: '',
    signTitle: ''
  });

  const folders = useMemo(() => visibleMemoFolders(activePersonnel, units), [activePersonnel, units]);
  const selected = docs.find((row) => row.id === selectedId) || null;
  const canEdit = !selected || canEditMemo(activePersonnel, selected, units);

  const emptyDraft = useCallback(
    (folderKey, list) => ({
      prefix: DOC_PREFIX[folderKey] || 'ธด.',
      docNo: nextDocNo(list, folderKey),
      date: defaultThaiDate(lang),
      subject: '',
      to: '',
      p1: '',
      p2: '',
      closing: DEFAULT_CLOSING,
      signName: formatPersonnelName(activePersonnel) || '',
      signTitle: activePersonnel?.organization_role || activePersonnel?.military_rank || ''
    }),
    [activePersonnel, formatPersonnelName, lang]
  );

  const load = useCallback(async () => {
    const [board, rows] = await Promise.all([
      fetchUnitBoard(supabase).catch(() => ({ units: [] })),
      fetchOfficialDocs(supabase)
    ]);
    setUnits(board.units || []);
    setDocs(rows);
    return rows;
  }, [supabase]);

  useEffect(() => {
    ensureSarabun();
    load()
      .then((rows) => {
        const firstFolder = visibleMemoFolders(activePersonnel, []).includes(folder) ? folder : 'normal';
        setFolder((current) => current || firstFolder);
        setDraft((current) => (current.docNo ? current : emptyDraft(firstFolder, rows)));
      })
      .catch((error) => toast.alert(error.message));
    return () => setZenMode?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDoc(doc, folderKey = folder) {
    if (!doc) {
      setDraft(emptyDraft(folderKey, docs));
      return;
    }
    const parts = parseBody(doc.body);
    const prefix = prefixOf(doc.doc_no, folderKey);
    setDraft({
      prefix,
      docNo: doc.doc_no || nextDocNo(docs, folderKey),
      date: doc.doc_date || defaultThaiDate(lang),
      subject: doc.subject || '',
      to: doc.addressed_to || '',
      p1: parts.paragraph1,
      p2: parts.paragraph2,
      closing: parts.closingParagraph,
      signName: doc.sign_name || '',
      signTitle: doc.sign_title || ''
    });
  }

  function enterZen() {
    setLocalZen(true);
    setZenMode?.(true);
  }

  function leaveZen() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (paperRef.current?.contains(active) || active?.closest?.('.memo-form')) {
        if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement || active instanceof HTMLSelectElement) {
          return;
        }
      }
      setLocalZen(false);
      setZenMode?.(false);
    }, 0);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!draft.subject.trim()) {
      toast.alert(t('memo.subjectRequired'));
      return;
    }
    try {
      const saved = await saveOfficialDoc(
        supabase,
        {
          id: selectedId,
          folder,
          doc_no: withDocPrefix(draft.docNo, draft.prefix),
          doc_date: draft.date,
          subject: draft.subject.trim(),
          addressed_to: draft.to,
          body: encodeBody(draft.p1, draft.p2, draft.closing),
          sign_name: draft.signName,
          sign_title: draft.signTitle,
          logo_url: selected?.logo_url || SITE_LOGO
        },
        activePersonnel.id
      );
      setSelectedId(saved.id);
      await load();
      toast.success(t('memo.saved'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function handleDelete() {
    if (!selected || !window.confirm(t('common.confirmDelete'))) {
      return;
    }
    try {
      await deleteOfficialDoc(supabase, selected.id);
      setSelectedId(null);
      const rows = await load();
      setDraft(emptyDraft(folder, rows));
      toast.success(t('memo.deleted'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function exportPaper(kind) {
    const node = paperRef.current;
    if (!node) {
      return;
    }
    try {
      if (kind === 'jpg') {
        await exportNodeAsJpg(node, draft.subject || t('memo.untitled'), 'WLR-Memo');
      } else {
        await exportNodeAsPdf(node, draft.subject || t('memo.untitled'), 'WLR-Memo');
      }
      toast.success(t('memo.export.ready'));
    } catch (error) {
      toast.alert(error.message || t('memo.export.failed'));
    }
  }

  const list = docs.filter((row) => row.folder === folder);
  const chromeOpacity = localZen ? 0.1 : 1;
  const paperFont = { fontFamily: '"Sarabun", "TH Sarabun New", "Prompt", serif' };
  const crest = SITE_LOGO;

  return (
    <section className="mx-auto max-w-7xl">
      <motion.div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" animate={{ opacity: chromeOpacity }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('memo.kicker')}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('memo.title')}</h1>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setSelectedId(null);
            setDraft(emptyDraft(folder, docs));
          }}
        >
          {t('memo.new')}
        </button>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[14rem_16rem_minmax(0,1fr)]">
        <motion.aside className={`${glassClass} p-4`} animate={{ opacity: chromeOpacity }}>
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('memo.folders')}</p>
          <nav className="grid gap-1">
            {folders.map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                  folder === key ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-slate-600 hover:bg-white/70 dark:text-slate-300'
                }`}
                onClick={() => {
                  setFolder(key);
                  setSelectedId(null);
                  setDraft(emptyDraft(key, docs));
                }}
              >
                {t(FOLDER_META[key].key)}
              </button>
            ))}
          </nav>
        </motion.aside>

        <motion.section className={`${glassClass} p-4`} animate={{ opacity: chromeOpacity }}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t(FOLDER_META[folder]?.key || 'memo.folder.normal')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t(FOLDER_META[folder]?.hint || 'memo.folder.normalHint')}</p>
          <div className="mt-4 grid gap-2">
            {list.length ? (
              list.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-left ${row.id === selectedId ? 'bg-[var(--accent-soft)]' : 'hover:bg-white/60 dark:hover:bg-white/5'}`}
                  onClick={() => {
                    setSelectedId(row.id);
                    applyDoc(row, folder);
                  }}
                >
                  <strong className="block text-sm">{row.subject || t('memo.untitled')}</strong>
                  <small className="text-slate-500">{row.doc_no || t('memo.noNumber')}</small>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">{t('memo.empty')}</p>
            )}
          </div>
        </motion.section>

        <div className="grid gap-3">
          <form className="memo-form grid gap-3" onSubmit={handleSave}>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.prefix')}
              <CommandSelect
                disabled={!canEdit}
                value={draft.prefix}
                onChange={(value) => setDraft((current) => ({ ...current, prefix: value, docNo: withDocPrefix(current.docNo, value) }))}
                options={PREFIX_OPTIONS.map((item) => ({ value: item, label: item }))}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.docNo')}
              <input disabled={!canEdit} className={fieldClass} value={draft.docNo} onChange={(event) => setDraft((current) => ({ ...current, docNo: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} maxLength={80} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.date')}
              <input disabled={!canEdit} className={fieldClass} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} maxLength={80} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.subject')}
              <input disabled={!canEdit} className={fieldClass} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} maxLength={200} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.to')}
              <input disabled={!canEdit} className={fieldClass} value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} maxLength={200} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.p1')}
              <textarea disabled={!canEdit} className={`${fieldClass} min-h-24 py-3`} rows={4} maxLength={4000} value={draft.p1} onChange={(event) => setDraft((current) => ({ ...current, p1: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.p2')}
              <textarea disabled={!canEdit} className={`${fieldClass} min-h-24 py-3`} rows={4} maxLength={4000} value={draft.p2} onChange={(event) => setDraft((current) => ({ ...current, p2: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.closing')}
              <textarea disabled={!canEdit} className={`${fieldClass} min-h-20 py-3`} rows={3} maxLength={2000} value={draft.closing} onChange={(event) => setDraft((current) => ({ ...current, closing: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.signName')}
              <input disabled={!canEdit} className={fieldClass} value={draft.signName} onChange={(event) => setDraft((current) => ({ ...current, signName: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} maxLength={120} />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('memo.field.signTitle')}
              <input disabled={!canEdit} className={fieldClass} value={draft.signTitle} onChange={(event) => setDraft((current) => ({ ...current, signTitle: event.target.value }))} onFocus={enterZen} onBlur={leaveZen} maxLength={120} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btnPrimary} disabled={!canEdit}>
                {t('memo.save')}
              </button>
              <button type="button" className={btnGhost} onClick={() => exportPaper('pdf')}>
                {t('memo.export.pdf')}
              </button>
              <button type="button" className={btnGhost} onClick={() => exportPaper('jpg')}>
                {t('memo.export.jpg')}
              </button>
              {selected && canEdit ? (
                <button type="button" className={btnDanger} onClick={handleDelete}>
                  {t('common.delete')}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <div className="memo-paper-wrap mt-10 overflow-x-auto pb-8">
        <article ref={paperRef} className="memo-paper" style={paperFont}>
          <header className="memo-head">
            <img className="memo-crest" src={crest} alt="W.L.R" />
            <p className="memo-office">สำนักงานเอกสาร WLC</p>
          </header>
          <div className="memo-meta">
            <div className="memo-no">
              <span>{t('memo.paper.no')}</span> {draft.docNo || '....................'}
            </div>
            <div className="memo-date">
              <span>{t('memo.paper.date')}</span> {draft.date || '....................'}
            </div>
          </div>
          <p className="memo-line memo-subject">
            <span>{t('memo.paper.subject')}</span> {draft.subject || '....................'}
          </p>
          <p className="memo-line memo-to">
            <span>{t('memo.paper.to')}</span> {draft.to || '....................'}
          </p>
          <div className="memo-body">
            {draft.p1 ? <p>{draft.p1}</p> : <p className="memo-empty">{t('memo.paper.empty')}</p>}
            {draft.p2 ? <p>{draft.p2}</p> : null}
            {draft.closing ? <p>{draft.closing}</p> : null}
          </div>
          <figure className="memo-map-slot">
            <div className="memo-map-canvas" />
            <figcaption>{t('memo.paper.map')}</figcaption>
          </figure>
          <div className="memo-sign-row">
            <div className="memo-sign-spacer" />
            <div className="memo-stamp-cell">
              <div className="memo-stamp">
                <span>Restricted document</span>
              </div>
            </div>
            <div className="memo-sign">
              <p>{t('memo.paper.sign')}</p>
              <p className="memo-sign-space">................................</p>
              <p className="memo-sign-name">({draft.signName || '....................'})</p>
              <p className="memo-sign-role">{draft.signTitle || t('ops.auth.signer')}</p>
            </div>
          </div>
          <p className="memo-foot">W.L.C</p>
        </article>
      </div>
    </section>
  );
}
