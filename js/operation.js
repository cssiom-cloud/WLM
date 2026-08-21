import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { escapeHtml, showToast, withOverlay } from './ui.js';
import { getLang, setLang, t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';
import { canEditOperation, fetchOperationBoard, saveOperationAar } from './operation-service.js';
import { authorizationMarkup, briefingHtml, docId, filedDate, overviewGridMarkup, unitsForSide } from './operation-ui.js';
import { mountMapViewer } from './tactical-map.js';
import { handleExportJPG, handleExportPDF } from './operation-export.js';
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
let mapViewer = null;

function syncLangSwitch() {
  const lang = getLang();
  document.querySelectorAll('.ops-lang-switch [data-lang]').forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-lang') === lang);
  });
}

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
  const heading = `<h2>${escapeHtml(t('ops.doc.aar'))}</h2>`;

  if (canEdit) {
    if (!roster.length) {
      host.innerHTML = `${heading}<div class="ops-doc-box"><p class="empty-log">${escapeHtml(t('ops.aar.noUnits'))}</p></div>`;
      return;
    }
    host.innerHTML = `
      ${heading}
      <div class="ops-doc-box">
        <p class="form-hint ops-chrome">${escapeHtml(t('ops.aar.leaderHint'))}</p>
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
          <button class="btn btn-primary ops-chrome" type="submit">${escapeHtml(t('ops.aar.save'))}</button>
        </form>
      </div>
    `;
    return;
  }

  const filled = roster.filter((unit) => aarFor(unit.id)?.evaluation);
  host.innerHTML = `
    ${heading}
    <div class="ops-doc-box">
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
    </div>
  `;
}

function renderHeader() {
  document.querySelector('#op-doc-id').textContent = docId(operation);
  document.querySelector('#op-doc-class').textContent = t('ops.doc.restricted');
  document.querySelector('#op-doc-date').textContent = filedDate(operation.created_at);
  document.querySelector('#op-briefing').innerHTML =
    briefingHtml(operation.briefing) || `<p class="empty-log">${escapeHtml(t('ops.noBriefing'))}</p>`;
  const editLink = document.querySelector('#op-edit-link');
  editLink.hidden = !canEdit;
  editLink.href = `./operation-create.html?id=${encodeURIComponent(operation.id)}`;
  const allies = unitsForSide(units, sides, operation.id, 'allies');
  const objectives = unitsForSide(units, sides, operation.id, 'objectives');
  document.querySelector('#op-overview').innerHTML = overviewGridMarkup(operation, allies, objectives);
  const authHost = document.querySelector('#op-auth');
  if (authHost) {
    authHost.innerHTML = authorizationMarkup(operation);
  }
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
  syncLangSwitch();
  renderHeader();
  mapViewer = mountMapViewer(document.querySelector('#map-viewer'), {
    mapUrl: operation.map_url || '',
    drawings: operation.drawings || []
  });
  renderAar();
}

document.querySelector('.ops-lang-switch')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-lang]');
  if (!button) {
    return;
  }
  setLang(button.getAttribute('data-lang'));
});

document.querySelector('.ops-export')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-export]');
  if (!button || !operation) {
    return;
  }
  mapViewer?.resetView();
  const payload = {
    title: operation.title,
    mapUrl: operation.map_url || '',
    drawings: operation.drawings || []
  };
  if (button.getAttribute('data-export') === 'jpg') {
    await handleExportJPG(payload);
  } else {
    await handleExportPDF(payload);
  }
});

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
  syncLangSwitch();
  if (!operation) {
    return;
  }
  renderHeader();
  renderAar();
});
