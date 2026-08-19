import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { formatPersonnelName } from './domain.js';
import { escapeHtml, showStatus } from './ui.js';
import { t } from './i18n.js';
import {
  applyToUnit,
  deleteUnitRank,
  fetchUnitBoard,
  removeUnitMember,
  reviewUnitApplication,
  saveUnitDetails,
  saveUnitRank,
  setUnitAnnouncements,
  setUnitHead,
  setUnitMemberRank
} from './unit-service.js';

let actor = null;
let board = {
  units: [],
  ranks: [],
  links: [],
  applications: [],
  personnel: [],
  announcements: []
};
let openUnitId = '';

function isAdmin() {
  return actor?.role === 'admin';
}

function canManage(unit) {
  return isAdmin() || unit.head_user_id === actor?.id;
}

function personById(userId) {
  return board.personnel.find((row) => row.id === userId) || null;
}

function personName(userId) {
  const person = personById(userId);
  return person ? formatPersonnelName(person) || t('units.unnamed') : t('units.unassigned');
}

function membersOf(unitId) {
  return board.personnel.filter((row) => row.unit_id === unitId);
}

function ranksOf(unitId) {
  return board.ranks
    .filter((row) => row.unit_id === unitId)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function pendingOf(unitId) {
  return board.applications.filter((row) => row.unit_id === unitId && row.status === 'pending');
}

function linkedAnnouncements(unitId) {
  const ids = new Set(
    board.links.filter((row) => row.unit_id === unitId).map((row) => row.announcement_id)
  );
  return board.announcements.filter((row) => ids.has(row.id));
}

function ownPending() {
  return board.applications.find((row) => row.user_id === actor?.id && row.status === 'pending') || null;
}

function rankTitle(rankId) {
  return board.ranks.find((row) => row.id === rankId)?.title || '';
}

function renderBoard() {
  const root = document.querySelector('#unit-board');
  const myUnitId = actor?.unit_id || null;
  const pending = ownPending();

  root.setAttribute('aria-busy', 'false');
  root.innerHTML = board.units
    .map((unit) => {
      const members = membersOf(unit.id);
      const ranks = ranksOf(unit.id);
      const pendingApps = pendingOf(unit.id);
      const announcements = linkedAnnouncements(unit.id);
      const full = members.length >= unit.max_capacity;
      const isMember = myUnitId === unit.id;
      const isPendingHere = pending?.unit_id === unit.id;
      const manage = canManage(unit);
      const expanded = openUnitId === unit.id;

      let action = '';
      if (isMember) {
        action = `<span class="unit-status is-member">${escapeHtml(t('units.member'))}</span>`;
      } else if (isPendingHere) {
        action = `<span class="unit-status is-pending">${escapeHtml(t('units.pending'))}</span>`;
      } else if (full) {
        action = `<span class="unit-status is-full">${escapeHtml(t('units.full'))}</span>`;
      } else if (!myUnitId && !pending) {
        action = `<button class="btn btn-primary" type="button" data-action="apply" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('units.apply'))}</button>`;
      } else if (pending) {
        action = `<span class="unit-status">${escapeHtml(t('units.waitOther'))}</span>`;
      } else {
        action = `<span class="unit-status">${escapeHtml(t('units.alreadyAssigned'))}</span>`;
      }

      const memberRank = isMember ? rankTitle(actor.unit_rank_id) : '';
      const managePanel = manage && expanded ? manageMarkup(unit, members, ranks, pendingApps) : '';

      return `
        <article class="unit-card${expanded ? ' is-open' : ''}" data-aos="fade-up" data-unit-card="${escapeHtml(unit.id)}">
          <header class="unit-card-head">
            <div>
              <p class="unit-code">${escapeHtml(unit.code)}</p>
              <h2>${escapeHtml(unit.name)}</h2>
            </div>
            <div class="unit-head-meta">
              <p>${escapeHtml(t('units.capacity'))}: ${members.length}/${unit.max_capacity}</p>
              <p>${escapeHtml(t('units.head'))}: ${escapeHtml(unit.head_user_id ? personName(unit.head_user_id) : t('units.unassigned'))}</p>
            </div>
          </header>
          ${unit.content ? `<p class="unit-content">${escapeHtml(unit.content)}</p>` : `<p class="unit-content is-empty">${escapeHtml(t('units.noContent'))}</p>`}
          ${
            announcements.length
              ? `<ul class="unit-announcements">${announcements
                  .map(
                    (item) =>
                      `<li><a href="./announcements.html">${escapeHtml(item.title)}</a></li>`
                  )
                  .join('')}</ul>`
              : `<p class="empty-log">${escapeHtml(t('units.noAnnouncements'))}</p>`
          }
          ${memberRank ? `<p class="unit-own-rank">${escapeHtml(t('units.yourRank'))}: ${escapeHtml(memberRank)}</p>` : ''}
          <div class="unit-card-actions">
            ${action}
            ${
              manage
                ? `<button class="btn" type="button" data-action="toggle" data-unit="${escapeHtml(unit.id)}">${escapeHtml(expanded ? t('units.hideManage') : t('units.manage'))}</button>`
                : ''
            }
          </div>
          ${managePanel}
        </article>
      `;
    })
    .join('');

  initAos();
}

function manageMarkup(unit, members, ranks, pendingApps) {
  const personnelOptions = board.personnel
    .slice()
    .sort((a, b) => formatPersonnelName(a).localeCompare(formatPersonnelName(b)))
    .map((person) => {
      const selected = person.id === unit.head_user_id ? ' selected' : '';
      return `<option value="${escapeHtml(person.id)}"${selected}>${escapeHtml(formatPersonnelName(person) || t('units.unnamed'))}</option>`;
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
              <span>${escapeHtml(personName(app.user_id))}</span>
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
          return `
            <li class="unit-member-row">
              <span>${escapeHtml(formatPersonnelName(member) || t('units.unnamed'))}</span>
              <select class="select-field" data-action="member-rank" data-user="${escapeHtml(member.id)}">${rankOptions}</select>
              <button class="btn btn-xs btn-danger" type="button" data-action="remove-member" data-user="${escapeHtml(member.id)}">${escapeHtml(t('units.remove'))}</button>
            </li>
          `;
        })
        .join('')
    : `<li class="empty-log">${escapeHtml(t('units.noMembers'))}</li>`;

  return `
    <div class="unit-manage">
      ${
        isAdmin()
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
        <h3>${escapeHtml(t('units.details'))}</h3>
        <label>${escapeHtml(t('units.content'))}
          <textarea class="text-field" data-unit-content="${escapeHtml(unit.id)}" rows="4">${escapeHtml(unit.content || '')}</textarea>
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
}

async function reload() {
  board = await fetchUnitBoard();
  const fresh = board.personnel.find((row) => row.id === actor.id);
  if (fresh) {
    actor = { ...actor, ...fresh };
  }
  renderBoard();
}

async function mutate(work, successKey) {
  try {
    await work();
    await reload();
    showStatus(t(successKey));
  } catch (error) {
    showStatus(error.message, true);
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

document.querySelector('#unit-board').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }
  const action = button.getAttribute('data-action');
  const unitId = button.getAttribute('data-unit');

  if (action === 'toggle') {
    openUnitId = openUnitId === unitId ? '' : unitId;
    renderBoard();
    return;
  }

  if (action === 'apply') {
    await mutate(() => applyToUnit(unitId), 'units.applied');
    return;
  }

  if (action === 'save-head') {
    const select = document.querySelector(`[data-head-select="${unitId}"]`);
    await mutate(() => setUnitHead(unitId, select.value || null), 'units.headSaved');
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
      () => saveUnitRank({ unit_id: unitId, title, sort_order: ranksOf(unitId).length + 1 }),
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
    if (!window.confirm(t('common.confirmDelete'))) {
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
    if (!window.confirm(t('units.confirmRemove'))) {
      return;
    }
    await mutate(() => removeUnitMember(button.getAttribute('data-user')), 'units.removed');
  }
});

document.querySelector('#unit-board').addEventListener('change', async (event) => {
  const select = event.target.closest('[data-action="member-rank"]');
  if (!select) {
    return;
  }
  await mutate(() => setUnitMemberRank(select.getAttribute('data-user'), select.value || null), 'units.rankAssigned');
});

window.addEventListener('wlr-lang-changed', () => {
  if (board.units.length) {
    renderBoard();
  }
});
