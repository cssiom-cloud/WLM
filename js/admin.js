import { bootCommandShell, initAos } from './shell.js';
import { requireCommandAdmin } from './session.js';
import {
  AGE_BRACKETS,
  GENDERS,
  MILITARY_BRANCHES,
  NATIONALITIES,
  RACES,
  RANK_STRUCTURE,
  formatPersonnelName
} from './domain.js';
import { confirmNotice, escapeHtml, initialsFromName, optionMarkup, showStatus, upgradeSelects } from './ui.js';
import {
  fetchPersonnelRoster,
  uniqueAgencyValues,
  updatePersonnelRecord,
  deletePersonnelAccount,
  uploadPersonnelImage
} from './personnel-service.js';
import { isLocalTestMode } from './config.js';
import { writeActivityLog } from './command-services.js';
import { t } from './i18n.js';
import { openImageEditor } from './image-editor.js';

let currentAdmin = null;
let rosterCache = [];
let filterState = {
  rank: '',
  race: '',
  gender: '',
  agency: '',
  nationality: '',
  age: '',
  branch: ''
};
let editingRecord = null;
let editingHonorRanks = [];

function recordMatchesFilters(record) {
  if (filterState.rank && record.military_rank !== filterState.rank) {
    return false;
  }
  if (filterState.race && record.race !== filterState.race) {
    return false;
  }
  if (filterState.gender && record.gender !== filterState.gender) {
    return false;
  }
  if (filterState.agency && record.wlc_agency !== filterState.agency) {
    return false;
  }
  if (filterState.nationality && record.nationality !== filterState.nationality) {
    return false;
  }
  if (filterState.branch && record.military_branch !== filterState.branch) {
    return false;
  }
  if (filterState.age) {
    const bracket = AGE_BRACKETS.find((item) => item.label === filterState.age);
    if (!bracket || record.age == null) {
      return false;
    }
    if (record.age < bracket.min) {
      return false;
    }
    if (bracket.max != null && record.age > bracket.max) {
      return false;
    }
  }
  return true;
}

function renderFilterPanel() {
  const panel = document.querySelector('#filter-panel');
  const agencies = uniqueAgencyValues(rosterCache);
  panel.innerHTML = `
    <section class="filter-section">
      <h2>Rank</h2>
      <select class="select-field" data-filter="rank">
        ${optionMarkup(RANK_STRUCTURE.map((item) => item.rankTitle), filterState.rank)}
      </select>
    </section>
    <section class="filter-section">
      <h2>Race</h2>
      <select class="select-field" data-filter="race">
        ${optionMarkup(RACES, filterState.race)}
      </select>
    </section>
    <section class="filter-section">
      <h2>Gender</h2>
      <select class="select-field" data-filter="gender">
        ${optionMarkup(GENDERS, filterState.gender)}
      </select>
    </section>
    <section class="filter-section">
      <h2>Agency</h2>
      <select class="select-field" data-filter="agency">
        ${optionMarkup(agencies, filterState.agency)}
      </select>
    </section>
    <section class="filter-section">
      <h2>Nationality</h2>
      <select class="select-field" data-filter="nationality">
        ${optionMarkup(NATIONALITIES, filterState.nationality)}
      </select>
    </section>
    <section class="filter-section">
      <h2>Age range</h2>
      <select class="select-field" data-filter="age">
        ${optionMarkup(AGE_BRACKETS.map((item) => item.label), filterState.age)}
      </select>
    </section>
    <section class="filter-section">
      <h2>Branch</h2>
      <select class="select-field" data-filter="branch">
        ${optionMarkup(MILITARY_BRANCHES, filterState.branch)}
      </select>
    </section>
  `;

  panel.querySelectorAll('[data-filter]').forEach((select) => {
    select.addEventListener('change', (event) => {
      filterState[event.target.getAttribute('data-filter')] = event.target.value;
      renderTable();
    });
  });
  upgradeSelects(panel);
}

function actionButtons(record) {
  const addAdmin = record.role === 'admin'
    ? ''
    : `<button class="btn" type="button" data-action="add-admin" data-id="${escapeHtml(record.id)}">Add Admin</button>`;
  const deleteAdmin = record.role === 'admin'
    ? `<button class="btn btn-danger" type="button" data-action="delete-admin" data-id="${escapeHtml(record.id)}">Delete Admin</button>`
    : '';
  const deleteUser =
    currentAdmin && record.id === currentAdmin.id
      ? ''
      : `<button class="btn btn-danger" type="button" data-action="delete-user" data-id="${escapeHtml(record.id)}">${escapeHtml(t('admin.deleteUser'))}</button>`;

  return `
    <div class="btn-row">
      <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Edit</button>
      ${addAdmin}
      ${deleteAdmin}
      ${deleteUser}
    </div>
  `;
}

