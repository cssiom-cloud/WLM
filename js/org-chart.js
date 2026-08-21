import { bootCommandShell, initAos } from './shell.js';
import { bindTiltTargets } from './effects.js';
import { formatPersonnelName } from './domain.js';
import { escapeHtml, initialsFromName, showToast, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { fetchPersonnelRoster, fetchRankStructure } from './personnel-service.js';
import { fetchSettingsMap } from './command-services.js';
import { fetchUnitBoard } from './unit-service.js';
import { readCurrentPersonnel } from './session.js';
import { visiblePersonnel } from './access.js';
import { buildHierarchyTree } from './hierarchy.js';
import {
  bindSharedDossier,
  openProfileModal,
  setDossierContext
} from './directory.js';

const MIN_SCALE = 0.45;
const MAX_SCALE = 1.8;
const COLLAPSE_FROM_SORT = 8;

let rosterCache = [];
let tree = { type: 'root', people: [], children: [] };
let collapsed = new Set();
let scale = 1;
let panX = 0;
let panY = 0;

function branchKey(branch) {
  if (branch === 'Marines') {
    return 'marines';
  }
  if (branch === 'Unassigned') {
    return 'unassigned';
  }
  return 'navy';
}

function branchLabel(branch) {
  if (branch === 'Marines') {
    return t('org.marines');
  }
  if (branch === 'Unassigned') {
    return t('org.unassigned');
  }
  return t('org.navy');
}

function nodeId(node) {
  return `${node.type}-${node.branch || 'command'}-${node.sortOrder ?? 'top'}-${node.rank || 'staff'}`;
}

function avatarMarkup(record) {
  const name = formatPersonnelName(record);
  if (record.avatar_url) {
    return `<img class="org-avatar" src="${escapeHtml(record.avatar_url)}" alt="" loading="lazy">`;
  }
  return `<div class="org-avatar-fallback" aria-hidden="true">${escapeHtml(initialsFromName(name))}</div>`;
}

function personCard(record) {
  const name = formatPersonnelName(record) || 'Unassigned name';
  const tone = branchKey(record.military_branch);
  const role = record.organization_role || record.wlc_agency || record._nato || '';
  return `
    <button class="org-card org-card-${tone}" type="button" data-org-id="${escapeHtml(record.id)}" aria-label="${escapeHtml(t('org.openDossier'))}: ${escapeHtml(name)}">
      <span class="org-card-glare" aria-hidden="true"></span>
      ${avatarMarkup(record)}
      <span class="org-card-copy">
        <strong>${escapeHtml(name)}</strong>
        <span class="org-card-rank">${escapeHtml(record.military_rank || '—')}</span>
        ${role ? `<span class="org-card-role">${escapeHtml(role)}</span>` : ''}
      </span>
      ${record._nato ? `<span class="org-card-nato">${escapeHtml(record._nato)}</span>` : ''}
    </button>
  `;
}

function peopleRow(people) {
  if (!people?.length) {
    return '';
  }
  return `<div class="org-people">${people.map(personCard).join('')}</div>`;
}

function renderRankNode(node) {
  const id = nodeId(node);
  const isCollapsed = collapsed.has(id);
  const hasKids = Boolean(node.children?.length);
  return `
    <div class="org-rank" data-rank-id="${escapeHtml(id)}">
      <div class="org-stem" aria-hidden="true"></div>
      <div class="org-rank-head">
        <p class="org-rank-title">${escapeHtml(node.rank)}${node.natoGrade ? ` · ${escapeHtml(node.natoGrade)}` : ''}</p>
        ${
          hasKids
            ? `<button class="btn btn-inline org-toggle" type="button" data-org-toggle="${escapeHtml(id)}" aria-expanded="${isCollapsed ? 'false' : 'true'}">${
                isCollapsed ? '+' : '−'
              }</button>`
            : ''
        }
      </div>
      ${peopleRow(node.people)}
      ${
        hasKids && !isCollapsed
          ? `<div class="org-children">${node.children.map(renderRankNode).join('')}</div>`
          : ''
      }
    </div>
  `;
}

function renderBranch(node) {
  const tone = branchKey(node.branch);
  return `
    <section class="org-branch org-branch-${tone}">
      <h2 class="org-branch-title">${escapeHtml(branchLabel(node.branch))}</h2>
      ${node.children.map(renderRankNode).join('')}
    </section>
  `;
}

function applyTransform() {
  const canvas = document.querySelector('#org-canvas');
  canvas.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
}

function resetView() {
  scale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
}

function collectRankIds(node, bucket = []) {
  if (node.type === 'rank') {
    bucket.push(node);
  }
  (node.children || []).forEach((child) => collectRankIds(child, bucket));
  return bucket;
}

function collapseLowerRanks() {
  collapsed = new Set(
    collectRankIds(tree)
      .filter((node) => node.sortOrder >= COLLAPSE_FROM_SORT)
      .map(nodeId)
  );
}

function expandAll() {
  collapsed = new Set();
}

function renderChart() {
  const canvas = document.querySelector('#org-canvas');
  if (!tree.people.length && !tree.children.length) {
    canvas.innerHTML = `<p class="empty-log">${escapeHtml(t('org.empty'))}</p>`;
    return;
  }
  canvas.innerHTML = `
    <div class="org-tree">
      <section class="org-command">
        <h2 class="org-branch-title">${escapeHtml(t('org.command'))}</h2>
        ${peopleRow(tree.people)}
      </section>
      ${
        tree.children.length
          ? `
            <div class="org-stem" aria-hidden="true"></div>
            <div class="org-fork" aria-hidden="true"></div>
            <div class="org-branches org-branches-${tree.children.length}">
              ${tree.children.map(renderBranch).join('')}
            </div>
          `
          : ''
      }
    </div>
  `;
  applyTransform();
  bindTiltTargets('.org-card');
  initAos();
}

function bindViewport() {
  const viewport = document.querySelector('#org-viewport');
  let dragging = false;
  let originX = 0;
  let originY = 0;
  let startX = 0;
  let startY = 0;
  const pointers = new Map();
  let pinch = 0;

  viewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) {
      return;
    }
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragging = true;
      originX = event.clientX;
      originY = event.clientY;
      startX = panX;
      startY = panY;
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinch) {
      const pts = [...pointers.values()];
      const next = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (next / pinch)));
      pinch = next;
      applyTransform();
      return;
    }
    if (!dragging) {
      return;
    }
    panX = startX + (event.clientX - originX);
    panY = startY + (event.clientY - originY);
    applyTransform();
  });
  const clearPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinch = 0;
    }
    if (!pointers.size) {
      dragging = false;
    }
  };
  viewport.addEventListener('pointerup', clearPointer);
  viewport.addEventListener('pointercancel', clearPointer);
  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const next = event.deltaY > 0 ? 0.92 : 1.08;
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * next));
      applyTransform();
    },
    { passive: false }
  );
}

