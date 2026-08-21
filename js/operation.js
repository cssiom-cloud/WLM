import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { escapeHtml, showToast, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';
import { canEditOperation, fetchOperationBoard, saveOperationAar } from './operation-service.js';
import { briefingHtml, factionBoardMarkup, statusBadge, unitsForSide } from './operation-ui.js';
import { mountMapViewer } from './tactical-map.js';
import { logoMarkup } from './unit-common.js';

bootCommandShell('operations');
initAos();

const operationId = new URLSearchParams(window.location.search).get('id');
let actor = null;
let units = [];
let operation = null;
let sides = [];
let aars = [];
let canEdit = false;

function aarFor(unitId) {
  return aars.find((row) => row.operation_id === operationId && row.unit_id === unitId) || null;
}

function participatingUnits() {
  const ids = new Set(sides.filter((row) => row.operation_id === operationId).map((row) => row.unit_id));
  return units.filter((unit) => ids.has(unit.id));
}

function renderAar() {
  const host = document.querySelector('#aar-board');
  const roster = participatingUnits();
  const showSection = operation.status === 'completed' || canEdit;
  host.hidden = !showSection;
  if (!showSection) {
    host.innerHTML = '';
    return;
  }

  if (!roster.length) {
    host.innerHTML = `
      <h2>${escapeHtml(t('ops.aar.title'))}</h2>
      <p class="empty-log">${escapeHtml(t('ops.aar.noUnits'))}</p>
    `;
    return;
  }

  if (canEdit) {
    host.innerHTML = `
      <div class="ops-aar-head">
        <h2>${escapeHtml(t('ops.aar.title'))}</h2>
        <p class="form-hint">${escapeHtml(t('ops.aar.leaderHint'))}</p>
      </div>
      <form id="aar-form" class="ops-aar-form">
        ${roster
          .map((unit) => {
            const record = aarFor(unit.id);
            return `
              <section class="ops-aar-card">
                <div class="ops-aar-unit">
                  ${logoMarkup(unit, 'unit-logo-sm', false)}
                  <div>
                    <strong>${escapeHtml(unit.name)}</strong>
                    <small>${escapeHtml(unit.code)}</small>
                  </div>
                </div>
                <label>
                  <span>${escapeHtml(t('ops.aar.unit'))}</span>
                  <textarea class="text-field" data-aar-unit="${escapeHtml(unit.id)}" rows="4" maxlength="2000">${escapeHtml(record?.evaluation || '')}</textarea>
                </label>
              </section>
            `;
          })
          .join('')}
        <button class="btn btn-primary" type="submit">${escapeHtml(t('ops.aar.save'))}</button>
      </form>
    `;
    return;
  }

  const filled = roster.filter((unit) => aarFor(unit.id)?.evaluation);
  host.innerHTML = `
    <h2>${escapeHtml(t('ops.aar.title'))}</h2>
    ${
      filled.length
        ? filled
            .map((unit) => {
              const record = aarFor(unit.id);
              return `
                <section class="ops-aar-card ops-aar-read">
                  <div class="ops-aar-unit">
                    ${logoMarkup(unit, 'unit-logo-sm', false)}
                    <div>
                      <strong>${escapeHtml(unit.name)}</strong>
                      <small>${escapeHtml(unit.code)}</small>
                    </div>
                  </div>
                  <p>${briefingHtml(record.evaluation)}</p>
                </section>
              `;
            })
            .join('')
        : `<p class="empty-log">${escapeHtml(t('ops.aar.empty'))}</p>`
    }
  `;
}

function renderHeader() {
  document.querySelector('#op-status-badge').innerHTML = statusBadge(operation.status);
  document.querySelector('#op-title').textContent = operation.title;
  document.querySelector('#op-briefing').innerHTML = briefingHtml(operation.briefing) || `<p class="empty-log">${escapeHtml(t('ops.noBriefing'))}</p>`;
  const editLink = document.querySelector('#op-edit-link');
  editLink.hidden = !canEdit;
  editLink.href = `./operation-create.html?id=${encodeURIComponent(operation.id)}`;
  const allies = unitsForSide(units, sides, operation.id, 'allies');
  const objectives = unitsForSide(units, sides, operation.id, 'objectives');
  document.querySelector('#op-factions').innerHTML = factionBoardMarkup(allies, objectives);
}

async function boot() {
  if (!operationId) {
    window.location.replace('./operations.html');
    return;
  }
  const [{ personnel }, unitBoard, operationBoard] = await Promise.all([
    readCurrentPersonnel().catch(() => ({ personnel: null })),
    fetchUnitBoard(),
    fetchOperationBoard()
  ]);
  actor = personnel;
  units = unitBoard.units || [];
  operation = operationBoard.operations.find((row) => row.id === operationId) || null;
  if (!operation) {
    showToast(t('ops.missing'), 'error');
    window.location.replace('./operations.html');
    return;
  }
  sides = operationBoard.sides || [];
  aars = operationBoard.aars || [];
  canEdit = canEditOperation(actor, operation, units, sides);
  renderHeader();
  mountMapViewer(document.querySelector('#map-viewer'), {
    mapUrl: operation.map_url || '',
    drawings: operation.drawings || []
  });
  renderAar();
}

document.querySelector('#aar-board')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canEdit) {
    return;
  }
  const areas = [...event.target.querySelectorAll('[data-aar-unit]')];
  try {
    await withOverlay(async () => {
      for (const area of areas) {
        await saveOperationAar(operationId, area.getAttribute('data-aar-unit'), area.value.trim(), actor.id);
      }
    }, t('notice.saving'));
    const refreshed = await fetchOperationBoard();
    aars = refreshed.aars || [];
    showToast(t('ops.aar.saved'), 'success');
    renderAar();
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

withOverlay(() => boot(), t('notice.loading')).catch((error) => {
  showToast(error.message, 'error', 5000);
});

window.addEventListener('wlr-lang-changed', () => {
  if (!operation) {
    return;
  }
  renderHeader();
  renderAar();
});
