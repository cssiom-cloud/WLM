import { bootCommandShell, initAos } from './shell.js';
import {
  MILITARY_BRANCHES,
  RANK_STRUCTURE,
  biographyParagraphs,
  formatPersonnelName,
  rankSortOrder
} from './domain.js';
import { escapeHtml, initialsFromName, optionMarkup, showToast, upgradeSelects, withOverlay } from './ui.js';
import { t } from './i18n.js';
// Supabase fetch logic lives in these two services.
// fetchPersonnelRoster() -> supabase.from('oc_personnel').select('*') sorted by rank
// fetchSettingsMap()     -> supabase.from('user_settings').select('*') for bio privacy
// Both fall back to local test data automatically when js/config.js has no keys.
import { fetchPersonnelRoster, updatePersonnelRecord, uploadPersonnelImage } from './personnel-service.js';
import { fetchSettingsMap } from './command-services.js';
import { bindTiltTargets } from './effects.js';
import { fetchUnitBoard } from './unit-service.js';
import { readCurrentPersonnel } from './session.js';
import { openImageEditor } from './image-editor.js';

const SKELETON_COUNT = 8;
const SKILL_KEYS = ['tactical', 'engineering', 'combat', 'command', 'logistics', 'discipline'];
const RIBBON_PALETTES = [
  ['#1e4e8c', '#c9a227', '#1e4e8c'],
  ['#7a1f2b', '#d8c7a2', '#7a1f2b'],
  ['#1c6b46', '#e4d3a1', '#1c6b46'],
  ['#3d4a63', '#c5ccd8', '#3d4a63'],
  ['#6b4e16', '#f0e2b4', '#6b4e16']
];

const RIBBON_PRESETS = [
  'Meritorious Service Medal',
  'Fleet Command Ribbon',
  'Distinguished Command Cross',
  'Long Service Medal',
  'Marksmanship Badge',
  'Basic Training Honor'
];
const TIMELINE_KINDS = ['training', 'promotion', 'mission', 'current', 'other'];

let rosterCache = [];
let settingsMap = {};
let lastQuery = '';
let unitBoard = { units: [], ranks: [] };
let openProfileId = null;
let viewerIsAdmin = false;
let draftMedals = [];
let draftTimeline = [];

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

