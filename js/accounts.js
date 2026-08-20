import { bootCommandShell, initAos } from './shell.js';
import { requireCommandAdmin } from './session.js';
import { formatPersonnelName } from './domain.js';
import { escapeHtml, initialsFromName, showStatus } from './ui.js';
import { fetchLoginAccounts, updateLoginCredentials } from './personnel-service.js';
import { t } from './i18n.js';

let rosterCache = [];
let lastQuery = '';
let revealedIds = new Set();
let editingRecord = null;

function matchesNameQuery(record, query) {
  if (!query) {
    return true;
  }
  const haystack = [formatPersonnelName(record), record.email, record.military_rank]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function passwordCell(record) {
  if (!record.has_login) {
    return `<span class="secret-muted">${escapeHtml(t('accounts.noLogin'))}</span>`;
  }
  if (record.login_password == null) {
    return `<span class="secret-muted">${escapeHtml(t('accounts.passwordHidden'))}</span>`;
  }
  const revealed = revealedIds.has(record.id);
  const value = revealed ? record.login_password : '••••••••';
  const toggleLabel = revealed ? t('accounts.hide') : t('accounts.show');
  return `
    <div class="credential-cell">
      <span class="credential-value">${escapeHtml(value)}</span>
      <button class="btn btn-inline" type="button" data-action="toggle" data-id="${escapeHtml(record.id)}">${escapeHtml(toggleLabel)}</button>
    </div>
  `;
}

function renderTable() {
  const body = document.querySelector('#accounts-table-body');
  const empty = document.querySelector('#accounts-empty');
  const wrap = document.querySelector('.table-wrap');
  const rows = rosterCache.filter((record) => matchesNameQuery(record, lastQuery));

  empty.hidden = rows.length > 0;
  wrap.hidden = rows.length === 0;
  body.innerHTML = rows
    .map((record) => {
      const name = formatPersonnelName(record) || t('units.unnamed');
      const avatar = record.avatar_url
        ? `<img class="table-avatar" src="${escapeHtml(record.avatar_url)}" alt="">`
        : `<span class="table-avatar-fallback">${escapeHtml(initialsFromName(name))}</span>`;
      return `
        <tr data-aos="fade-up">
          <td><div class="name-cell">${avatar}<span>${escapeHtml(name)}</span></div></td>
          <td><span class="credential-value">${escapeHtml(record.email || '—')}</span></td>
          <td>${passwordCell(record)}</td>
          <td>
            <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">${escapeHtml(t('accounts.edit'))}</button>
          </td>
        </tr>
      `;
    })
    .join('');

  initAos();
}

function openEditor(record) {
  editingRecord = record;
  const modal = document.querySelector('#account-modal');
  modal.classList.add('is-open');
  document.querySelector('#account-edit-name').textContent = formatPersonnelName(record) || t('units.unnamed');
  document.querySelector('#account-email').value = record.email || '';
  document.querySelector('#account-password').value = record.login_password || '';
  document.querySelector('#account-password').placeholder = record.login_password
    ? ''
    : t('accounts.newPassword');
}

function closeEditor() {
  editingRecord = null;
  document.querySelector('#account-modal').classList.remove('is-open');
}

async function persistEditor(event) {
  event.preventDefault();
  if (!editingRecord) {
    return;
  }

  const email = String(document.querySelector('#account-email').value || '').trim();
  const password = String(document.querySelector('#account-password').value || '');
  const emailUnchanged = email.toLowerCase() === String(editingRecord.email || '').toLowerCase();
  const passwordUnchanged = editingRecord.login_password != null
    ? password === editingRecord.login_password
    : password === '';

  if (!email || !email.includes('@')) {
    showStatus(t('accounts.invalidEmail'), true);
    return;
  }
  if (password && password.length < 6) {
    showStatus(t('accounts.passwordMin'), true);
    return;
  }
  if (emailUnchanged && passwordUnchanged) {
    showStatus(t('accounts.noChanges'), true);
    return;
  }
  if (!editingRecord.has_login && !password) {
    showStatus(t('accounts.createNeedsPassword'), true);
    return;
  }

  try {
    await updateLoginCredentials(editingRecord.id, {
      email,
      password: passwordUnchanged || password === '' ? '' : password
    });
    closeEditor();
    rosterCache = await fetchLoginAccounts();
    renderTable();
    showStatus(t('accounts.saved'));
  } catch (error) {
    showStatus(error.message, true);
  }
}

bootCommandShell('accounts');

requireCommandAdmin()
  .then(async (result) => {
    if (!result) {
      return;
    }
    rosterCache = await fetchLoginAccounts();
    renderTable();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#accounts-search').addEventListener('input', (event) => {
  lastQuery = String(event.target.value || '').trim().toLowerCase();
  renderTable();
});

document.querySelector('#accounts-table-body').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }
  const personnelId = button.getAttribute('data-id');
  const record = rosterCache.find((item) => item.id === personnelId);
  if (!record) {
    return;
  }
  const action = button.getAttribute('data-action');
  if (action === 'toggle') {
    if (revealedIds.has(personnelId)) {
      revealedIds.delete(personnelId);
    } else {
      revealedIds.add(personnelId);
    }
    renderTable();
    return;
  }
  if (action === 'edit') {
    openEditor(record);
  }
});

document.querySelector('#account-form').addEventListener('submit', persistEditor);
document.querySelector('#account-cancel').addEventListener('click', closeEditor);
document.querySelector('#account-modal').addEventListener('click', (event) => {
  if (event.target.id === 'account-modal') {
    closeEditor();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeEditor();
  }
});

window.addEventListener('wlr-lang-changed', () => {
  renderTable();
});
