import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { escapeHtml, showStatus, withOverlay } from './ui.js';
import { t } from './i18n.js';
import { applyToUnit, fetchUnitBoard } from './unit-service.js';
import {
  canManageUnit,
  emptyUnitBoard,
  findUnit,
  linkedAnnouncements,
  logoMarkup,
  membersOf,
  mergeActor,
  ownPending,
  personName,
  rankTitle,
  rosterMarkup,
  unitCodeFromUrl,
  unitTabsMarkup
} from './unit-common.js';

let actor = null;
let board = emptyUnitBoard();
let aosReady = false;
let busy = false;

function currentUnit() {
  return findUnit(board, unitCodeFromUrl());
}

function applyAction(unit) {
  const members = membersOf(board, unit.id);
  const full = members.length >= unit.max_capacity;
  const isMember = actor?.unit_id === unit.id;
  const pending = ownPending(board, actor);
  const isPendingHere = pending?.unit_id === unit.id;

  if (isMember) {
    return `<span class="unit-status is-member">${escapeHtml(t('units.member'))}</span>`;
  }
  if (isPendingHere) {
    return `<span class="unit-status is-pending">${escapeHtml(t('units.pending'))}</span>`;
  }
  if (full) {
    return `<span class="unit-status is-full">${escapeHtml(t('units.full'))}</span>`;
  }
  if (!actor?.unit_id && !pending) {
    return `<button class="btn btn-primary" type="button" data-action="apply" data-unit="${escapeHtml(unit.id)}">${escapeHtml(t('units.apply'))}</button>`;
  }
  if (pending) {
    return `<span class="unit-status">${escapeHtml(t('units.waitOther'))}</span>`;
  }
  return `<span class="unit-status">${escapeHtml(t('units.alreadyAssigned'))}</span>`;
}

function renderPage() {
  const root = document.querySelector('#unit-page');
  const unit = currentUnit();
  if (!unit) {
    root.innerHTML = `<p class="empty-log">${escapeHtml(t('units.notFound'))}</p>`;
    return;
  }

  document.title = `${unit.name} · WHITE LION REGIMENT`;
  const members = membersOf(board, unit.id);
  const announcements = linkedAnnouncements(board, unit.id);
  const isMember = actor?.unit_id === unit.id;
  const memberRank = isMember ? rankTitle(board, actor.unit_rank_id) : '';
  const manage = canManageUnit(actor, unit);

  root.innerHTML = `
    ${unitTabsMarkup(unit.code, 'home', manage)}
    <div class="unit-page-hero">
      <div class="unit-logo-frame">${logoMarkup(unit)}</div>
      <div>
        <p class="unit-code">${escapeHtml(unit.code)}</p>
        <h1 class="page-title">${escapeHtml(unit.name)}</h1>
        <p class="unit-head-meta">${escapeHtml(t('units.capacity'))}: ${members.length}/${unit.max_capacity}</p>
        <p class="unit-head-meta">${escapeHtml(t('units.head'))}: ${escapeHtml(
          unit.head_user_id ? personName(board, unit.head_user_id) : t('units.unassigned')
        )}</p>
        ${memberRank ? `<p class="unit-own-rank">${escapeHtml(t('units.yourRank'))}: ${escapeHtml(memberRank)}</p>` : ''}
      </div>
    </div>
    <div class="unit-card-actions">${applyAction(unit)}</div>
    <section class="unit-panel">
    <h2>${escapeHtml(t('units.content'))}</h2>
    ${
      unit.content
        ? `<p class="unit-briefing">${escapeHtml(unit.content)}</p>`
        : `<p class="unit-content is-empty">${escapeHtml(t('units.noContent'))}</p>`
    }
    ${
      announcements.length
        ? `<ul class="unit-announcements">${announcements
            .map((item) => `<li><a href="./announcements.html">${escapeHtml(item.title)}</a></li>`)
            .join('')}</ul>`
        : `<p class="empty-log">${escapeHtml(t('units.noAnnouncements'))}</p>`
    }
    </section>
    <section class="unit-panel">
    <h2>${escapeHtml(t('units.members'))}</h2>
    ${rosterMarkup(unit, members, board)}
    </section>
  `;
  if (!aosReady) {
    initAos();
    aosReady = true;
  }
}

async function reload() {
  board = await withOverlay(() => fetchUnitBoard(), t('notice.loading'));
  actor = mergeActor(actor, board);
  renderPage();
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
  const button = event.target.closest('[data-action="apply"]');
  if (!button || busy) {
    return;
  }
  busy = true;
  try {
    await withOverlay(async () => {
      await applyToUnit(button.getAttribute('data-unit'));
      board = await fetchUnitBoard();
      actor = mergeActor(actor, board);
    }, t('notice.saving'));
    renderPage();
    showStatus(t('units.applied'));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    busy = false;
  }
});

window.addEventListener('wlr-lang-changed', () => {
  if (board.units.length) {
    renderPage();
  }
});
