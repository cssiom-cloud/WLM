import { bootCommandShell, initAos } from './shell.js';
import { biographyParagraphs, formatPersonnelName, rankSortOrder } from './domain.js';
import { escapeHtml, initialsFromName, showToast } from './ui.js';
import { t } from './i18n.js';
// Supabase fetch logic lives in these two services.
// fetchPersonnelRoster() -> supabase.from('oc_personnel').select('*') sorted by rank
// fetchSettingsMap()     -> supabase.from('user_settings').select('*') for bio privacy
// Both fall back to local test data automatically when js/config.js has no keys.
import { fetchPersonnelRoster } from './personnel-service.js';
import { fetchSettingsMap } from './command-services.js';
import { bindTiltTargets } from './effects.js';
import { fetchUnitBoard } from './unit-service.js';

const SKELETON_COUNT = 8;

let rosterCache = [];
let settingsMap = {};
let lastQuery = '';
let unitBoard = { units: [], ranks: [] };

function unitNameFor(record) {
  return unitBoard.units.find((unit) => unit.id === record.unit_id)?.name || record.wlc_agency || '';
}

function unitRankFor(record) {
  return unitBoard.ranks.find((rank) => rank.id === record.unit_rank_id)?.title || '';
}

/* ---------- Badges ---------- */

function branchBadge(branch) {
  if (!branch) {
    return '';
  }
  const tone = branch === 'Marines' ? 'marines' : 'navy';
  return `<span class="badge badge-branch-${tone}">${escapeHtml(branch)}</span>`;
}

function rankTier(rank) {
  const order = rankSortOrder(rank);
  if (order <= 5) {
    return 'command';
  }
  if (order <= 7) {
    return 'officer';
  }
  if (order <= 12) {
    return 'enlisted';
  }
  return 'academy';
}

function rankBadge(rank) {
  if (!rank) {
    return '';
  }
  return `<span class="badge badge-rank-${rankTier(rank)}">${escapeHtml(rank)}</span>`;
}

function honorChips(record) {
  const ranks = Array.isArray(record.honor_ranks) ? record.honor_ranks : [];
  return ranks.map((rank) => `<span class="honor-chip">${escapeHtml(rank)}</span>`).join('');
}

/* ---------- Card rendering ---------- */

function avatarMarkup(record, className = 'card-avatar') {
  const name = formatPersonnelName(record);
  if (record.avatar_url) {
    return `<img class="${className}" src="${escapeHtml(record.avatar_url)}" alt="${escapeHtml(name || 'Personnel avatar')}" loading="lazy">`;
  }
  return `<div class="${className}-fallback" aria-hidden="true">${escapeHtml(initialsFromName(name))}</div>`;
}

function cardMarkup(record, index) {
  const name = formatPersonnelName(record) || 'Unassigned name';
  return `
    <article class="personnel-card" data-aos="fade-up" data-aos-delay="${Math.min(index * 40, 240)}">
      ${avatarMarkup(record)}
      <h2>${escapeHtml(name)}</h2>
      <p class="card-sub">${escapeHtml(unitNameFor(record) || record.organization_role || '')}</p>
      <div class="card-badges">
        ${rankBadge(record.military_rank)}
        ${branchBadge(record.military_branch)}
        ${honorChips(record)}
      </div>
      <button class="btn" type="button" data-view-id="${escapeHtml(record.id)}" aria-label="View profile of ${escapeHtml(name)}">
        ${t('dir.view')}
      </button>
    </article>
  `;
}

function skeletonMarkup() {
  return `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line skeleton-line-short"></div>
      <div class="skeleton skeleton-pill"></div>
    </div>
  `;
}

function renderSkeletons() {
  const grid = document.querySelector('#directory-grid');
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = Array.from({ length: SKELETON_COUNT }, skeletonMarkup).join('');
}

