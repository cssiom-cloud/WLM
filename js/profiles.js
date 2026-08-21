import { bootCommandShell, initAos } from './shell.js';
import {
  createPersonnelProfile,
  readStoredActivePersonnelId,
  requireAuthUser,
  setActivePersonnel
} from './session.js';
import { formatPersonnelName } from './domain.js';
import { t } from './i18n.js';
import { escapeHtml, initialsFromName, showStatus } from './ui.js';

let owned = [];

function cardMarkup(record, activeId) {
  const name = formatPersonnelName(record) || t('profiles.empty');
  const rank = record.military_rank || record.organization_role || '';
  const avatar = record.avatar_url
    ? `<img src="${escapeHtml(record.avatar_url)}" alt="">`
    : `<span>${escapeHtml(initialsFromName(name))}</span>`;
  const isActive = record.id === activeId;
  return `
    <button type="button" class="profile-id-card${isActive ? ' is-active' : ''}" data-profile-id="${escapeHtml(record.id)}">
      <span class="profile-id-avatar">${avatar}</span>
      <strong>${escapeHtml(name)}</strong>
      <small>${escapeHtml(rank)}</small>
      ${isActive ? `<em>${escapeHtml(t('profiles.active'))}</em>` : ''}
    </button>
  `;
}

function renderGrid() {
  const host = document.querySelector('#profile-grid');
  const activeId = readStoredActivePersonnelId();
  host.innerHTML = owned.map((row) => cardMarkup(row, activeId)).join('');
  host.querySelectorAll('[data-profile-id]').forEach((button) => {
    button.addEventListener('click', () => selectProfile(button.getAttribute('data-profile-id'), button));
  });
}

async function selectProfile(personnelId, button) {
  if (button?.disabled) {
    return;
  }
  document.querySelectorAll('.profile-id-card').forEach((card) => {
    card.disabled = true;
  });
  button?.classList.add('is-selecting');
  try {
    await setActivePersonnel(personnelId);
    window.location.replace('./index.html');
  } catch (error) {
    showStatus(error.message, true);
    document.querySelectorAll('.profile-id-card').forEach((card) => {
      card.disabled = false;
    });
    button?.classList.remove('is-selecting');
  }
}

bootCommandShell('profiles');

requireAuthUser()
  .then((result) => {
    if (!result) {
      return;
    }
    owned = result.profiles || [];
    renderGrid();
    initAos();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#profile-register').addEventListener('submit', async (event) => {
  event.preventDefault();
  const firstName = document.querySelector('#profile-first').value.trim();
  const lastName = document.querySelector('#profile-last').value.trim();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  if (submit.disabled) {
    return;
  }
  submit.disabled = true;
  try {
    const created = await createPersonnelProfile({ firstName, lastName });
    await setActivePersonnel(created.id);
    window.location.replace('./index.html');
  } catch (error) {
    showStatus(error.message, true);
    submit.disabled = false;
  }
});

window.addEventListener('wlr-lang-changed', () => {
  renderGrid();
});
