import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { confirmNotice, escapeHtml, showToast } from './ui.js';
import { t } from './i18n.js';
// SUPABASE INJECT POINT: CRUD goes through js/content-service.js (command_documents table).
import { deleteDocument, fetchDocuments, saveDocument } from './content-service.js';

let currentUser = null;
let documents = [];
let activeId = null;
let editorMode = null; // null (view) | 'edit' | 'create'

// RBAC: admin-only controls are rendered only when role === 'admin'.
function isAdmin() {
  return currentUser?.role === 'admin';
}

// MARKDOWN PARSER INJECT POINT (viewer side):
// Replace renderMarkdown() with a full parser (marked / markdown-it via CDN,
// or react-markdown in a React build). This built-in renderer covers headings,
// bullet lists, and paragraphs only.
function renderMarkdown(markdown) {
  const lines = String(markdown).split('\n');
  const html = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(3))}</h3>`);
    } else if (line.startsWith('# ')) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(2))}</h2>`);
    } else if (line.startsWith('- ')) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else {
      closeList();
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  return html.join('');
}

function activeDocument() {
  return documents.find((doc) => doc.id === activeId) || documents[0] || null;
}

function renderNav() {
  const nav = document.querySelector('#docs-nav');
  nav.innerHTML = documents
    .map(
      (doc) => `
        <button type="button" class="docs-nav-item${doc.id === activeId ? ' is-active' : ''}" data-doc-id="${escapeHtml(doc.id)}">
          ${escapeHtml(doc.title)}
        </button>
      `
    )
    .join('');
}

function renderView() {
  const content = document.querySelector('#docs-content');
  const doc = activeDocument();
  if (!doc) {
    content.innerHTML = '<p class="empty-log">No documents.</p>';
    return;
  }
  activeId = doc.id;

  const adminBar = isAdmin()
    ? `
      <div class="docs-admin-bar">
        <button class="btn btn-xs" type="button" id="doc-edit">${t('common.edit')}</button>
        <button class="btn btn-xs btn-danger" type="button" id="doc-delete">${t('common.delete')}</button>
      </div>
    `
    : '';

  content.innerHTML = `${adminBar}${renderMarkdown(doc.markdown)}`;
  renderNav();
}

// MARKDOWN INPUT EDITOR PLACEHOLDER (admin side):
// The plain <textarea> below is where a rich Markdown editor component
// (e.g. EasyMDE / Toast UI Editor via CDN) would be mounted.
function renderEditor(mode) {
  editorMode = mode;
  const doc = mode === 'edit' ? activeDocument() : null;
  const content = document.querySelector('#docs-content');
  content.innerHTML = `
    <form id="doc-form" class="doc-editor">
      <label>Title
        <input id="doc-title" class="text-field" type="text" required maxlength="120" value="${escapeHtml(doc?.title || '')}">
      </label>
      <label>Markdown Content
        <textarea id="doc-markdown" class="text-field doc-markdown-input" rows="14">${escapeHtml(doc?.markdown || '')}</textarea>
      </label>
      <div class="btn-row">
        <button class="btn btn-primary" type="submit">${t('common.save')}</button>
        <button class="btn" type="button" id="doc-cancel">${t('common.cancel')}</button>
      </div>
    </form>
  `;

  content.querySelector('#doc-cancel').addEventListener('click', () => {
    editorMode = null;
    renderView();
  });

  content.querySelector('#doc-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin()) {
      return;
    }
    try {
      const saved = await saveDocument({
        id: editorMode === 'edit' ? activeId : null,
        title: content.querySelector('#doc-title').value.trim(),
        markdown: content.querySelector('#doc-markdown').value
      });
      documents = await fetchDocuments();
      activeId = saved.id;
      editorMode = null;
      renderView();
      showToast(t('common.save'), 'success');
    } catch (error) {
      showToast(error.message, 'error', 5000);
    }
  });
}

/* ---------- Boot ---------- */

bootCommandShell('documents');

Promise.all([
  readCurrentPersonnel().catch(() => ({ session: null, personnel: null })),
  fetchDocuments()
])
  .then(([{ personnel }, docs]) => {
    currentUser = personnel;
    documents = docs;
    activeId = documents[0]?.id || null;
    if (isAdmin()) {
      const createButton = document.querySelector('#docs-create');
      createButton.hidden = false;
      createButton.textContent = t('docs.create');
    }
    renderView();
    initAos();
  })
  .catch((error) => {
    showToast(error.message, 'error', 6000);
  });

document.querySelector('#docs-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-doc-id]');
  if (!button) {
    return;
  }
  activeId = button.getAttribute('data-doc-id');
  editorMode = null;
  renderView();
});

document.querySelector('#docs-create').addEventListener('click', () => {
  if (isAdmin()) {
    renderEditor('create');
    renderNav();
  }
});

document.querySelector('#docs-content').addEventListener('click', async (event) => {
  if (!isAdmin()) {
    return;
  }
  if (event.target.id === 'doc-edit') {
    renderEditor('edit');
  }
  if (event.target.id === 'doc-delete') {
    if (!(await confirmNotice(t('common.confirmDelete')))) {
      return;
    }
    try {
      await deleteDocument(activeId);
      documents = await fetchDocuments();
      activeId = documents[0]?.id || null;
      renderView();
      showToast(t('common.delete'), 'success');
    } catch (error) {
      showToast(error.message, 'error', 5000);
    }
  }
});

window.addEventListener('wlr-lang-changed', () => {
  if (isAdmin()) {
    document.querySelector('#docs-create').textContent = t('docs.create');
  }
  if (!editorMode) {
    renderView();
  }
});