function matchesQuery(record, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    formatPersonnelName(record),
    record.military_rank,
    record.military_branch,
    record.wlc_agency,
    unitNameFor(record),
    unitRankFor(record),
    ...(Array.isArray(record.honor_ranks) ? record.honor_ranks : [])
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function renderDirectory(query = '') {
  lastQuery = query;
  const grid = document.querySelector('#directory-grid');
  const empty = document.querySelector('#directory-empty');
  const filtered = rosterCache.filter((record) => matchesQuery(record, query));

  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = filtered.map(cardMarkup).join('');
  empty.hidden = filtered.length > 0;

  initAos();
  bindTiltTargets('.personnel-card');
}

/* ---------- Service record & achievements ---------- */

function serviceRecordMarkup(record) {
  const missions = Array.isArray(record.completed_missions) ? record.completed_missions : [];
  const medals = Array.isArray(record.medals) ? record.medals : [];
  const honorRanks = Array.isArray(record.honor_ranks) ? record.honor_ranks : [];

  const missionList = missions.length
    ? `<ol class="mission-timeline">${missions
        .map((mission) => `<li>${escapeHtml(mission)}</li>`)
        .join('')}</ol>`
    : `<p class="empty-log">${t('dir.noRecord')}</p>`;

  const medalList = medals.length
    ? `<div class="medal-row">${medals
        .map((medal) => `<span class="medal-chip">${escapeHtml(medal)}</span>`)
        .join('')}</div>`
    : `<p class="empty-log">${t('dir.noRecord')}</p>`;

  const honorList = honorRanks.length
    ? `<div class="medal-row">${honorRanks
        .map((rank) => `<span class="honor-chip">${escapeHtml(rank)}</span>`)
        .join('')}</div>`
    : `<p class="empty-log">${t('dir.noRecord')}</p>`;

  return `
    <section class="service-record">
      <h3>${t('dir.record')}</h3>
      <p class="service-course"><strong>${t('dir.trainingCourse')}:</strong> ${escapeHtml(record.training_course || '-')}</p>
      <h4>${t('dir.honorRanks')}</h4>
      ${honorList}
      <h4>${t('dir.missions')}</h4>
      ${missionList}
      <h4>${t('dir.medals')}</h4>
      ${medalList}
    </section>
  `;
}

/* ---------- Profile modal ---------- */

function closeProfileModal() {
  document.querySelector('#profile-modal').classList.remove('is-open');
}

function openProfileModal(record) {
  const settings = settingsMap[record.id] || { bio_public: true };
  const history = biographyParagraphs(record, settings.bio_public !== false);
  const name = formatPersonnelName(record) || 'Unassigned name';
  const body = document.querySelector('#profile-modal-body');

  body.innerHTML = `
    <div class="profile-modal-hero">
      ${avatarMarkup(record, 'roster-avatar')}
      <div>
        <h2>${escapeHtml(name)}</h2>
        <div class="card-badges">
          ${rankBadge(record.military_rank)}
          ${branchBadge(record.military_branch)}
          ${honorChips(record)}
        </div>
      </div>
    </div>
    <div class="profile-history">
      <p>${escapeHtml(history.paragraphIdentity)}</p>
      ${history.paragraphService ? `<p>${escapeHtml(history.paragraphService)}</p>` : ''}
    </div>
    <dl class="profile-meta">
      <div><dt>${escapeHtml(t('dir.unit'))}</dt><dd>${escapeHtml(unitNameFor(record) || '-')}</dd></div>
      <div><dt>${escapeHtml(t('dir.unitRank'))}</dt><dd>${escapeHtml(unitRankFor(record) || '-')}</dd></div>
      <div><dt>Agency</dt><dd>${escapeHtml(record.wlc_agency || '-')}</dd></div>
      <div><dt>Organization role</dt><dd>${escapeHtml(record.organization_role || '-')}</dd></div>
      <div><dt>Nationality</dt><dd>${escapeHtml(record.nationality || '-')}</dd></div>
      <div><dt>Race</dt><dd>${escapeHtml(record.race || '-')}</dd></div>
      <div><dt>Gender</dt><dd>${escapeHtml(record.gender || '-')}</dd></div>
      <div><dt>Age</dt><dd>${escapeHtml(record.age ?? '-')}</dd></div>
    </dl>
    ${serviceRecordMarkup(record)}
  `;
  document.querySelector('#profile-modal').classList.add('is-open');
}

/* ---------- Boot ---------- */

bootCommandShell('directory');
renderSkeletons();

// INJECT POINT: the two calls below are where data leaves Supabase and enters the UI.
Promise.all([
  fetchPersonnelRoster(),
  fetchSettingsMap().catch(() => ({})),
  fetchUnitBoard().catch(() => ({ units: [], ranks: [] }))
])
  .then(([records, settings, board]) => {
    rosterCache = records;
    settingsMap = settings;
    unitBoard = board;
    renderDirectory('');
    showToast(`${records.length} ${t('dir.loaded')}`, 'success');
  })
  .catch((error) => {
    document.querySelector('#directory-grid').innerHTML = '';
    showToast(error.message, 'error', 6000);
  });

document.querySelector('#directory-search').addEventListener('input', (event) => {
  renderDirectory(String(event.target.value).trim().toLowerCase());
});

document.querySelector('#directory-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view-id]');
  if (!button) {
    return;
  }
  const record = rosterCache.find((item) => item.id === button.getAttribute('data-view-id'));
  if (record) {
    openProfileModal(record);
  }
});

document.querySelector('#profile-modal-close').addEventListener('click', closeProfileModal);
document.querySelector('#profile-modal').addEventListener('click', (event) => {
  if (event.target.id === 'profile-modal') {
    closeProfileModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeProfileModal();
  }
});

// Re-render cards when the TH/EN switcher changes language.
window.addEventListener('wlr-lang-changed', () => {
  if (rosterCache.length > 0) {
    renderDirectory(lastQuery);
  }
});
