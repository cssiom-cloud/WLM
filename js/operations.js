import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { confirmNotice, escapeHtml, showToast, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';
import {
  canDeleteOperation,
  canEditOperation,
  canPlanOperations,
  deleteOperation,
  fetchOperationBoard
} from './operation-service.js';
import { factionBoardMarkup, statusBadge, unitsForSide } from './operation-ui.js';
import { excerptText } from './unit-common.js';

bootCommandShell('operations');
initAos();

let actor = null;
let units = [];
let board = { operations: [], sides: [], aars: [] };

function render() {
  const list = document.querySelector('#operation-list');
  const empty = document.querySelector('#operation-empty');
  const createLink = document.querySelector('#create-operation-link');
  const canPlan = canPlanOperations(actor, units);
  if (createLink) {
    createLink.hidden = !canPlan;
  }
  if (!board.operations.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  list.innerHTML = board.operations
    .map((item) => {
      const allies = unitsForSide(units, board.sides, item.id, 'allies');
      const objectives = unitsForSide(units, board.sides, item.id, 'objectives');
      const canEdit = canEditOperation(actor, item, units, board.sides);
      const canDelete = canDeleteOperation(actor, item);
      return `
        <article class="unit-card ops-card" data-aos="fade-up">
          <div class="ops-card-head">
            ${statusBadge(item.status)}
            <h2>${escapeHtml(item.title)}</h2>
          </div>
          <p class="ops-excerpt">${escapeHtml(excerptText(item.briefing, 140) || t('ops.noBriefing'))}</p>
          ${factionBoardMarkup(allies, objectives, { compact: true })}
          <div class="btn-row">
            <a class="btn btn-primary" href="./operation.html?id=${encodeURIComponent(item.id)}">${escapeHtml(t('ops.view'))}</a>
            ${
              canEdit
                ? `<a class="btn" href="./operation-create.html?id=${encodeURIComponent(item.id)}">${escapeHtml(t('ops.edit'))}</a>`
                : ''
            }
            ${
              canDelete
                ? `<button class="btn" type="button" data-delete-op="${escapeHtml(item.id)}">${escapeHtml(t('ops.delete'))}</button>`
                : ''
            }
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadBoard() {
  const [{ personnel }, unitBoard, operationBoard] = await Promise.all([
    readCurrentPersonnel().catch(() => ({ personnel: null })),
    fetchUnitBoard().catch(() => ({ units: [], ranks: [], links: [], applications: [], personnel: [], announcements: [] })),
    fetchOperationBoard()
  ]);
  actor = personnel;
  units = unitBoard.units || [];
  board = operationBoard;
  render();
}

document.querySelector('#operation-list')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-op]');
  if (!button) {
    return;
  }
  if (!(await confirmNotice(t('ops.confirmDelete')))) {
    return;
  }
  try {
    await withOverlay(() => deleteOperation(button.getAttribute('data-delete-op')), t('notice.saving'));
    showToast(t('ops.deleted'), 'success');
    await loadBoard();
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

withOverlay(() => loadBoard(), t('notice.loading')).catch((error) => {
  showToast(error.message, 'error', 5000);
});

window.addEventListener('wlr-lang-changed', () => {
  render();
});
