import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { confirmNotice, escapeHtml, showToast, withOverlay } from './ui.js';
import { formatPersonnelName } from './domain.js';
import { t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';
import { canEditMemo, isDev, visibleMemoFolders } from './access.js';
import { deleteOfficialDoc, fetchOfficialDocs, saveOfficialDoc } from './memo-service.js';
import { handleMemoJPG, handleMemoPDF } from './memo-export.js';

bootCommandShell('memo');
initAos();

const FOLDER_META = {
  normal: { key: 'memo.folder.normal', hint: 'memo.folder.normalHint' },
  unit_leader: { key: 'memo.folder.leader', hint: 'memo.folder.leaderHint' },
  admin: { key: 'memo.folder.admin', hint: 'memo.folder.adminHint' },
  dev: { key: 'memo.folder.dev', hint: 'memo.folder.devHint' }
};

const DOC_PREFIX = {
  normal: 'ธด.',
  unit_leader: 'หน.',
  admin: 'อด.',
  dev: 'พธ.'
};

const DEFAULT_CLOSING = 'จึงเรียนมาด้วยเพื่อให้ทราบ และกรุณาแจ้งให้ส่วนราชการในสังกัดทราบ';

let actor = null;
let units = [];
let folders = [];
let docs = [];
let folder = 'normal';
let selectedId = null;

function fields() {
  return {
    prefix: document.querySelector('#memo-prefix'),
    docNo: document.querySelector('#memo-doc-no'),
    date: document.querySelector('#memo-doc-date'),
    subject: document.querySelector('#memo-subject'),
    to: document.querySelector('#memo-to'),
    p1: document.querySelector('#memo-p1'),
    p2: document.querySelector('#memo-p2'),
    closing: document.querySelector('#memo-closing'),
    signName: document.querySelector('#memo-sign-name'),
    signTitle: document.querySelector('#memo-sign-title')
  };
}

function prefixOf(docNo) {
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
  if (!rest) {
    return nextDocNo(folder).replace(DOC_PREFIX[folder] || DOC_PREFIX.normal, prefix);
  }
  return `${prefix} ${rest}`;
}

function buddhistYear() {
  return new Date().getFullYear() + 543;
}

function nextDocNo(folderKey) {
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
      /* Fall through and treat the stored body as a single paragraph. */
    }
  }
  return {
    paragraph1: text,
    paragraph2: '',
    closingParagraph: DEFAULT_CLOSING
  };
}

function encodeBody(paragraph1, paragraph2, closingParagraph) {
  return JSON.stringify({
    paragraph1: paragraph1 || '',
    paragraph2: paragraph2 || '',
    closingParagraph: closingParagraph || ''
  });
}

function emptyDraft() {
  const name = formatPersonnelName(actor) || '';
  return {
    id: null,
    folder,
    doc_no: nextDocNo(folder),
    doc_date: defaultThaiDate(),
    subject: '',
    addressed_to: '',
    paragraph1: '',
    paragraph2: '',
    closingParagraph: DEFAULT_CLOSING,
    sign_name: name,
    sign_title: actor?.organization_role || actor?.military_rank || '',
    logo_url: './assets/1.jpg',
    created_by: actor?.id
  };
}

function defaultThaiDate() {
  const now = new Date();
  const day = now.getDate();
  const monthsTh = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม'
  ];
  const monthsEn = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  if (document.documentElement.lang === 'th') {
    return `${day} ${monthsTh[now.getMonth()]} ${now.getFullYear() + 543}`;
  }
  return `${day} ${monthsEn[now.getMonth()]} ${now.getFullYear()}`;
}

function selectedDoc() {
  return docs.find((row) => row.id === selectedId) || null;
}

function docsInFolder() {
  return docs.filter((row) => row.folder === folder);
}

function formValues() {
  const input = fields();
  const paragraph1 = input.p1.value.trim();
  const paragraph2 = input.p2.value.trim();
  const closingParagraph = input.closing.value.trim();
  return {
    id: selectedId,
    folder,
    doc_no: withDocPrefix(input.docNo.value, input.prefix?.value || prefixOf(input.docNo.value)),
    doc_date: input.date.value.trim(),
    subject: input.subject.value.trim(),
    addressed_to: input.to.value.trim(),
    paragraph1,
    paragraph2,
    closingParagraph,
    body: encodeBody(paragraph1, paragraph2, closingParagraph),
    sign_name: input.signName.value.trim(),
    sign_title: input.signTitle.value.trim(),
    logo_url: selectedDoc()?.logo_url || './assets/1.jpg',
    created_by: selectedDoc()?.created_by || actor.id
  };
}

