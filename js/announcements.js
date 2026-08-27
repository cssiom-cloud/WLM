import { bootCommandShell, initAos } from './shell.js';
import { bindTiltTargets } from './effects.js';
import { readCurrentPersonnel } from './session.js';
import { confirmNotice, escapeHtml, initialsFromName, showToast } from './ui.js';
import { t } from './i18n.js';
import { formatPersonnelName } from './domain.js';
import { visiblePersonnel } from './access.js';
import { capacityFillRatio, isAnnouncementFull, isCapacityLimited } from './announce-meta.js';
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
  if (isAnnouncementFull(item)) {
    return `<button class="btn" type="button" disabled>${t('ann.full')}</button>`;
  }
  return `<button class="btn btn-primary" type="button" data-join-id="${escapeHtml(item.id)}">${t('ann.join')}</button>`;
}

function statusBadge(item) {
  if (isClosed(item)) {
    return `<span class="badge badge-capacity-closed">${t('ann.closed')}</span>`;
  }
  if (isAnnouncementFull(item)) {
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

function capacityGlass(item) {
  const limited = isCapacityLimited(item);
  const fill = Math.round(capacityFillRatio(item) * 100);
  const full = isAnnouncementFull(item);
  const count = limited
    ? `<strong>${item.signed_count}</strong><span> / ${item.max_capacity}</span>`
    : `<strong>${item.signed_count}</strong>`;
  return `
    <div class="ann-glass is-sm${full ? ' is-full' : ''}">
      <div class="ann-glass-cup" role="progressbar" aria-valuemin="0" aria-valuenow="${item.signed_count}"${
        limited ? ` aria-valuemax="${item.max_capacity}"` : ''
      }>
        <div class="ann-glass-water" style="--fill: ${fill}%">
          <span class="ann-glass-fill" aria-hidden="true">
            <span class="ann-glass-blob"></span>
            <span class="ann-glass-blob is-alt"></span>
          </span>
          <svg class="ann-glass-surf" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
            <path class="ann-glass-surf-a" d="M0 40C150 8 350 72 600 40C850 8 1050 72 1200 40V80H0Z"></path>
            <path class="ann-glass-surf-b" d="M0 52C150 78 350 26 600 52C850 78 1050 26 1200 52V80H0Z"></path>
          </svg>
          <svg class="ann-glass-surf is-late" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
            <path class="ann-glass-surf-a" d="M0 40C150 8 350 72 600 40C850 8 1050 72 1200 40V80H0Z"></path>
            <path class="ann-glass-surf-b" d="M0 52C150 78 350 26 600 52C850 78 1050 26 1200 52V80H0Z"></path>
          </svg>
          <span class="ann-glass-bubbles" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
        </div>
        <span class="ann-glass-shine" aria-hidden="true"></span>
      </div>
      <div>
        <p class="ann-glass-count">${count}</p>
        <p class="ann-glass-label">${escapeHtml(limited ? t('ann.signedUp') : t('ann.unlimited'))}</p>
      </div>
    </div>
  `;
}

function participantRoster(item) {
  if (item.show_participants === false && !isAdmin()) {
    return `<p class="announcement-date">${escapeHtml(t('ann.hiddenSignups'))}</p>`;
  }
  const people = visiblePersonnel(item.participants || [], currentUser);
  if (!people.length) {
    return `<p class="announcement-date">${escapeHtml(t('ann.noSignups'))}</p>`;
  }
  return `
    <ul class="ann-roster">
      ${people
        .map((person) => {
          const name = formatPersonnelName(person) || t('profiles.empty');
          const avatar = person.avatar_url
            ? `<img class="ann-roster-avatar" src="${escapeHtml(person.avatar_url)}" alt="">`
            : `<span class="ann-roster-avatar ann-roster-fallback">${escapeHtml(initialsFromName(name))}</span>`;
          return `<li><a class="ann-roster-person" href="./directory.html"><span>${avatar}</span><span><p class="ann-roster-name">${escapeHtml(
            name
          )}</p><p class="ann-roster-rank">${escapeHtml(person.military_rank || person.organization_role || '—')}</p></span></a></li>`;
        })
        .join('')}
    </ul>
  `;
}

function announcementCard(item, index) {
  return `
    <article id="announcement-${escapeHtml(item.id)}" class="announcement-card"${window.AOS ? ` data-aos="fade-up" data-aos-delay="${Math.min(index * 60, 240)}"` : ''}>
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
        ${capacityGlass(item)}
        ${participantRoster(item)}
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

  // Check if URL has ?id=... to auto-scroll and highlight
  const targetId = new URLSearchParams(window.location.search).get('id') || (window.location.hash || '').replace(/^#/, '').replace(/^announcement-/, '');
  if (targetId) {
    window.requestAnimationFrame(() => {
      const targetCard = document.querySelector(`#announcement-${targetId}`) || document.querySelector(`[data-join-id="${targetId}"]`)?.closest('.announcement-card');
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease, transform 0.4s ease';
        targetCard.style.borderColor = 'var(--accent)';
        targetCard.style.boxShadow = '0 0 0 3px var(--accent-soft), 0 10px 30px rgba(0,0,0,0.3)';
        targetCard.style.transform = 'translateY(-4px)';
        setTimeout(() => {
          targetCard.style.transform = '';
        }, 800);
      }
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
