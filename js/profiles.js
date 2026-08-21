import { bootCommandShell } from './shell.js';
import {
  createPersonnelProfile,
  readStoredActivePersonnelId,
  requireAuthUser,
  setActivePersonnel
} from './session.js';
import { formatPersonnelName } from './domain.js';
import { t } from './i18n.js';
import { escapeHtml, initialsFromName, showStatus } from './ui.js';
import { bindTiltTargets } from './effects.js';
import { bindSpotlightCards, revealBlurText, staggerIn } from './motion.js';

let owned = [];

function cardMarkup(record, activeId, index) {
  const name = formatPersonnelName(record) || t('profiles.empty');
  const rank = record.military_rank || record.organization_role || '';
  const avatar = record.avatar_url
    ? `<img class="card-avatar" src="${escapeHtml(record.avatar_url)}" alt="">`
    : `<div class="card-avatar-fallback" aria-hidden="true">${escapeHtml(initialsFromName(name))}</div>`;
  const isActive = record.id === activeId;
  return `
    <button type="button" class="gallery-card profile-pick-card${isActive ? ' is-active' : ''}" style="--stagger:${index}" data-profile-id="${escapeHtml(record.id)}">
      <div class="gallery-card-media">
        ${avatar}
        <span class="gallery-card-glare" aria-hidden="true"></span>
      </div>
      <div class="gallery-card-body">
        <h2>${escapeHtml(name)}</h2>
        <p class="card-sub">${escapeHtml(rank)}</p>
        ${isActive ? `<p class="card-sub">${escapeHtml(t('profiles.active'))}</p>` : ''}
      </div>
    </button>
  `;
}

function renderGrid() {
  const host = document.querySelector('#profile-grid');
  const activeId = readStoredActivePersonnelId();
  host.innerHTML = owned.map((row, index) => cardMarkup(row, activeId, index)).join('');
  staggerIn(host, '.profile-pick-card');
  bindTiltTargets('.profile-pick-card');
  bindSpotlightCards('.profile-pick-card');
  host.querySelectorAll('[data-profile-id]').forEach((button) => {
    button.addEventListener('click', () => selectProfile(button.getAttribute('data-profile-id'), button));
  });
}

async function selectProfile(personnelId, button) {
  if (button?.disabled) {
    return;
  }
  document.querySelectorAll('.profile-pick-card').forEach((card) => {
    card.disabled = true;
  });
  button?.classList.add('is-selecting');
  try {
    await setActivePersonnel(personnelId);
    window.location.replace('./index.html');
  } catch (error) {
    showStatus(error.message, true);
    document.querySelectorAll('.profile-pick-card').forEach((card) => {
      card.disabled = false;
    });
    button?.classList.remove('is-selecting');
  }
}

bootCommandShell('profiles');
revealBlurText(document.querySelector('.page-title'));

requireAuthUser()
  .then((result) => {
    if (!result) {
      return;
    }
    owned = result.profiles || [];
    renderGrid();
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
  revealBlurText(document.querySelector('.page-title'));
  renderGrid();
});
