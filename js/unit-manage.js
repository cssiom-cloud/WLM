import { bootCommandShell } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { formatPersonnelName } from './domain.js';
import { confirmNotice, escapeHtml, showStatus, upgradeSelects, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { openImageEditor, assignFileToInput } from './image-editor.js';
import {
  deleteUnitRank,
  fetchUnitBoard,
  removeUnitMember,
  reviewUnitApplication,
  saveUnitDetails,
  saveUnitRank,
  setUnitAnnouncements,
  setUnitHead,
  setUnitMemberRank,
  uploadUnitLogo
} from './unit-service.js';
import {
  canManageUnit,
  emptyUnitBoard,
  findUnit,
  isAdmin,
  logoMarkup,
  membersOf,
  mergeActor,
  pendingOf,
  personName,
  ranksOf,
  unitCodeFromUrl,
  unitTabsMarkup
} from './unit-common.js';

let actor = null;
let board = emptyUnitBoard();
let busy = false;

function currentUnit() {
  return findUnit(board, unitCodeFromUrl());
}

function renderPage() {
  const root = document.querySelector('#unit-page');
  const unit = currentUnit();
  if (!unit) {
    root.innerHTML = `<p class="empty-log">${escapeHtml(t('units.notFound'))}</p>`;
    return;
  }
  if (!canManageUnit(actor, unit)) {
    window.location.replace(`./unit.html?code=${encodeURIComponent(unit.code)}`);
    return;
  }

  document.title = `${t('units.tabManage')} · ${unit.name}`;
  const members = membersOf(board, unit.id);
  const ranks = ranksOf(board, unit.id);
  const pendingApps = pendingOf(board, unit.id);

  const personnelOptions = board.personnel
    .slice()
    .sort((a, b) => formatPersonnelName(a).localeCompare(formatPersonnelName(b)))
    .map((person) => {
      const selected = person.id === unit.head_user_id ? ' selected' : '';
      return `<option value="${escapeHtml(person.id)}"${selected}>${escapeHtml(
        formatPersonnelName(person) || t('units.unnamed')
      )}</option>`;
    })
    .join('');

  const announcementChecks = board.announcements
    .map((item) => {
      const checked = board.links.some((link) => link.unit_id === unit.id && link.announcement_id === item.id)
        ? ' checked'
        : '';
      return `<label class="check-row"><input type="checkbox" value="${escapeHtml(item.id)}"${checked}> ${escapeHtml(item.title)}</label>`;
    })
    .join('');

  const rankRows = ranks.length
    ? ranks
        .map(
          (rank) => `
            <li class="unit-rank-row">
              <input class="text-field" data-rank-title="${escapeHtml(rank.id)}" type="text" value="${escapeHtml(rank.title)}">
              <input class="text-field unit-rank-order" data-rank-order="${escapeHtml(rank.id)}" type="number" min="0" value="${escapeHtml(rank.sort_order ?? 0)}">
              <button class="btn btn-xs" type="button" data-action="save-rank" data-rank="${escapeHtml(rank.id)}" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('common.save'))}</button>
              <button class="btn btn-xs btn-danger" type="button" data-action="delete-rank" data-rank="${escapeHtml(rank.id)}">${escapeHtml(t('common.delete'))}</button>
            </li>
          `
        )
        .join('')
    : `<li class="empty-log">${escapeHtml(t('units.noRanks'))}</li>`;

  const appRows = pendingApps.length
    ? pendingApps
        .map(
          (app) => `
            <li class="unit-app-row">
              <span>${escapeHtml(personName(board, app.user_id))}</span>
              <button class="btn btn-xs btn-primary" type="button" data-action="approve" data-app="${escapeHtml(app.id)}">${escapeHtml(t('units.approve'))}</button>
              <button class="btn btn-xs" type="button" data-action="reject" data-app="${escapeHtml(app.id)}">${escapeHtml(t('units.reject'))}</button>
            </li>
          `
        )
        .join('')
    : `<li class="empty-log">${escapeHtml(t('units.noApps'))}</li>`;

  const memberRows = members.length
    ? members
        .map((member) => {
          const rankOptions = [`<option value="">${escapeHtml(t('units.noUnitRank'))}</option>`]
            .concat(
              ranks.map((rank) => {
                const selected = member.unit_rank_id === rank.id ? ' selected' : '';
                return `<option value="${escapeHtml(rank.id)}"${selected}>${escapeHtml(rank.title)}</option>`;
              })
            )
            .join('');
          const headMark = member.id === unit.head_user_id
            ? `<span class="unit-head-badge">${escapeHtml(t('units.head'))}</span>`
            : '';
          return `
            <li class="unit-member-row">
              <span>${escapeHtml(formatPersonnelName(member) || t('units.unnamed'))} ${headMark}</span>
              <select class="select-field" data-action="member-rank" data-user="${escapeHtml(member.id)}">${rankOptions}</select>
              <button class="btn btn-xs btn-danger" type="button" data-action="remove-member" data-user="${escapeHtml(member.id)}">${escapeHtml(t('units.remove'))}</button>
            </li>
          `;
        })
        .join('')
    : `<li class="empty-log">${escapeHtml(t('units.noMembers'))}</li>`;

  root.innerHTML = `
    ${unitTabsMarkup(unit.code, 'manage', true)}
    <div class="unit-page-hero">
      ${logoMarkup(unit)}
      <div>
        <p class="unit-code">${escapeHtml(unit.code)}</p>
        <h1 class="page-title">${escapeHtml(t('units.tabManage'))}</h1>
        <p class="unit-head-meta">${escapeHtml(unit.name)}</p>
      </div>
    </div>
    <div class="unit-manage">
      ${
        isAdmin(actor)
          ? `
            <section>
              <h3>${escapeHtml(t('units.appointHead'))}</h3>
              <div class="btn-row">
                <select class="select-field" data-head-select="${escapeHtml(unit.id)}">
                  <option value="">${escapeHtml(t('units.unassigned'))}</option>
                  ${personnelOptions}
                </select>
                <button class="btn btn-primary" type="button" data-action="save-head" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('common.save'))}</button>
              </div>
            </section>
          `
          : ''
      }
      <section>
        <h3>${escapeHtml(t('units.logo'))}</h3>
        <label>${escapeHtml(t('units.logoUrl'))}
          <input class="text-field" data-logo-url type="url" value="${escapeHtml(unit.logo_url || '')}">
        </label>
        <label>${escapeHtml(t('units.logoLink'))}
          <input class="text-field" data-logo-link type="url" value="${escapeHtml(unit.logo_link || '')}">
        </label>
        <label>${escapeHtml(t('units.logoUpload'))}
          <input class="text-field" data-logo-file type="file" accept="image/*">
        </label>
        <div class="image-edit-actions">
          <button class="btn" type="button" data-action="crop-logo" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('img.crop'))}</button>
        </div>
        <button class="btn btn-primary" type="button" data-action="save-logo" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('common.save'))}</button>
      </section>
      <section>
        <h3>${escapeHtml(t('units.details'))}</h3>
        <label>${escapeHtml(t('units.content'))}
          <textarea class="text-field" data-unit-content="${escapeHtml(unit.id)}" rows="8">${escapeHtml(unit.content || '')}</textarea>
        </label>
        <label>${escapeHtml(t('units.maxCapacity'))}
          <input class="text-field" data-unit-capacity="${escapeHtml(unit.id)}" type="number" min="1" value="${escapeHtml(unit.max_capacity)}">
        </label>
        <button class="btn btn-primary" type="button" data-action="save-details" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('common.save'))}</button>
      </section>
      <section>
        <h3>${escapeHtml(t('units.ranks'))}</h3>
        <ul class="unit-rank-list">${rankRows}</ul>
        <div class="btn-row">
          <input class="text-field" data-new-rank="${escapeHtml(unit.id)}" type="text" maxlength="80" placeholder="${escapeHtml(t('units.rankPlaceholder'))}">
          <button class="btn" type="button" data-action="add-rank" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('common.add'))}</button>
        </div>
      </section>
      <section>
        <h3>${escapeHtml(t('units.linkedAnnouncements'))}</h3>
        <div class="check-list" data-unit-announcements="${escapeHtml(unit.id)}">
          ${announcementChecks || `<p class="empty-log">${escapeHtml(t('units.noAnnouncements'))}</p>`}
        </div>
        ${board.announcements.length ? `<button class="btn" type="button" data-action="save-announcements" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('common.save'))}</button>` : ''}
      </section>
      <section>
        <h3>${escapeHtml(t('units.applications'))}</h3>
        <ul class="unit-app-list">${appRows}</ul>
      </section>
      <section>
        <h3>${escapeHtml(t('units.members'))}</h3>
        <ul class="unit-member-list">${memberRows}</ul>
      </section>
    </div>
  `;
  upgradeSelects(root);
}

