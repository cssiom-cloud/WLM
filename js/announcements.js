import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { escapeHtml, showToast } from './ui.js';
import { t } from './i18n.js';
// SUPABASE INJECT POINT: all reads and writes go through js/announcement-service.js
import {
  deleteAnnouncement,
  fetchAnnouncementBoard,
  joinAnnouncement,
  leaveAnnouncement
} from './announcement-service.js';

let currentUser = null;
let boardCache = [];
let boardLoaded = false;

// RBAC state: role comes from the oc_personnel row of the signed-in user.
function isAdmin() {
  return currentUser?.role === 'admin';
}

function skeletonMarkup() {
  return `
    <div class="skeleton-card announcement-skeleton" aria-hidden="true">
      <div class="skeleton" style="width: 100%; height: 140px;"></div>
      <div class="skeleton skeleton-line" style="width: 55%;"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-pill" style="width: 100%;"></div>
    </div>
  `;
}

function renderSkeletons() {
  const list = document.querySelector('#announcement-list');
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = Array.from({ length: 3 }, skeletonMarkup).join('');
}

function coverMarkup(item) {
  if (item.image_url) {
    return `<img class="announcement-cover" src="${escapeHtml(item.image_url)}" alt="" loading="lazy">`;
  }
  const initial = String(item.title || 'A').trim().charAt(0).toUpperCase();
  return `<div class="announcement-cover announcement-cover-fallback" aria-hidden="true">${escapeHtml(initial)}</div>`;
}

function signupControl(item) {
  if (!currentUser) {
    return `<a class="btn" href="./login.html">${t('ann.signin')}</a>`;
  }
  if (item.is_signed) {
    return `<button class="btn" type="button" data-leave-id="${escapeHtml(item.id)}">${t('ann.withdraw')}</button>`;
  }
  if (item.signed_count >= item.max_capacity) {
    return `<button class="btn" type="button" disabled>${t('ann.full')}</button>`;
  }
  return `<button class="btn btn-primary" type="button" data-join-id="${escapeHtml(item.id)}">${t('ann.join')}</button>`;
}

// Admin-only UI: the Delete button node is rendered only when role === 'admin'.
function deleteControl(item) {
  if (!isAdmin()) {
    return '';
  }
  return `<button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(item.id)}">${t('ann.delete')}</button>`;
}

function announcementCard(item, index) {
  const percent = Math.min(100, Math.round((item.signed_count / item.max_capacity) * 100));
  const isFull = item.signed_count >= item.max_capacity;
  return `
    <article class="announcement-card" data-aos="fade-up" data-aos-delay="${Math.min(index * 60, 240)}">
      ${coverMarkup(item)}
      <div class="announcement-head">
        <h2>${escapeHtml(item.title)}</h2>
        ${
          isFull
            ? `<span class="badge badge-capacity-full">${t('ann.full')}</span>`
            : `<span class="badge badge-capacity-open">${t('ann.open')}</span>`
        }
      </div>
      <p class="announcement-content">${escapeHtml(item.content)}</p>
      <p class="announcement-date">${escapeHtml(new Date(item.created_at).toLocaleString())}</p>
      <div class="capacity-tracker" role="group" aria-label="Registration tracker">
        <div class="capacity-line">
          <span>${t('ann.signedUp')}: <strong>${item.signed_count}</strong></span>
          <span>${t('ann.max')}: <strong>${item.max_capacity}</strong></span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${item.max_capacity}" aria-valuenow="${item.signed_count}">
          <div class="progress-fill${isFull ? ' is-full' : ''}" style="width: ${percent}%;"></div>
        </div>
      </div>
      <div class="announcement-actions">
        ${signupControl(item)}
        ${deleteControl(item)}
      </div>
    </article>
  `;
}

function renderBoard() {
  const list = document.querySelector('#announcement-list');
  const empty = document.querySelector('#announcement-empty');
  list.setAttribute('aria-busy', 'false');
  list.innerHTML = boardCache.map(announcementCard).join('');
  empty.hidden = boardCache.length > 0;
  initAos();
}

async function reloadBoard() {
  boardCache = await fetchAnnouncementBoard(currentUser?.id || null);
  boardLoaded = true;
  renderBoard();
}

bootCommandShell('announcements');
renderSkeletons();

readCurrentPersonnel()
  .catch(() => ({ session: null, personnel: null }))
  .then(async ({ personnel }) => {
    currentUser = personnel;
    if (isAdmin()) {
      document.querySelector('#create-announcement-link').hidden = false;
    }
    await reloadBoard();
  })
  .catch((error) => {
    document.querySelector('#announcement-list').innerHTML = '';
    showToast(error.message, 'error', 6000);
  });

document.querySelector('#announcement-list').addEventListener('click', async (event) => {
  const joinButton = event.target.closest('[data-join-id]');
  const leaveButton = event.target.closest('[data-leave-id]');
  const deleteButton = event.target.closest('[data-delete-id]');
  if (!joinButton && !leaveButton && !deleteButton) {
    return;
  }

  try {
    if (deleteButton) {
      if (!isAdmin() || !window.confirm(t('ann.confirmDelete'))) {
        return;
      }
      await deleteAnnouncement(deleteButton.getAttribute('data-delete-id'));
      showToast(t('ann.deleted'), 'success');
    } else if (!currentUser) {
      return;
    } else if (joinButton) {
      await joinAnnouncement(joinButton.getAttribute('data-join-id'), currentUser.id);
      showToast(t('ann.joined'), 'success');
    } else {
      await leaveAnnouncement(leaveButton.getAttribute('data-leave-id'), currentUser.id);
      showToast(t('ann.withdrawn'), 'success');
    }
    await reloadBoard();
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

// Re-render dynamic cards when the TH/EN switcher changes language.
window.addEventListener('wlr-lang-changed', () => {
  if (boardLoaded) {
    renderBoard();
  }
});