function clampSkill(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
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
  const derived = {
    tactical: clampScore(rankScore * 0.68 + missions * 8 + (record.military_branch === 'Navy' ? 10 : 5)),
    engineering: clampScore(42 + (trained ? 16 : 0) + (engineerUnit ? 20 : 6) + medals * 4),
    combat: clampScore(36 + missions * 12 + (record.military_branch === 'Marines' ? 16 : 6) + (combatUnit ? 14 : 0)),
    command: clampScore(rankScore * 0.82 + honors * 7 + (rank <= 6 ? 14 : 0)),
    logistics: clampScore(38 + (engineerUnit ? 18 : 7) + (record.organization_role ? 10 : 0) + medals * 3),
    discipline: clampScore(44 + medals * 9 + honors * 8 + (trained ? 8 : 0))
  };
  const stored = parseJsonObject(record.service_skills);
  SKILL_KEYS.forEach((key) => {
    const value = Number(stored[key]);
    if (Number.isFinite(value)) {
      derived[key] = clampSkill(value);
    }
  });
  return derived;
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

function normalizeTimeline(entry) {
  return {
    date: String(entry?.date || '').trim(),
    title: String(entry?.title || '').trim(),
    description: String(entry?.description || entry?.detail || '').trim(),
    kind: TIMELINE_KINDS.includes(entry?.kind) ? entry.kind : 'other'
  };
}

function parseJsonObject(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function parseTimeline(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(normalizeTimeline).filter((entry) => entry.title);
}

function derivedTimeline(record) {
  const events = [];
  if (record.training_course) {
    events.push({
      date: '',
      kind: 'training',
      title: record.training_course,
      description: '',
      detail: t('dir.trainingCourse')
    });
  }
  (Array.isArray(record.honor_ranks) ? record.honor_ranks : []).forEach((rank) => {
    events.push({ date: '', kind: 'promotion', title: rank, description: '', detail: t('dir.honorRanks') });
  });
  (Array.isArray(record.completed_missions) ? record.completed_missions : []).forEach((mission) => {
    events.push({ date: '', kind: 'mission', title: mission, description: '', detail: t('dir.missions') });
  });
  if (record.military_rank) {
    events.push({
      date: '',
      kind: 'current',
      title: record.military_rank,
      description: '',
      detail: t('dir.currentPost')
    });
  }
  return events;
}

function dossierTimeline(record) {
  const stored = parseTimeline(record.service_timeline);
  if (stored.length) {
    return stored.map((entry) => ({
      ...entry,
      detail: [entry.date, t(`dir.kind.${entry.kind}`)].filter(Boolean).join(' · ')
    }));
  }
  return derivedTimeline(record);
}

function editorTimeline(record) {
  const stored = parseTimeline(record.service_timeline);
  const rows = stored.length ? stored : derivedTimeline(record).map(normalizeTimeline);
  if (!rows.some((entry) => !entry.title)) {
    rows.push({ date: '', kind: 'other', title: '', description: '' });
  }
  return rows;
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
              ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}
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

function storedTimeline(record) {
  return editorTimeline(record);
}

function renderDraftMedals() {
  const root = document.querySelector('#dossier-medal-list');
  if (!root) {
    return;
  }
  root.innerHTML = draftMedals.length
    ? draftMedals
        .map((name, index) => {
          const [left, center, right] = ribbonPalette(name);
          return `
            <li class="dossier-ribbon-edit">
              <span class="dossier-ribbon-bar" aria-hidden="true" style="background: linear-gradient(90deg, ${left} 0 28%, ${center} 28% 72%, ${right} 72% 100%)"></span>
              <span>${escapeHtml(name)}</span>
              <button class="btn btn-inline" type="button" data-medal-remove="${index}">${escapeHtml(t('common.delete'))}</button>
            </li>
          `;
        })
        .join('')
    : `<p class="empty-log">${escapeHtml(t('dir.noRecord'))}</p>`;
}

function readDraftTimeline() {
  return [...document.querySelectorAll('[data-timeline-row]')]
    .map((row) =>
      normalizeTimeline({
        date: row.querySelector('[data-timeline-date]')?.value,
        kind: row.querySelector('[data-timeline-kind]')?.value,
        title: row.querySelector('[data-timeline-title]')?.value,
        description: row.querySelector('[data-timeline-detail]')?.value
      })
    )
    .filter((entry) => entry.title);
}

function renderDraftTimeline() {
  const root = document.querySelector('#dossier-timeline-list');
  if (!root) {
    return;
  }
  root.innerHTML = draftTimeline
    .map(
      (entry, index) => `
        <li class="dossier-timeline-edit" data-timeline-row="${index}">
          <div class="dossier-timeline-fields">
            <label>${escapeHtml(t('dir.timelineDate'))}
              <input class="text-field" data-timeline-date type="text" maxlength="40" placeholder="YYYY-MM-DD" value="${escapeHtml(entry.date)}">
            </label>
            <label>${escapeHtml(t('dir.timelineKind'))}
              <select class="select-field" data-timeline-kind>
                ${TIMELINE_KINDS.map(
                  (kind) =>
                    `<option value="${kind}"${kind === entry.kind ? ' selected' : ''}>${escapeHtml(t(`dir.kind.${kind}`))}</option>`
                ).join('')}
              </select>
            </label>
            <label class="full">${escapeHtml(t('dir.timelineTitle'))}
              <input class="text-field" data-timeline-title type="text" maxlength="120" value="${escapeHtml(entry.title)}">
            </label>
            <label class="full">${escapeHtml(t('dir.timelineDetail'))}
              <textarea class="text-field" data-timeline-detail rows="2" maxlength="400">${escapeHtml(entry.description)}</textarea>
            </label>
          </div>
          <button class="btn btn-inline" type="button" data-timeline-remove="${index}">${escapeHtml(t('common.delete'))}</button>
        </li>
      `
    )
    .join('');
}

function closeDossierEditor() {
  document.querySelector('#dossier-edit-modal').classList.remove('is-open');
}

function openDossierEditor(record) {
  if (!viewerIsAdmin) {
    return;
  }
  const skills = dossierSkills(record);
  draftMedals = Array.isArray(record.medals) ? [...record.medals] : [];
  draftTimeline = editorTimeline(record);
  const form = document.querySelector('#dossier-edit-form');
  form.innerHTML = `
    <div class="full image-edit-actions">
      <button class="btn" type="button" data-dossier-avatar>${escapeHtml(t('dir.avatar'))} · ${escapeHtml(t('img.crop'))}</button>
      <button class="btn" type="button" data-dossier-cover>${escapeHtml(t('dir.cover'))} · ${escapeHtml(t('img.crop'))}</button>
    </div>
    <label>
      ${escapeHtml(t('units.serviceRank'))}
      <select id="dossier-edit-rank" class="select-field">${optionMarkup(
        RANK_STRUCTURE.map((item) => item.rankTitle),
        record.military_rank || ''
      )}</select>
    </label>
    <label>
      Branch
      <select id="dossier-edit-branch" class="select-field">${optionMarkup(MILITARY_BRANCHES, record.military_branch || '')}</select>
    </label>
    <div class="full">
      <p class="editor-label">${escapeHtml(t('dir.ribbons'))}</p>
      <div class="dossier-preset-grid" role="list">
        ${RIBBON_PRESETS.map((name) => {
          const [left, center, right] = ribbonPalette(name);
          return `
            <button class="dossier-preset" type="button" data-medal-preset="${escapeHtml(name)}" title="${escapeHtml(name)}">
              <span class="dossier-ribbon-bar" aria-hidden="true" style="background: linear-gradient(90deg, ${left} 0 28%, ${center} 28% 72%, ${right} 72% 100%)"></span>
              <span>${escapeHtml(name)}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="btn-row dossier-add-row">
        <input id="dossier-medal-name" class="text-field" type="text" maxlength="80" placeholder="${escapeHtml(t('dir.medalName'))}">
        <button class="btn" type="button" data-medal-add>${escapeHtml(t('dir.addMedal'))}</button>
      </div>
      <ul id="dossier-medal-list" class="dossier-edit-list"></ul>
    </div>
    <div class="full">
      <p class="editor-label">${escapeHtml(t('dir.timeline'))}</p>
      <p class="form-hint">${escapeHtml(t('dir.timelineHint'))}</p>
      <ul id="dossier-timeline-list" class="dossier-edit-list"></ul>
      <button class="btn" type="button" data-timeline-add>${escapeHtml(t('dir.addTimeline'))}</button>
    </div>
    <div class="full">
      <p class="editor-label">${escapeHtml(t('dir.skills'))}</p>
      <div class="dossier-skill-grid">
        ${SKILL_KEYS.map(
          (key) => `
            <label>${escapeHtml(t(`dir.skill.${key}`))}
              <input id="dossier-skill-${key}" class="text-field" type="number" min="0" max="100" value="${skills[key]}">
            </label>
          `
        ).join('')}
      </div>
    </div>
    <div class="full btn-row">
      <button class="btn btn-primary" type="submit">${escapeHtml(t('common.save'))}</button>
      <button class="btn" type="button" data-dossier-edit-close>${escapeHtml(t('common.cancel'))}</button>
    </div>
  `;
  renderDraftMedals();
  renderDraftTimeline();
  upgradeSelects(form);
  document.querySelector('#dossier-edit-modal').classList.add('is-open');
}

function addDraftMedal(name) {
  const title = String(name || '').trim();
  if (!title) {
    showToast(t('dir.medalName'), 'error');
    return;
  }
  if (!draftMedals.includes(title)) {
    draftMedals.push(title);
  }
  const input = document.querySelector('#dossier-medal-name');
  if (input) {
    input.value = '';
  }
  renderDraftMedals();
}

function addDraftTimeline() {
  draftTimeline = readDraftTimeline();
  draftTimeline.push({ date: '', kind: 'other', title: '', description: '' });
  renderDraftTimeline();
  upgradeSelects(document.querySelector('#dossier-edit-form'));
}

async function persistDossierEditor(event) {
  event.preventDefault();
  const record = rosterCache.find((item) => item.id === openProfileId);
  if (!record || !viewerIsAdmin) {
    return;
  }
  const skills = {};
  SKILL_KEYS.forEach((key) => {
    skills[key] = clampSkill(Number(document.querySelector(`#dossier-skill-${key}`)?.value));
  });
  try {
    const updated = await updatePersonnelRecord(record.id, {
      military_rank: document.querySelector('#dossier-edit-rank').value || 'Lieutenant',
      military_branch: document.querySelector('#dossier-edit-branch').value || null,
      medals: draftMedals,
      service_skills: skills,
      service_timeline: readDraftTimeline()
    });
    const index = rosterCache.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      rosterCache[index] = { ...rosterCache[index], ...updated };
    }
    closeDossierEditor();
    openProfileModal(rosterCache[index] || { ...record, ...updated });
    renderDirectory(lastQuery);
    showToast(t('dir.editSaved'), 'success');
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
}