function fillForm(doc) {
  const input = fields();
  const parts = doc.paragraph1 != null ? doc : { ...doc, ...parseBody(doc.body) };
  input.docNo.value = doc.doc_no || nextDocNo(folder);
  if (input.prefix) {
    input.prefix.value = prefixOf(input.docNo.value);
  }
  input.date.value = doc.doc_date || defaultThaiDate();
  input.subject.value = doc.subject || '';
  input.to.value = doc.addressed_to || '';
  input.p1.value = parts.paragraph1 || '';
  input.p2.value = parts.paragraph2 || '';
  input.closing.value = parts.closingParagraph || DEFAULT_CLOSING;
  input.signName.value = doc.sign_name || '';
  input.signTitle.value = doc.sign_title || '';
  const canEdit = canEditMemo(actor, { ...doc, folder }, units) || !doc.id;
  document.querySelector('#memo-form').querySelectorAll('input, textarea, button[type="submit"]').forEach((node) => {
    node.disabled = !canEdit && Boolean(doc.id);
  });
  const del = document.querySelector('#memo-delete');
  del.hidden = !doc.id || !canEditMemo(actor, doc, units);
}

function paragraphHtml(text, fallback) {
  const value = String(text || '').trim();
  if (!value) {
    return fallback ? `<p class="memo-empty">${escapeHtml(fallback)}</p>` : '';
  }
  return `<p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
}

function renderPaper(doc) {
  const host = document.querySelector('#memo-paper');
  const logo = doc.logo_url || './assets/1.jpg';
  const parts = {
    paragraph1: doc.paragraph1 ?? parseBody(doc.body).paragraph1,
    paragraph2: doc.paragraph2 ?? parseBody(doc.body).paragraph2,
    closingParagraph: doc.closingParagraph ?? parseBody(doc.body).closingParagraph
  };
  host.innerHTML = `
    <p class="memo-office">สำนักงานเอกสาร WLC</p>
    <img class="memo-crest" src="${escapeHtml(logo)}" alt="W.L.R">
    <div class="memo-meta">
      <div class="memo-no"><span>${escapeHtml(t('memo.paper.no'))}</span> ${escapeHtml(doc.doc_no || '....................')}</div>
      <div class="memo-date"><span>${escapeHtml(t('memo.paper.date'))}</span> ${escapeHtml(doc.doc_date || '....................')}</div>
    </div>
    <p class="memo-line memo-subject"><span>${escapeHtml(t('memo.paper.subject'))}</span> ${escapeHtml(doc.subject || '....................')}</p>
    <p class="memo-line memo-to"><span>${escapeHtml(t('memo.paper.to'))}</span> ${escapeHtml(doc.addressed_to || '....................')}</p>
    <div class="memo-body">
      ${paragraphHtml(parts.paragraph1, t('memo.paper.empty'))}
      ${paragraphHtml(parts.paragraph2)}
      ${paragraphHtml(parts.closingParagraph)}
    </div>
    <figure class="memo-map-slot">
      <div class="memo-map-canvas" data-memo-map role="img" aria-label="${escapeHtml(t('memo.paper.map'))}"></div>
      <figcaption>${escapeHtml(t('memo.paper.map'))}</figcaption>
    </figure>
    <div class="memo-sign-row">
      <div class="memo-sign-spacer"></div>
      <div class="memo-sign">
        <p>${escapeHtml(t('memo.paper.sign'))}</p>
        <p class="memo-sign-space">................................</p>
        <p class="memo-sign-name">(${escapeHtml(doc.sign_name || '....................')})</p>
        <p class="memo-sign-role">${escapeHtml(doc.sign_title || '')}</p>
      </div>
    </div>
    <p class="memo-foot">W.L.C</p>
  `;
}

function renderFolders() {
  const nav = document.querySelector('#memo-folder-nav');
  nav.innerHTML = folders
    .filter((key) => key !== 'dev' || isDev(actor))
    .map((key) => {
      // Dev check: the Dev folder is omitted from `folders` unless isDev(actor).
      const meta = FOLDER_META[key];
      return `
        <button type="button" class="memo-folder${key === folder ? ' is-active' : ''}" data-folder="${key}">
          ${escapeHtml(t(meta.key))}
        </button>
      `;
    })
    .join('');
}

function renderList() {
  const host = document.querySelector('#memo-list');
  const rows = docsInFolder();
  const meta = FOLDER_META[folder];
  document.querySelector('#memo-folder-title').textContent = t(meta.key);
  document.querySelector('#memo-folder-hint').textContent = t(meta.hint);
  if (!rows.length) {
    host.innerHTML = `<p class="empty-log">${escapeHtml(t('memo.empty'))}</p>`;
    return;
  }
  host.innerHTML = rows
    .map((row) => {
      const title = row.subject || t('memo.untitled');
      return `
        <button type="button" class="memo-item${row.id === selectedId ? ' is-active' : ''}" data-doc-id="${escapeHtml(row.id)}">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(row.doc_no || t('memo.noNumber'))}</small>
        </button>
      `;
    })
    .join('');
}

function renderAll() {
  renderFolders();
  renderList();
  const doc = selectedDoc() || emptyDraft();
  fillForm(doc);
  renderPaper(formValues());
}

async function refreshDocs() {
  docs = await fetchOfficialDocs();
  if (selectedId && !docs.some((row) => row.id === selectedId)) {
    selectedId = null;
  }
}

async function boot() {
  const session = await requireAuthenticatedPersonnel();
  if (!session) {
    return;
  }
  actor = session.personnel;
  const board = await fetchUnitBoard().catch(() => ({ units: [] }));
  units = board.units || [];
  folders = visibleMemoFolders(actor, units);
  if (!folders.length) {
    folders = ['normal'];
  }
  folder = folders[0];
  await refreshDocs();
  renderAll();
}

document.querySelector('#memo-folder-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-folder]');
  if (!button) {
    return;
  }
  folder = button.getAttribute('data-folder');
  selectedId = null;
  fillForm(emptyDraft());
  renderAll();
});

document.querySelector('#memo-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-doc-id]');
  if (!button) {
    return;
  }
  selectedId = button.getAttribute('data-doc-id');
  renderAll();
});

document.querySelector('#memo-new').addEventListener('click', () => {
  selectedId = null;
  fillForm(emptyDraft());
  renderPaper(formValues());
  renderList();
});

document.querySelector('#memo-form').addEventListener('input', (event) => {
  const input = fields();
  if (event.target.id === 'memo-prefix' && input.prefix) {
    input.docNo.value = withDocPrefix(input.docNo.value, input.prefix.value);
  }
  renderPaper(formValues());
});

document.querySelector('#memo-prefix')?.addEventListener('change', () => {
  const input = fields();
  input.docNo.value = withDocPrefix(input.docNo.value, input.prefix.value);
  renderPaper(formValues());
});

document.querySelector('#memo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const draft = formValues();
  if (!draft.subject) {
    showToast(t('memo.subjectRequired'), 'error');
    return;
  }
  try {
    const saved = await withOverlay(() => saveOfficialDoc(draft, actor.id), t('notice.saving'));
    selectedId = saved.id;
    await refreshDocs();
    renderAll();
    showToast(t('memo.saved'), 'success');
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

document.querySelector('#memo-delete').addEventListener('click', async () => {
  const doc = selectedDoc();
  if (!doc || !(await confirmNotice(t('common.confirmDelete')))) {
    return;
  }
  try {
    await withOverlay(() => deleteOfficialDoc(doc.id), t('notice.saving'));
    selectedId = null;
    await refreshDocs();
    fillForm(emptyDraft());
    renderAll();
    showToast(t('memo.deleted'), 'success');
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

document.querySelector('#memo-export-pdf').addEventListener('click', () => {
  renderPaper(formValues());
  handleMemoPDF({ subject: fields().subject.value });
});

document.querySelector('#memo-export-jpg').addEventListener('click', () => {
  renderPaper(formValues());
  handleMemoJPG({ subject: fields().subject.value });
});

window.addEventListener('wlr-lang-changed', () => {
  if (!actor) {
    return;
  }
  renderAll();
});

withOverlay(() => boot(), t('notice.loading')).catch((error) => {
  showToast(error.message, 'error', 5000);
});
