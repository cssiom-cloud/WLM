import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { formatPersonnelName } from './domain.js';
import { escapeHtml, showStatus, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';

let actor = null;
let board = { units: [], ranks: [], applications: [], personnel: [] };

function personName(userId) {
  const person = board.personnel.find((row) => row.id === userId);
  return person ? formatPersonnelName(person) || t('units.unnamed') : t('units.unassigned');
}

function membersOf(unitId) {
  return board.personnel.filter((row) => row.unit_id === unitId);
}

function logoMarkup(unit, className) {
  if (unit.logo_url) {
    return `<img class="${className}" src="${escapeHtml(unit.logo_url)}" alt="${escapeHtml(unit.name)}">`;
  }
  return `<div class="${className} unit-logo-fallback">${escapeHtml(unit.code)}</div>`;
}

function renderBoard() {
  const root = document.querySelector('#unit-board');
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = board.units
    .map((unit) => {
      const members = membersOf(unit.id);
      const excerpt = String(unit.content || '').trim();
      return `
        <a class="unit-card unit-card-link" href="./unit.html?code=${encodeURIComponent(unit.code)}" data-aos="fade-up">
          ${logoMarkup(unit, 'unit-logo')}
          <div>
            <p class="unit-code">${escapeHtml(unit.code)}</p>
            <h2>${escapeHtml(unit.name)}</h2>
          </div>
          <p class="unit-content${excerpt ? '' : ' is-empty'}">${escapeHtml(excerpt ? excerpt.slice(0, 180) : t('units.noContent'))}</p>
          <p class="unit-head-meta">${escapeHtml(t('units.capacity'))}: ${members.length}/${unit.max_capacity}</p>
          <p class="unit-head-meta">${escapeHtml(t('units.head'))}: ${escapeHtml(unit.head_user_id ? personName(unit.head_user_id) : t('units.unassigned'))}</p>
        </a>
      `;
    })
    .join('');
  initAos();
}

bootCommandShell('units');

requireAuthenticatedPersonnel()
  .then(async (result) => {
    if (!result) {
      return;
    }
    actor = result.personnel;
    board = await withOverlay(() => fetchUnitBoard(), t('notice.loading'));
    const fresh = board.personnel.find((row) => row.id === actor.id);
    if (fresh) {
      actor = { ...actor, ...fresh };
    }
    renderBoard();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

window.addEventListener('wlr-lang-changed', () => {
  if (board.units.length) {
    renderBoard();
  }
});
