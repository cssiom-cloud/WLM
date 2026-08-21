import { bootCommandShell, initAos } from './shell.js';
import { bindTiltTargets } from './effects.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { escapeHtml, showStatus, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';
import { excerptText, logoMarkup, membersOf, mergeActor, personName } from './unit-common.js';

let actor = null;
let board = { units: [], ranks: [], applications: [], personnel: [] };

function renderBoard() {
  const root = document.querySelector('#unit-board');
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = board.units
    .map((unit) => {
      const members = membersOf(board, unit.id);
      const excerpt = excerptText(unit.content, 90);
      return `
        <a class="unit-card unit-card-link" href="./unit.html?code=${encodeURIComponent(unit.code)}" data-aos="fade-up">
          <span class="card-glare" aria-hidden="true"></span>
          <div class="unit-card-media">${logoMarkup(unit, 'unit-logo', false)}</div>
          <div class="unit-card-copy">
            <p class="unit-code">${escapeHtml(unit.code)}</p>
            <h2>${escapeHtml(unit.name)}</h2>
            <p class="unit-content${excerpt ? '' : ' is-empty'}">${escapeHtml(excerpt || t('units.noContent'))}</p>
            <p class="unit-head-meta">${escapeHtml(t('units.capacity'))}: ${members.length}/${unit.max_capacity}</p>
            <p class="unit-head-meta">${escapeHtml(t('units.head'))}: ${escapeHtml(unit.head_user_id ? personName(board, unit.head_user_id) : t('units.unassigned'))}</p>
          </div>
        </a>
      `;
    })
    .join('');
  bindTiltTargets('.unit-card-link');
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
    actor = mergeActor(actor, board);
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
