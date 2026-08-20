import { bootCommandShell, initAos } from './shell.js';
import { RANK_STRUCTURE, biographyParagraphs, formatPersonnelName, rankSortOrder } from './domain.js';
import { escapeHtml, initialsFromName, showToast, withOverlay } from './ui.js';
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
const SKILL_KEYS = ['tactical', 'engineering', 'combat', 'command', 'logistics', 'discipline'];
const RIBBON_PALETTES = [
  ['#1e4e8c', '#c9a227', '#1e4e8c'],
  ['#7a1f2b', '#d8c7a2', '#7a1f2b'],
  ['#1c6b46', '#e4d3a1', '#1c6b46'],
  ['#3d4a63', '#c5ccd8', '#3d4a63'],
  ['#6b4e16', '#f0e2b4', '#6b4e16']
];

let rosterCache = [];
let settingsMap = {};
let lastQuery = '';
let unitBoard = { units: [], ranks: [] };
let openProfileId = null;

function unitNameFor(record) {
  return unitBoard.units.find((unit) => unit.id === record.unit_id)?.name || record.wlc_agency || '';
}

function unitRankFor(record) {
  return unitBoard.ranks.find((rank) => rank.id === record.unit_rank_id)?.title || '';
}

function natoGradeFor(rank) {
  return RANK_STRUCTURE.find((item) => item.rankTitle === rank)?.natoGrade || '';
}