async function reload() {
  board = await withOverlay(() => fetchUnitBoard(), t('notice.loading'));
  actor = mergeActor(actor, board);
  renderPage();
}

async function mutate(work, successKey) {
  if (busy) {
    return;
  }
  busy = true;
  try {
    await withOverlay(async () => {
      await work();
      board = await fetchUnitBoard();
      actor = mergeActor(actor, board);
    }, t('notice.saving'));
    renderPage();
    showStatus(t(successKey));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    busy = false;
  }
}

bootCommandShell('units');

requireAuthenticatedPersonnel()
  .then(async (result) => {
    if (!result) {
      return;
    }
    actor = result.personnel;
    await reload();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#unit-page').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }
  const action = button.getAttribute('data-action');
  const unitId = button.getAttribute('data-unit');

  if (action === 'save-head') {
    const select = document.querySelector(`[data-head-select="${unitId}"]`);
    await mutate(() => setUnitHead(unitId, select.value || null), 'units.headSaved');
    return;
  }

  if (action === 'crop-logo') {
    const fileInput = document.querySelector('[data-logo-file]');
    const result = await openImageEditor({
      source: fileInput?.files?.[0] || currentUnit()?.logo_url || null,
      aspect: '1:1',
      filename: 'unit-logo.jpg',
      size: 768
    });
    if (result?.file && fileInput) {
      assignFileToInput(fileInput, result.file);
    }
    return;
  }

  if (action === 'save-logo') {
    const file = document.querySelector('[data-logo-file]')?.files?.[0];
    const logoUrl = String(document.querySelector('[data-logo-url]')?.value || '').trim();
    const logoLink = String(document.querySelector('[data-logo-link]')?.value || '').trim() || null;
    await mutate(async () => {
      if (file) {
        await uploadUnitLogo(unitId, file);
        await saveUnitDetails(unitId, { logo_link: logoLink });
        return;
      }
      await saveUnitDetails(unitId, {
        logo_url: logoUrl || null,
        logo_link: logoLink
      });
    }, 'units.logoSaved');
    return;
  }

  if (action === 'save-details') {
    const content = document.querySelector(`[data-unit-content="${unitId}"]`).value;
    const maxCapacity = Number(document.querySelector(`[data-unit-capacity="${unitId}"]`).value);
    if (!Number.isFinite(maxCapacity) || maxCapacity < 1) {
      showStatus(t('units.invalidCapacity'), true);
      return;
    }
    await mutate(() => saveUnitDetails(unitId, { content, max_capacity: maxCapacity }), 'units.saved');
    return;
  }

  if (action === 'add-rank') {
    const input = document.querySelector(`[data-new-rank="${unitId}"]`);
    const title = String(input.value || '').trim();
    if (!title) {
      showStatus(t('units.rankRequired'), true);
      return;
    }
    await mutate(
      () => saveUnitRank({ unit_id: unitId, title, sort_order: ranksOf(board, unitId).length + 1 }),
      'units.rankSaved'
    );
    return;
  }

  if (action === 'save-rank') {
    const rankId = button.getAttribute('data-rank');
    const title = String(document.querySelector(`[data-rank-title="${rankId}"]`).value || '').trim();
    const sortOrder = Number(document.querySelector(`[data-rank-order="${rankId}"]`).value);
    if (!title) {
      showStatus(t('units.rankRequired'), true);
      return;
    }
    await mutate(
      () => saveUnitRank({ id: rankId, unit_id: unitId, title, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 }),
      'units.rankSaved'
    );
    return;
  }

  if (action === 'delete-rank') {
    if (!(await confirmNotice(t('common.confirmDelete')))) {
      return;
    }
    await mutate(() => deleteUnitRank(button.getAttribute('data-rank')), 'units.rankDeleted');
    return;
  }

  if (action === 'save-announcements') {
    const box = document.querySelector(`[data-unit-announcements="${unitId}"]`);
    const ids = [...box.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    await mutate(() => setUnitAnnouncements(unitId, ids), 'units.saved');
    return;
  }

  if (action === 'approve') {
    await mutate(() => reviewUnitApplication(button.getAttribute('data-app'), true), 'units.approved');
    return;
  }

  if (action === 'reject') {
    await mutate(() => reviewUnitApplication(button.getAttribute('data-app'), false), 'units.rejected');
    return;
  }

  if (action === 'remove-member') {
    if (!(await confirmNotice(t('units.confirmRemove')))) {
      return;
    }
    await mutate(() => removeUnitMember(button.getAttribute('data-user')), 'units.removed');
  }
});

document.querySelector('#unit-page').addEventListener('change', async (event) => {
  const select = event.target.closest('[data-action="member-rank"]');
  if (!select) {
    return;
  }
  await mutate(() => setUnitMemberRank(select.getAttribute('data-user'), select.value || null), 'units.rankAssigned');
});

window.addEventListener('wlr-lang-changed', () => {
  if (board.units.length) {
    renderPage();
  }
});