bootCommandShell('org');
bindSharedDossier();
bindViewport();

if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
  collapseLowerRanks();
}

document.querySelector('[data-org-zoom-in]').addEventListener('click', () => {
  scale = Math.min(MAX_SCALE, scale + 0.12);
  applyTransform();
});
document.querySelector('[data-org-zoom-out]').addEventListener('click', () => {
  scale = Math.max(MIN_SCALE, scale - 0.12);
  applyTransform();
});
document.querySelector('[data-org-reset]').addEventListener('click', resetView);
document.querySelector('[data-org-expand]').addEventListener('click', () => {
  expandAll();
  renderChart();
});
document.querySelector('[data-org-collapse]').addEventListener('click', () => {
  collapseLowerRanks();
  renderChart();
});

document.querySelector('#org-canvas').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-org-toggle]');
  if (toggle) {
    const id = toggle.getAttribute('data-org-toggle');
    if (collapsed.has(id)) {
      collapsed.delete(id);
    } else {
      collapsed.add(id);
    }
    renderChart();
    return;
  }
  const card = event.target.closest('[data-org-id]');
  if (!card) {
    return;
  }
  const record = rosterCache.find((item) => item.id === card.getAttribute('data-org-id'));
  if (record) {
    openProfileModal(record);
  }
});

// INJECT POINT: roster from oc_personnel, ranks from oc_rank_structure.
withOverlay(
  () =>
    Promise.all([
      fetchPersonnelRoster(),
      fetchRankStructure().catch(() => []),
      fetchSettingsMap().catch(() => ({})),
      fetchUnitBoard().catch(() => ({ units: [], ranks: [] })),
      readCurrentPersonnel().catch(() => ({ personnel: null }))
    ]),
  t('notice.loading')
)
  .then(([records, ranks, settings, board, session]) => {
    rosterCache = visiblePersonnel(records, session?.personnel);
    tree = buildHierarchyTree(rosterCache, ranks);
    setDossierContext({
      roster: rosterCache,
      settings,
      board,
      isAdmin: session?.personnel?.role === 'admin'
    });
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
      collapseLowerRanks();
    }
    renderChart();
  })
  .catch((error) => {
    showToast(error.message, 'error', 6000);
    document.querySelector('#org-canvas').innerHTML = `<p class="empty-log">${escapeHtml(error.message)}</p>`;
  });

window.addEventListener('wlr-lang-changed', () => {
  document.querySelector('[data-org-reset]').textContent = t('org.reset');
  document.querySelector('[data-org-expand]').textContent = t('org.expand');
  document.querySelector('[data-org-collapse]').textContent = t('org.collapse');
  if (rosterCache.length) {
    renderChart();
  }
});