function clampScore(value) {
  return Math.max(28, Math.min(98, Math.round(value)));
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
      <button class="btn" type="button" data-view-id="${escapeHtml(record.id)}" aria-label="${escapeHtml(t('dir.view'))}: ${escapeHtml(name)}">
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

/* ---------- Rank insignia ---------- */

function rankInsigniaMarkup(rank, branch) {
  const order = rankSortOrder(rank);
  const gold = branch === 'Marines' ? '#c4a35a' : '#c9a227';
  const field = branch === 'Marines' ? '#1c6b46' : '#1e4e8c';
  let mark = '';

  if (order <= 5) {
    const count = Math.max(1, 6 - order);
    const stars = Array.from({ length: count }, (_, index) => {
      const x = 10 + index * 16;
      return `<polygon points="${x},6 ${x + 3.2},16 ${x + 14},16 ${x + 5.2},22 ${x + 8.4},32 ${x},26 ${x - 8.4},32 ${x - 5.2},22 ${x - 14},16 ${x - 3.2},16" fill="${gold}"/>`;
    }).join('');
    mark = `<svg viewBox="0 0 ${Math.max(36, count * 16 + 8)} 38" aria-hidden="true">${stars}</svg>`;
  } else if (order <= 7) {
    const bars = order === 6 ? 4 : 2;
    const stripes = Array.from({ length: bars }, (_, index) => `<rect x="8" y="${8 + index * 7}" width="40" height="4" rx="1" fill="${gold}"/>`).join('');
    mark = `<svg viewBox="0 0 56 42" aria-hidden="true"><rect x="4" y="4" width="48" height="34" rx="4" fill="none" stroke="${field}" stroke-width="2"/>${stripes}</svg>`;
  } else if (order <= 12) {
    const chevrons = order <= 9 ? 3 : order <= 10 ? 2 : 1;
    const paths = Array.from({ length: chevrons }, (_, index) => {
      const y = 8 + index * 8;
      return `<polyline points="8,${y + 10} 28,${y} 48,${y + 10}" fill="none" stroke="${gold}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
    mark = `<svg viewBox="0 0 56 42" aria-hidden="true">${paths}</svg>`;
  } else {
    mark = `<svg viewBox="0 0 56 42" aria-hidden="true"><circle cx="28" cy="21" r="12" fill="none" stroke="${gold}" stroke-width="2.4"/><path d="M28 12 v18 M19 21 h18" stroke="${field}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }

  return `<span class="dossier-insignia" title="${escapeHtml(rank || '')}">${mark}</span>`;
}

/* ---------- Skills radar ---------- */

function dossierSkills(record) {
  const rank = rankSortOrder(record.military_rank);
  const rankScore = rank >= 99 ? 34 : 100 - (rank - 1) * 5.2;
  const missions = (Array.isArray(record.completed_missions) ? record.completed_missions : []).length;
  const medals = (Array.isArray(record.medals) ? record.medals : []).length;
  const honors = (Array.isArray(record.honor_ranks) ? record.honor_ranks : []).length;
  const unit = unitNameFor(record).toUpperCase();
  const combatUnit = /MARINE|COMBAT|STRIKE|SUBMARINE|NEPTUNE|RAPIER|PARATROOP|HEAVY RECON/i.test(unit);
  const engineerUnit = /DOCKYARD|ELECTRONIC|MEDICAL|LOGISTIC|SUPPORT|AUXILIARY/i.test(unit);
  const trained = Boolean(record.training_course);

  return {
    tactical: clampScore(rankScore * 0.68 + missions * 8 + (record.military_branch === 'Navy' ? 10 : 5)),
    engineering: clampScore(42 + (trained ? 16 : 0) + (engineerUnit ? 20 : 6) + medals * 4),
    combat: clampScore(36 + missions * 12 + (record.military_branch === 'Marines' ? 16 : 6) + (combatUnit ? 14 : 0)),
    command: clampScore(rankScore * 0.82 + honors * 7 + (rank <= 6 ? 14 : 0)),
    logistics: clampScore(38 + (engineerUnit ? 18 : 7) + (record.organization_role ? 10 : 0) + medals * 3),
    discipline: clampScore(44 + medals * 9 + honors * 8 + (trained ? 8 : 0))
  };
}

function skillRadarMarkup(record) {
  // Inline SVG radar keeps this vanilla page self-contained.
  // In a React/Tailwind build, map dossierSkills(record) onto Recharts <RadarChart>
  // or Chart.js radar using the same six axes.
  const skills = dossierSkills(record);
  const size = 268;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const axes = SKILL_KEYS.map((key, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / SKILL_KEYS.length;
    const value = skills[key] / 100;
    return {
      key,
      label: t(`dir.skill.${key}`),
      value: skills[key],
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
      ax: cx + Math.cos(angle) * radius,
      ay: cy + Math.sin(angle) * radius,
      lx: cx + Math.cos(angle) * (radius + 26),
      ly: cy + Math.sin(angle) * (radius + 26)
    };
  });

  const rings = [0.33, 0.66, 1]
    .map((scale) => {
      const points = SKILL_KEYS.map((_, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / SKILL_KEYS.length;
        return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`;
      }).join(' ');
      return `<polygon points="${points}" class="dossier-radar-ring"/>`;
    })
    .join('');

  const spokes = axes
    .map((axis) => `<line x1="${cx}" y1="${cy}" x2="${axis.ax}" y2="${axis.ay}" class="dossier-radar-spoke"/>`)
    .join('');
  const plot = axes.map((axis) => `${axis.x},${axis.y}`).join(' ');
  const labels = axes
    .map(
      (axis) =>
        `<text x="${axis.lx}" y="${axis.ly}" text-anchor="middle" dominant-baseline="middle" class="dossier-radar-label">${escapeHtml(axis.label)}</text>`
    )
    .join('');

  const described = axes.map((axis) => `${axis.label} ${axis.value}`).join(', ');

  return `
    <section class="dossier-panel dossier-radar-card" aria-labelledby="dossier-skills-title">
      <h3 id="dossier-skills-title">${escapeHtml(t('dir.skills'))}</h3>
      <svg class="dossier-radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(described)}">
        <title>${escapeHtml(t('dir.skills'))}</title>
        ${rings}
        ${spokes}
        <polygon points="${plot}" class="dossier-radar-plot"/>
        ${labels}
      </svg>
    </section>
  `;
}

/* ---------- Timeline, medals, assignment ---------- */

function dossierTimeline(record) {
  const events = [];
  if (record.training_course) {
    events.push({ kind: 'training', title: record.training_course, detail: t('dir.trainingCourse') });
  }
  (Array.isArray(record.honor_ranks) ? record.honor_ranks : []).forEach((rank) => {
    events.push({ kind: 'promotion', title: rank, detail: t('dir.honorRanks') });
  });
  (Array.isArray(record.completed_missions) ? record.completed_missions : []).forEach((mission) => {
    events.push({ kind: 'mission', title: mission, detail: t('dir.missions') });
  });
  if (record.military_rank) {
    events.push({ kind: 'current', title: record.military_rank, detail: t('dir.currentPost') });
  }
  return events;
}

function timelineMarkup(record) {
  const events = dossierTimeline(record);
  if (!events.length) {
    return `<p class="empty-log">${escapeHtml(t('dir.timelineEmpty'))}</p>`;
  }
  return `
    <ol class="dossier-timeline">
      ${events
        .map(
          (event) => `
            <li class="dossier-event dossier-event-${event.kind}">
              <p class="dossier-event-kind">${escapeHtml(event.detail)}</p>
              <h4>${escapeHtml(event.title)}</h4>
            </li>
          `
        )
        .join('')}
    </ol>
  `;
}

function ribbonPalette(name) {
  let hash = 0;
  for (const ch of String(name)) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return RIBBON_PALETTES[hash % RIBBON_PALETTES.length];
}

function ribbonCard(name, kind) {
  const [left, center, right] = ribbonPalette(name);
  return `
    <li class="dossier-ribbon" tabindex="0">
      <span class="dossier-ribbon-bar" aria-hidden="true" style="background: linear-gradient(90deg, ${left} 0 28%, ${center} 28% 72%, ${right} 72% 100%)"></span>
      <span class="dossier-ribbon-name">${escapeHtml(name)}</span>
      <span class="dossier-ribbon-tip" role="tooltip">${escapeHtml(name)} · ${escapeHtml(kind)}</span>
    </li>
  `;
}

function medalsMarkup(record) {
  const medals = Array.isArray(record.medals) ? record.medals : [];
  const honors = Array.isArray(record.honor_ranks) ? record.honor_ranks : [];
  if (!medals.length && !honors.length) {
    return `<p class="empty-log">${escapeHtml(t('dir.noRecord'))}</p>`;
  }
  return `
    <ul class="dossier-ribbon-grid">
      ${medals.map((medal) => ribbonCard(medal, t('dir.medals'))).join('')}
      ${honors.map((rank) => ribbonCard(rank, t('dir.honorRanks'))).join('')}
    </ul>
  `;
}

function assignmentMarkup(record) {
  const fleet = unitNameFor(record);
  const rows = [
    [t('dir.fleet'), fleet || t('units.unassigned')],
    [t('dir.unitRank'), unitRankFor(record) || '—'],
    [t('units.serviceRank'), record.military_rank || '—'],
    [t('dir.deployment'), record.nationality || '—'],
    ['Agency', record.wlc_agency || '—'],
    ['Organization role', record.organization_role || '—']
  ];
  return `
    <section class="dossier-panel" aria-labelledby="dossier-assign-title">
      <h3 id="dossier-assign-title">${escapeHtml(t('dir.assignment'))}</h3>
      <dl class="dossier-assign">
        ${rows
          .map(
            ([label, value]) =>
              `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
          )
          .join('')}
      </dl>
    </section>
  `;
}

function bannerStyle(record) {
  const cover = String(record.cover_url || record.banner_url || '').trim();
  if (!/^https?:\/\//i.test(cover) && !cover.startsWith('data:')) {
    return '';
  }
  const safe = cover.replaceAll('\\', '').replaceAll('"', '').replaceAll("'", '');
  return `background-image: url("${safe}")`;
}

/* ---------- Dossier modal ---------- */

function closeProfileModal() {
  openProfileId = null;
  document.querySelector('#profile-modal').classList.remove('is-open');
}

function exportDossier() {
  document.body.classList.add('is-printing-dossier');
  showToast(t('dir.exported'), 'info', 2800);
  window.setTimeout(() => {
    window.print();
    document.body.classList.remove('is-printing-dossier');
  }, 80);
}

function openProfileModal(record) {
  const settings = settingsMap[record.id] || { bio_public: true };
  const history = biographyParagraphs(record, settings.bio_public !== false);
  const name = formatPersonnelName(record) || 'Unassigned name';
  const body = document.querySelector('#profile-modal-body');
  const grade = natoGradeFor(record.military_rank);
  const branchTone = record.military_branch === 'Marines' ? 'marines' : 'navy';
  openProfileId = record.id;

  body.innerHTML = `
    <article class="dossier" data-branch="${escapeHtml(branchTone)}">
      <div
        class="dossier-banner dossier-banner-${branchTone}${record.cover_url || record.banner_url ? ' has-image' : ''}"
        style="${bannerStyle(record)}"
        role="img"
        aria-label="${escapeHtml(t('dir.coverLabel'))}"
      ></div>
      <header class="dossier-header">
        <div class="dossier-identity">
          ${avatarMarkup(record, 'dossier-avatar')}
          <div class="dossier-heading">
            <p class="page-kicker" id="profile-modal-title">${escapeHtml(t('dir.dossier'))}</p>
            <h2>${escapeHtml(name)}</h2>
            <div class="dossier-rank-row">
              ${rankInsigniaMarkup(record.military_rank, record.military_branch)}
              <div>
                <p class="dossier-rank-title">${escapeHtml(record.military_rank || '—')}</p>
                ${grade ? `<p class="dossier-nato">${escapeHtml(t('dir.nato'))}: ${escapeHtml(grade)}</p>` : ''}
              </div>
            </div>
            <div class="card-badges">
              ${rankBadge(record.military_rank)}
              ${branchBadge(record.military_branch)}
              ${honorChips(record)}
            </div>
          </div>
        </div>
        <div class="dossier-actions">
          <button class="btn btn-primary btn-dossier-export" type="button" data-dossier-export>
            ${escapeHtml(t('dir.export'))}
          </button>
          <button class="btn" type="button" data-dossier-close>${escapeHtml(t('dir.close'))}</button>
        </div>
      </header>
      <div class="dossier-body">
        <div class="dossier-split">
          ${skillRadarMarkup(record)}
          ${assignmentMarkup(record)}
        </div>
        <section class="dossier-panel" aria-labelledby="dossier-timeline-title">
          <h3 id="dossier-timeline-title">${escapeHtml(t('dir.timeline'))}</h3>
          ${timelineMarkup(record)}
        </section>
        <section class="dossier-panel" aria-labelledby="dossier-ribbon-title">
          <h3 id="dossier-ribbon-title">${escapeHtml(t('dir.ribbons'))}</h3>
          ${medalsMarkup(record)}
        </section>
        <section class="dossier-panel" aria-labelledby="dossier-notes-title">
          <h3 id="dossier-notes-title">${escapeHtml(t('dir.identity'))}</h3>
          <div class="profile-history">
            <p>${escapeHtml(history.paragraphIdentity)}</p>
            ${history.paragraphService ? `<p>${escapeHtml(history.paragraphService)}</p>` : ''}
          </div>
          <dl class="profile-meta">
            <div><dt>${escapeHtml(t('home.age'))}</dt><dd>${escapeHtml(record.age ?? '—')}</dd></div>
            <div><dt>${escapeHtml(t('home.gender'))}</dt><dd>${escapeHtml(record.gender || '—')}</dd></div>
            <div><dt>Race</dt><dd>${escapeHtml(record.race || '—')}</dd></div>
            <div><dt>Religion</dt><dd>${escapeHtml(record.religion || '—')}</dd></div>
          </dl>
        </section>
      </div>
    </article>
  `;
  document.querySelector('#profile-modal').classList.add('is-open');
}

function refreshOpenDossier() {
  if (!openProfileId) {
    return;
  }
  const record = rosterCache.find((item) => item.id === openProfileId);
  if (record) {
    openProfileModal(record);
  }
}

/* ---------- Boot ---------- */

bootCommandShell('directory');
renderSkeletons();

// INJECT POINT: the two calls below are where data leaves Supabase and enters the UI.
withOverlay(
  () =>
    Promise.all([
      fetchPersonnelRoster(),
      fetchSettingsMap().catch(() => ({})),
      fetchUnitBoard().catch(() => ({ units: [], ranks: [] }))
    ]),
  t('notice.loading')
)
  .then(([records, settings, board]) => {
    rosterCache = records;
    settingsMap = settings;
    unitBoard = board;
    renderDirectory('');
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

document.querySelector('#profile-modal').addEventListener('click', (event) => {
  if (event.target.id === 'profile-modal') {
    closeProfileModal();
    return;
  }
  if (event.target.closest('[data-dossier-close]')) {
    closeProfileModal();
    return;
  }
  if (event.target.closest('[data-dossier-export]')) {
    exportDossier();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeProfileModal();
  }
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('is-printing-dossier');
});

// Re-render cards when the TH/EN switcher changes language.
window.addEventListener('wlr-lang-changed', () => {
  if (rosterCache.length > 0) {
    renderDirectory(lastQuery);
    refreshOpenDossier();
  }
});
