import { bootCommandShell, initAos } from './shell.js';
import { bindTiltTargets } from './effects.js';
import { readCurrentPersonnel } from './session.js';
import { confirmNotice, escapeHtml, showToast } from './ui.js';
import { t } from './i18n.js';
// SUPABASE INJECT POINT: all reads and writes go through js/announcement-service.js
import {
  closeAnnouncement,
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
      <div class="skeleton announcement-cover"></div>
      <div class="announcement-body">
        <div class="skeleton skeleton-line" style="width: 55%;"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-pill" style="width: 40%;"></div>
      </div>
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

function isClosed(item) {
  return Boolean(item.ended_at);
}

function signupControl(item) {
  if (isClosed(item)) {
    return `<button class="btn" type="button" disabled>${t('ann.closed')}</button>`;
  }
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

function statusBadge(item) {
  if (isClosed(item)) {
    return `<span class="badge badge-capacity-closed">${t('ann.closed')}</span>`;
  }
  if (item.signed_count >= item.max_capacity) {
    return `<span class="badge badge-capacity-full">${t('ann.full')}</span>`;
  }
  return `<span class="badge badge-capacity-open">${t('ann.open')}</span>`;
}

// Admin-only UI: Close and Delete are rendered only when role === 'admin'.
function adminControls(item) {
  if (!isAdmin()) {
    return '';
  }
  const closeButton = isClosed(item)
    ? ''
    : `<button class="btn" type="button" data-close-id="${escapeHtml(item.id)}">${t('ann.close')}</button>`;
  return `
    ${closeButton}
    <a class="btn" href="./announce-create.html?id=${encodeURIComponent(item.id)}">${t('ann.edit')}</a>
    <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(item.id)}">${t('ann.delete')}</button>
  `;
}

function honorNote(item) {
  if (!item.award_honor_enabled || !item.honor_rank_title) {
    return '';
  }
  const label = isClosed(item) ? t('ann.honorAwarded') : t('ann.honorPending');
  return `<p class="announcement-honor">${escapeHtml(label)}: <strong>${escapeHtml(item.honor_rank_title)}</strong></p>`;
}

function announcementCard(item, index) {
  const percent = Math.min(100, Math.round((item.signed_count / item.max_capacity) * 100));
  const isFull = item.signed_count >= item.max_capacity;
  return `
    <article class="announcement-card"${window.AOS ? ` data-aos="fade-up" data-aos-delay="${Math.min(index * 60, 240)}"` : ''}>
      <span class="card-glare" aria-hidden="true"></span>
      ${coverMarkup(item)}
      <div class="announcement-body">
        <div class="announcement-head">
          <h2>${escapeHtml(item.title)}</h2>
          ${statusBadge(item)}
        </div>
        <p class="announcement-content">${escapeHtml(item.content)}</p>
        ${honorNote(item)}
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
          ${adminControls(item)}
        </div>
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
  bindTiltTargets('.announcement-card');
  if (window.AOS) {
    window.requestAnimationFrame(() => {
      initAos();
      window.AOS.refreshHard?.();
    });
  }
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
    const list = document.querySelector('#announcement-list');
    const empty = document.querySelector('#announcement-empty');
    list.innerHTML = '';
    list.setAttribute('aria-busy', 'false');
    if (empty) {
      empty.hidden = false;
    }
    showToast(error.message, 'error', 6000);
  });

document.querySelector('#announcement-list').addEventListener('click', async (event) => {
  const joinButton = event.target.closest('[data-join-id]');
  const leaveButton = event.target.closest('[data-leave-id]');
  const deleteButton = event.target.closest('[data-delete-id]');
  const closeButton = event.target.closest('[data-close-id]');
  if (!joinButton && !leaveButton && !deleteButton && !closeButton) {
    return;
  }

  try {
    if (closeButton) {
      if (!isAdmin()) {
        return;
      }
      if (!(await confirmNotice(t('ann.confirmClose')))) {
        return;
      }
      const result = await closeAnnouncement(closeButton.getAttribute('data-close-id'));
      const awarded = Number(result?.awarded || 0);
      showToast(awarded > 0 ? t('ann.closedWithHonor') : t('ann.closedOk'), 'success');
    } else if (deleteButton) {
      if (!isAdmin()) {
        return;
      }
      if (!(await confirmNotice(t('ann.confirmDelete')))) {
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
