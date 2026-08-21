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

let actor = null;
let units = [];
let folders = [];
let docs = [];
let folder = 'normal';
let selectedId = null;

function fields() {
  return {
    docNo: document.querySelector('#memo-doc-no'),
    date: document.querySelector('#memo-doc-date'),
    subject: document.querySelector('#memo-subject'),
    to: document.querySelector('#memo-to'),
    body: document.querySelector('#memo-body'),
    signName: document.querySelector('#memo-sign-name'),
    signTitle: document.querySelector('#memo-sign-title')
  };
}

function emptyDraft() {
  const name = formatPersonnelName(actor) || '';
  return {
    id: null,
    folder,
    doc_no: '',
    doc_date: defaultThaiDate(),
    subject: '',
    addressed_to: '',
    body: '',
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
  return {
    id: selectedId,
    folder,
    doc_no: input.docNo.value.trim(),
    doc_date: input.date.value.trim(),
    subject: input.subject.value.trim(),
    addressed_to: input.to.value.trim(),
    body: input.body.value.trim(),
    sign_name: input.signName.value.trim(),
    sign_title: input.signTitle.value.trim(),
    logo_url: selectedDoc()?.logo_url || './assets/1.jpg',
    created_by: selectedDoc()?.created_by || actor.id
  };
}

function fillForm(doc) {
  const input = fields();
  input.docNo.value = doc.doc_no || '';
  input.date.value = doc.doc_date || defaultThaiDate();
  input.subject.value = doc.subject || '';
  input.to.value = doc.addressed_to || '';
  input.body.value = doc.body || '';
  input.signName.value = doc.sign_name || '';
  input.signTitle.value = doc.sign_title || '';
  const canEdit = canEditMemo(actor, { ...doc, folder }, units) || !doc.id;
  document.querySelector('#memo-form').querySelectorAll('input, textarea, button[type="submit"]').forEach((node) => {
    if (node.id === 'memo-export-pdf' || node.id === 'memo-export-jpg') {
      return;
    }
    node.disabled = !canEdit && Boolean(doc.id);
  });
  const del = document.querySelector('#memo-delete');
  del.hidden = !doc.id || !canEditMemo(actor, doc, units);
}

function bodyHtml(text) {
  const blocks = escapeHtml(text || '').split(/\n{2,}/);
  if (!blocks.filter(Boolean).length) {
    return `<p class="memo-empty">${escapeHtml(t('memo.paper.empty'))}</p>`;
  }
  return blocks.map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`).join('');
}

function renderPaper(doc) {
  const host = document.querySelector('#memo-paper');
  const logo = doc.logo_url || './assets/1.jpg';
  host.innerHTML = `
    <img class="memo-crest" src="${escapeHtml(logo)}" alt="W.L.R">
    <header class="memo-meta">
      <p class="memo-no"><span>${escapeHtml(t('memo.paper.no'))}</span> ${escapeHtml(doc.doc_no || '....................')}</p>
      <p class="memo-date"><span>${escapeHtml(t('memo.paper.date'))}</span> ${escapeHtml(doc.doc_date || '....................')}</p>
    </header>
    <p class="memo-line"><span>${escapeHtml(t('memo.paper.subject'))}</span> ${escapeHtml(doc.subject || '....................')}</p>
    <p class="memo-line"><span>${escapeHtml(t('memo.paper.to'))}</span> ${escapeHtml(doc.addressed_to || '....................')}</p>
    <div class="memo-body">${bodyHtml(doc.body)}</div>
    <div class="memo-sign">
      <p>${escapeHtml(t('memo.paper.sign'))}</p>
      <p class="memo-sign-space">................................</p>
      <p>(${escapeHtml(doc.sign_name || '....................')})</p>
      <p>${escapeHtml(doc.sign_title || '')}</p>
    </div>
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

document.querySelector('#memo-form').addEventListener('input', () => {
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
