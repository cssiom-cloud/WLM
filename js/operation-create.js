import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { escapeHtml, showToast, upgradeSelects, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { fetchUnitBoard } from './unit-service.js';
import { canPlanOperations, canEditOperation, fetchOperationBoard, saveOperation } from './operation-service.js';
import { factionStackMarkup } from './operation-ui.js';
import { mountMapEditor } from './tactical-map.js';

bootCommandShell('operations');
initAos();

const editingId = new URLSearchParams(window.location.search).get('id');
let actor = null;
let units = [];
let assignments = [];
let mapFile = null;
let mapUrl = '';
let editor = null;

const titleInput = document.querySelector('#op-title');
const briefingInput = document.querySelector('#op-briefing');
const statusInput = document.querySelector('#op-status');
const officerInput = document.querySelector('#op-officer');
const submitButton = document.querySelector('#op-submit');
const pageTitle = document.querySelector('.page-title');

function assignedIds() {
  return new Set(assignments.map((row) => row.unit_id));
}

function unitsOn(side) {
  const ids = new Set(assignments.filter((row) => row.side === side).map((row) => row.unit_id));
  return units.filter((unit) => ids.has(unit.id));
}

function unusedUnits() {
  const taken = assignedIds();
  return units.filter((unit) => !taken.has(unit.id));
}

function optionList() {
  const unused = unusedUnits();
  if (!unused.length) {
    return `<option value="">${escapeHtml(t('ops.noUnitsLeft'))}</option>`;
  }
  return `<option value="">${escapeHtml(t('ops.assign.choose'))}</option>${unused
    .map((unit) => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.name)} (${escapeHtml(unit.code)})</option>`)
    .join('')}`;
}

function renderFactions() {
  const host = document.querySelector('#faction-board');
  host.innerHTML = `
    <div class="ops-factions ops-factions-edit">
      ${['allies', 'objectives']
        .map(
          (side) => `
            <section class="ops-faction ops-faction-${side}" data-side="${side}">
              <h2>${escapeHtml(t(`ops.${side}`))}</h2>
              ${factionStackMarkup(unitsOn(side), { removable: true })}
              <label class="ops-assign-row">
                <span>${escapeHtml(t('ops.assign.add'))}</span>
                <select class="text-field select-field" data-assign-select>${optionList()}</select>
                <button class="btn" type="button" data-assign-add>${escapeHtml(t('ops.assign.add'))}</button>
              </label>
            </section>
          `
        )
        .join('')}
    </div>
  `;
  upgradeSelects();
}

document.querySelector('#faction-board')?.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-unit]');
  if (remove) {
    const id = remove.getAttribute('data-remove-unit');
    assignments = assignments.filter((row) => row.unit_id !== id);
    renderFactions();
    return;
  }
  const add = event.target.closest('[data-assign-add]');
  if (!add) {
    return;
  }
  const section = add.closest('[data-side]');
  const select = section.querySelector('[data-assign-select]');
  const unitId = select.value;
  if (!unitId) {
    return;
  }
  assignments.push({ unit_id: unitId, side: section.getAttribute('data-side') });
  renderFactions();
});

async function boot() {
  const auth = await requireAuthenticatedPersonnel();
  if (!auth) {
    return;
  }
  actor = auth.personnel;
  const [unitBoard, operationBoard] = await Promise.all([fetchUnitBoard(), fetchOperationBoard()]);
  units = unitBoard.units || [];
  const existing = editingId ? operationBoard.operations.find((row) => row.id === editingId) : null;
  if (editingId && !existing) {
    showToast(t('ops.missing'), 'error');
    window.location.replace('./operations.html');
    return;
  }
  const allowed = existing
    ? canEditOperation(actor, existing, units, operationBoard.sides)
    : canPlanOperations(actor, units);
  if (!allowed) {
    window.location.replace('./operations.html');
    return;
  }

  if (existing) {
    titleInput.value = existing.title || '';
    briefingInput.value = existing.briefing || '';
    statusInput.value = existing.status || 'planning';
    if (officerInput) {
      officerInput.value = existing.commanding_officer || '';
    }
    mapUrl = existing.map_url || '';
    assignments = operationBoard.sides
      .filter((row) => row.operation_id === existing.id)
      .map((row) => ({ unit_id: row.unit_id, side: row.side }));
    pageTitle.textContent = t('ops.create.editTitle');
    submitButton.textContent = t('ops.update');
  } else {
    pageTitle.textContent = t('ops.create.title');
    submitButton.textContent = t('ops.publish');
  }

  renderFactions();
  editor = mountMapEditor(document.querySelector('#map-editor'), {
    drawings: existing?.drawings || [],
    mapUrl,
    onMapFile(file, previewUrl) {
      mapFile = file;
      mapUrl = previewUrl;
    }
  });
}

document.querySelector('#operation-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    showToast(t('ops.titleRequired'), 'error');
    return;
  }
  try {
    const savedId = await withOverlay(
      () =>
        saveOperation({
          id: editingId || undefined,
          title,
          briefing: briefingInput.value.trim(),
          status: statusInput.value,
          commandingOfficer: officerInput?.value.trim() || '',
          drawings: editor?.getDrawings() || [],
          sides: assignments,
          mapFile,
          mapUrl: mapFile ? '' : mapUrl,
          createdBy: actor.id
        }),
      t('notice.saving')
    );
    showToast(editingId ? t('ops.updated') : t('ops.saved'), 'success');
    window.location.replace(`./operation.html?id=${encodeURIComponent(savedId)}`);
  } catch (error) {
    showToast(error.message, 'error', 5000);
  }
});

withOverlay(() => boot(), t('notice.loading')).catch((error) => {
  showToast(error.message, 'error', 5000);
});

window.addEventListener('wlr-lang-changed', () => {
  if (!pageTitle) {
    return;
  }
  pageTitle.textContent = editingId ? t('ops.create.editTitle') : t('ops.create.title');
  if (submitButton) {
    submitButton.textContent = editingId ? t('ops.update') : t('ops.publish');
  }
  renderFactions();
  editor?.syncLabels();
});
