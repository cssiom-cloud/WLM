import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { escapeHtml, showToast } from './ui.js';
import { t } from './i18n.js';
// SUPABASE INJECT POINT: CRUD goes through js/content-service.js (lore_entries table).
import { deleteLoreEntry, fetchLoreEntries, saveLoreEntry } from './content-service.js';

let currentUser = null;
let entries = [];
let editingId = null;

// Field labels per category so the same table row model fits all three sections.
const CATEGORY_META = {
  timeline: { meta1: 'Era', meta2: null },
  geopolitics: { meta1: 'Standing', meta2: null },
  naval: { meta1: 'Type', meta2: 'Complement' }
};

// RBAC: admin-only controls are rendered only when role === 'admin'.
function isAdmin() {
  return currentUser?.role === 'admin';
}

function adminControls(entry) {
  if (!isAdmin()) {
    return '';
  }
  return `
    <span class="lore-admin-controls">
      <button class="btn btn-xs" type="button" data-lore-edit="${escapeHtml(entry.id)}">${t('common.edit')}</button>
      <button class="btn btn-xs btn-danger" type="button" data-lore-delete="${escapeHtml(entry.id)}">${t('common.delete')}</button>
    </span>
  `;
}

function byCategory(category) {
  return entries
    .filter((entry) => entry.category === category)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function renderTimeline() {
  const rows = byCategory('timeline');
  document.querySelector('#lore-timeline').innerHTML = rows.length
    ? `<ol class="lore-timeline">${rows
        .map(
          (entry) => `
            <li class="lore-event">
              <time>${escapeHtml(entry.meta1 || '')}</time>
              <h3>${escapeHtml(entry.title)} ${adminControls(entry)}</h3>
              <p>${escapeHtml(entry.body || '')}</p>
            </li>
          `
        )
        .join('')}</ol>`
    : '<p class="empty-log">No entries.</p>';
}

function renderTable(category, targetId, headers) {
  const rows = byCategory(category);
  const target = document.querySelector(targetId);
  if (!rows.length) {
    target.innerHTML = '<p class="empty-log">No entries.</p>';
    return;
  }
  const showMeta2 = Boolean(CATEGORY_META[category].meta2);
  target.innerHTML = `
    <div class="table-wrap">
      <table class="personnel-table lore-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}${isAdmin() ? '<th>Action</th>' : ''}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (entry) => `
                <tr>
                  <td>${escapeHtml(entry.title)}</td>
                  <td>${escapeHtml(entry.meta1 || '')}</td>
                  ${showMeta2 ? `<td>${escapeHtml(entry.meta2 || '')}</td>` : ''}
                  <td>${escapeHtml(entry.body || '')}</td>
                  ${isAdmin() ? `<td>${adminControls(entry)}</td>` : ''}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAll() {
  renderTimeline();
  renderTable('geopolitics', '#lore-geopolitics', ['Nation', 'Standing', 'Notes']);
  renderTable('naval', '#lore-naval', ['Class', 'Type', 'Complement', 'Primary role']);
  initAos();
}

/* ---------- Admin editor modal ---------- */

function syncCategoryFields() {
  const category = document.querySelector('#lore-category').value;
  const meta = CATEGORY_META[category];
  document.querySelector('#lore-meta1-label').firstChild.textContent = meta.meta1;
  const meta2Label = document.querySelector('#lore-meta2-label');
  meta2Label.hidden = !meta.meta2;
  if (meta.meta2) {
    meta2Label.firstChild.textContent = meta.meta2;
  }
}

function openEditor(entry = null) {
  editingId = entry?.id || null;
  document.querySelector('#lore-modal-title').textContent = entry ? t('common.edit') : t('lore.addTopic');
  document.querySelector('#lore-category').value = entry?.category || 'timeline';
  document.querySelector('#lore-category').disabled = Boolean(entry);
  document.querySelector('#lore-title').value = entry?.title || '';
  document.querySelector('#lore-meta1').value = entry?.meta1 || '';
  document.querySelector('#lore-meta2').value = entry?.meta2 || '';
  document.querySelector('#lore-body').value = entry?.body || '';
  document.querySelector('#lore-order').value = entry?.sort_order ?? 0;
  syncCategoryFields();
  document.querySelector('#lore-modal').classList.add('is-open');
}

function closeEditor() {
  editingId = null;
  document.querySelector('#lore-modal').classList.remove('is-open');
}

/* ---------- Boot ---------- */

bootCommandShell('lore');

Promise.all([
  readCurrentPersonnel().catch(() => ({ session: null, personnel: null })),
  fetchLoreEntries()
])
  .then(([{ personnel }, loreEntries]) => {
    currentUser = personnel;
    entries = loreEntries;
    if (isAdmin()) {
      const addButton = document.querySelector('#lore-add');
      addButton.hidden = false;
      addButton.textContent = t('lore.addTopic');
    }
    renderAll();
  })
  .catch((error) => {
    showToast(error.message, 'error', 6000);
  });

document.querySelector('#lore-add').addEventListener('click', () => openEditor());
document.querySelector('#lore-cancel').addEventListener('click', closeEditor);
document.querySelector('#lore-category').addEventListener('change', syncCategoryFields);
document.querySelector('#lore-modal').addEventListener('click', (event) => {
  if (event.target.id === 'lore-modal') {
    closeEditor();
  }
});

document.querySelector('#lore-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin()) {
    return;
  }
  try {
    await saveLoreEntry({
      id: editingId,
      category: document.querySelector('#lore-category').value,
      title: document.querySelector('#lore-title').value.trim(),
      meta1: document.querySelector('#lore-meta1').value.trim() || null,
      meta2: document.querySelector('#lore-meta2').value.trim() || null,
      body: document.querySelector('#lore-body').value.trim() || null,
      sort_order: Number(document.querySelector('#lore-order').value) || 0
    });
    closeEditor();
    entries = await fetchLoreEntries();
    renderAll();
    showToast(t('common.save'), 'success');
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

document.querySelector('main').addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-lore-edit]');
  const deleteButton = event.target.closest('[data-lore-delete]');
  if (!editButton && !deleteButton) {
    return;
  }
  if (!isAdmin()) {
    return;
  }

  try {
    if (editButton) {
      const entry = entries.find((item) => item.id === editButton.getAttribute('data-lore-edit'));
      if (entry) {
        openEditor(entry);
      }
      return;
    }
    if (!window.confirm(t('common.confirmDelete'))) {
      return;
    }
    await deleteLoreEntry(deleteButton.getAttribute('data-lore-delete'));
    entries = await fetchLoreEntries();
    renderAll();
    showToast(t('common.delete'), 'success');
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

window.addEventListener('wlr-lang-changed', () => {
  if (isAdmin()) {
    document.querySelector('#lore-add').textContent = t('lore.addTopic');
  }
  renderAll();
});