/* ---------- Dossier modal ---------- */

async function cropPersonnelImage(record, field, aspect) {
  const source = field === 'cover_url' ? record.cover_url || record.banner_url : record.avatar_url;
  const result = await openImageEditor({
    source: source || null,
    aspect,
    filename: field === 'cover_url' ? 'cover.jpg' : 'avatar.jpg',
    size: field === 'cover_url' ? 1280 : 768
  });
  if (!result?.file) {
    return;
  }
  const updated = await uploadPersonnelImage(record.id, result.file, field);
  const index = rosterCache.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    rosterCache[index] = { ...rosterCache[index], ...updated };
  }
  openProfileModal(rosterCache[index] || { ...record, ...updated });
  renderDirectory(lastQuery);
  showToast(t('img.saved'), 'success');
}

function closeProfileModal() {
  openProfileId = null;
  closeDossierEditor();
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
      >${
        viewerIsAdmin
          ? `<button class="btn btn-inline dossier-banner-edit" type="button" data-dossier-cover>${escapeHtml(t('img.upload'))}</button>`
          : ''
      }</div>
      <header class="dossier-header">
        <div class="dossier-identity">
          <div class="dossier-avatar-wrap">
            ${avatarMarkup(record, 'dossier-avatar')}
            ${
              viewerIsAdmin
                ? `<button class="btn btn-inline dossier-media-btn" type="button" data-dossier-avatar>${escapeHtml(t('img.crop'))}</button>`
                : ''
            }
          </div>
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
          ${
            viewerIsAdmin
              ? `<button class="btn btn-primary" type="button" data-dossier-edit>${escapeHtml(t('dir.edit'))}</button>`
              : ''
          }
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
          <div class="dossier-panel-head">
            <h3 id="dossier-timeline-title">${escapeHtml(t('dir.timeline'))}</h3>
            ${
              viewerIsAdmin
                ? `<button class="btn btn-inline" type="button" data-dossier-edit>${escapeHtml(t('common.edit'))}</button>`
                : ''
            }
          </div>
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
      fetchUnitBoard().catch(() => ({ units: [], ranks: [] })),
      readCurrentPersonnel().catch(() => ({ personnel: null }))
    ]),
  t('notice.loading')
)
  .then(([records, settings, board, session]) => {
    rosterCache = records;
    settingsMap = settings;
    unitBoard = board;
    viewerIsAdmin = session?.personnel?.role === 'admin';
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

document.querySelector('#profile-modal').addEventListener('click', async (event) => {
  if (event.target.id === 'profile-modal') {
    closeProfileModal();
    return;
  }
  if (event.target.closest('[data-dossier-close]')) {
    closeProfileModal();
    return;
  }
  const record = rosterCache.find((item) => item.id === openProfileId);
  if (event.target.closest('[data-dossier-avatar]') && record) {
    await cropPersonnelImage(record, 'avatar_url', '1:1');
    return;
  }
  if (event.target.closest('[data-dossier-cover]') && record) {
    await cropPersonnelImage(record, 'cover_url', '16:9');
    return;
  }
  if (event.target.closest('[data-dossier-edit]')) {
    if (record) {
      openDossierEditor(record);
    }
    return;
  }
  if (event.target.closest('[data-dossier-export]')) {
    exportDossier();
  }
});

const editModal = document.querySelector('#dossier-edit-modal');
editModal.addEventListener('click', async (event) => {
  if (event.target.id === 'dossier-edit-modal' || event.target.closest('[data-dossier-edit-close]')) {
    closeDossierEditor();
    return;
  }
  const record = rosterCache.find((item) => item.id === openProfileId);
  if (event.target.closest('[data-dossier-avatar]') && record) {
    await cropPersonnelImage(record, 'avatar_url', '1:1');
    return;
  }
  if (event.target.closest('[data-dossier-cover]') && record) {
    await cropPersonnelImage(record, 'cover_url', '16:9');
    return;
  }
  const preset = event.target.closest('[data-medal-preset]');
  if (preset) {
    addDraftMedal(preset.getAttribute('data-medal-preset'));
    return;
  }
  if (event.target.closest('[data-medal-add]')) {
    addDraftMedal(document.querySelector('#dossier-medal-name')?.value);
    return;
  }
  const medalRemove = event.target.closest('[data-medal-remove]');
  if (medalRemove) {
    draftMedals.splice(Number(medalRemove.getAttribute('data-medal-remove')), 1);
    renderDraftMedals();
    return;
  }
  if (event.target.closest('[data-timeline-add]')) {
    addDraftTimeline();
    return;
  }
  const timelineRemove = event.target.closest('[data-timeline-remove]');
  if (timelineRemove) {
    draftTimeline = readDraftTimeline();
    draftTimeline.splice(Number(timelineRemove.getAttribute('data-timeline-remove')), 1);
    if (!draftTimeline.length) {
      draftTimeline.push({ date: '', kind: 'other', title: '', description: '' });
    }
    renderDraftTimeline();
    upgradeSelects(document.querySelector('#dossier-edit-form'));
  }
});
document.querySelector('#dossier-edit-form').addEventListener('submit', persistDossierEditor);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (editModal.classList.contains('is-open')) {
    closeDossierEditor();
    return;
  }
  closeProfileModal();
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