function renderTable() {
  const body = document.querySelector('#personnel-table-body');
  const rows = rosterCache.filter(recordMatchesFilters);

  body.innerHTML = rows
    .map((record) => {
      const name = formatPersonnelName(record) || 'Unassigned name';
      const avatar = record.avatar_url
        ? `<img class="table-avatar" src="${escapeHtml(record.avatar_url)}" alt="">`
        : `<span class="table-avatar-fallback">${escapeHtml(initialsFromName(name))}</span>`;
      return `
        <tr data-aos="fade-up">
          <td><div class="name-cell">${avatar}<span>${escapeHtml(name)}</span></div></td>
          <td>${escapeHtml(record.military_rank || '')}</td>
          <td>${escapeHtml(record.military_branch || '')}</td>
          <td>${escapeHtml(record.race || '')}</td>
          <td>${escapeHtml(record.gender || '')}</td>
          <td>${escapeHtml(record.wlc_agency || '')}</td>
          <td>${escapeHtml(record.nationality || '')}</td>
          <td>${escapeHtml(record.age ?? '')}</td>
          <td>${escapeHtml(record.role || '')}</td>
          <td>${actionButtons(record)}</td>
        </tr>
      `;
    })
    .join('');

  initAos();
}

function fillSelect(select, values, selected) {
  select.innerHTML = optionMarkup(values, selected || '');
}

function renderHonorEditor() {
  const root = document.querySelector('#honor-ranks-editor');
  if (!root) {
    return;
  }
  root.innerHTML = editingHonorRanks.length
    ? editingHonorRanks
        .map(
          (rank, index) =>
            `<span class="honor-chip">${escapeHtml(rank)} <button class="honor-chip-remove" type="button" data-honor-remove="${index}" aria-label="${escapeHtml(t('common.delete'))}">x</button></span>`
        )
        .join('')
    : `<span class="empty-log">${escapeHtml(t('dir.noRecord'))}</span>`;
}

function openEditor(record) {
  editingRecord = record;
  editingHonorRanks = Array.isArray(record.honor_ranks) ? [...record.honor_ranks] : [];
  const modal = document.querySelector('#edit-modal');
  modal.classList.add('is-open');
  renderHonorEditor();
  document.querySelector('#edit-email').value = record.email || '';
  document.querySelector('#edit-first-name').value = record.first_name || '';
  document.querySelector('#edit-middle-name').value = record.middle_name || '';
  document.querySelector('#edit-last-name').value = record.last_name || '';
  document.querySelector('#edit-age').value = record.age ?? '';
  document.querySelector('#edit-religion').value = record.religion || '';
  document.querySelector('#edit-agency').value = record.wlc_agency || '';
  document.querySelector('#edit-course').value = record.training_course || '';
  document.querySelector('#edit-org-role').value = record.organization_role || '';
  document.querySelector('#edit-avatar-url').value = record.avatar_url || '';
  fillSelect(document.querySelector('#edit-nationality'), NATIONALITIES, record.nationality);
  fillSelect(document.querySelector('#edit-gender'), GENDERS, record.gender);
  fillSelect(document.querySelector('#edit-race'), RACES, record.race);
  fillSelect(document.querySelector('#edit-branch'), MILITARY_BRANCHES, record.military_branch);
  fillSelect(
    document.querySelector('#edit-rank'),
    RANK_STRUCTURE.map((item) => item.rankTitle),
    record.military_rank
  );
  upgradeSelects(modal);
}

function closeEditor() {
  editingRecord = null;
  document.querySelector('#edit-modal').classList.remove('is-open');
}

function nullable(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function nullableNumber(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') {
    return null;
  }
  return Number(trimmed);
}

async function persistEditor(event) {
  event.preventDefault();
  if (!editingRecord) {
    return;
  }

  const payload = {
    first_name: nullable(document.querySelector('#edit-first-name').value),
    middle_name: nullable(document.querySelector('#edit-middle-name').value),
    last_name: nullable(document.querySelector('#edit-last-name').value),
    age: nullableNumber(document.querySelector('#edit-age').value),
    nationality: nullable(document.querySelector('#edit-nationality').value),
    gender: nullable(document.querySelector('#edit-gender').value),
    race: nullable(document.querySelector('#edit-race').value),
    religion: nullable(document.querySelector('#edit-religion').value),
    wlc_agency: nullable(document.querySelector('#edit-agency').value),
    training_course: nullable(document.querySelector('#edit-course').value),
    military_branch: nullable(document.querySelector('#edit-branch').value),
    organization_role: nullable(document.querySelector('#edit-org-role').value),
    military_rank: nullable(document.querySelector('#edit-rank').value) || 'Lieutenant',
    avatar_url: nullable(document.querySelector('#edit-avatar-url').value),
    honor_ranks: editingHonorRanks
  };

  try {
    await updatePersonnelRecord(editingRecord.id, payload);
    if (isLocalTestMode() && currentAdmin) {
      await writeActivityLog({
        userId: currentAdmin.id,
        roleSnapshot: currentAdmin.role,
        actionType: 'personnel_edit',
        details: `Edited personnel record ${editingRecord.id}`
      });
    }
    closeEditor();
    rosterCache = await fetchPersonnelRoster();
    renderFilterPanel();
    renderTable();
    showStatus('Personnel record updated.');
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function changeAdminRole(personnelId, nextRole) {
  await updatePersonnelRecord(personnelId, { role: nextRole });
  if (isLocalTestMode() && currentAdmin) {
    await writeActivityLog({
      userId: currentAdmin.id,
      roleSnapshot: currentAdmin.role,
      actionType: nextRole === 'admin' ? 'admin_grant' : 'admin_revoke',
      details: `Changed role for ${personnelId} to ${nextRole}`
    });
  }
  rosterCache = await fetchPersonnelRoster();
  renderFilterPanel();
  renderTable();
}

bootCommandShell('admin');

requireCommandAdmin()
  .then(async (result) => {
    if (!result) {
      return;
    }
    currentAdmin = result.personnel;
    rosterCache = await fetchPersonnelRoster();
    renderFilterPanel();
    renderTable();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#filter-toggle').addEventListener('click', () => {
  document.querySelector('#filter-panel').classList.toggle('is-open');
});

document.querySelector('#personnel-table-body').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }
  const personnelId = button.getAttribute('data-id');
  const record = rosterCache.find((item) => item.id === personnelId);
  if (!record) {
    return;
  }

  try {
    const action = button.getAttribute('data-action');
    if (action === 'edit') {
      openEditor(record);
    }
    if (action === 'add-admin') {
      await changeAdminRole(personnelId, 'admin');
      showStatus('Admin role assigned.');
    }
    if (action === 'delete-admin') {
      await changeAdminRole(personnelId, 'user');
      showStatus('Admin role removed.');
    }
    if (action === 'delete-user') {
      if (!isAdmin()) {
        return;
      }
      if (!(await confirmNotice(t('admin.confirmDeleteUser')))) {
        return;
      }
      await deletePersonnelAccount(personnelId);
      rosterCache = await fetchPersonnelRoster();
      renderFilterPanel();
      renderTable();
      showStatus(t('admin.deletedUser'));
    }
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelector('#edit-form').addEventListener('submit', persistEditor);
document.querySelector('#edit-cancel').addEventListener('click', closeEditor);
document.querySelector('#edit-avatar-crop')?.addEventListener('click', async () => {
  if (!editingRecord) {
    return;
  }
  const result = await openImageEditor({
    source: editingRecord.avatar_url || document.querySelector('#edit-avatar-url').value || null,
    aspect: '1:1',
    filename: 'avatar.jpg',
    size: 768
  });
  if (!result?.file) {
    return;
  }
  try {
    const updated = await uploadPersonnelImage(editingRecord.id, result.file, 'avatar_url');
    editingRecord = { ...editingRecord, ...updated };
    document.querySelector('#edit-avatar-url').value = updated.avatar_url || '';
    rosterCache = await fetchPersonnelRoster();
    renderFilterPanel();
    renderTable();
    showStatus(t('img.saved'));
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelector('#honor-add').addEventListener('click', () => {
  const input = document.querySelector('#edit-honor-new');
  const title = String(input.value || '').trim();
  if (!title) {
    showStatus(t('admin.honorRequired'), true);
    return;
  }
  if (!editingHonorRanks.includes(title)) {
    editingHonorRanks.push(title);
  }
  input.value = '';
  renderHonorEditor();
});

window.addEventListener('wlr-lang-changed', () => {
  if (rosterCache.length) {
    renderFilterPanel();
    renderTable();
  }
});

document.querySelector('#honor-ranks-editor').addEventListener('click', (event) => {
  const button = event.target.closest('[data-honor-remove]');
  if (!button) {
    return;
  }
  const index = Number(button.getAttribute('data-honor-remove'));
  if (Number.isInteger(index)) {
    editingHonorRanks.splice(index, 1);
    renderHonorEditor();
  }
});
