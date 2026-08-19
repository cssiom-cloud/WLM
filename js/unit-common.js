import { formatPersonnelName } from './domain.js';
import { escapeHtml } from './ui.js';
import { t } from './i18n.js';

export function emptyUnitBoard() {
  return {
    units: [],
    ranks: [],
    links: [],
    applications: [],
    personnel: [],
    announcements: []
  };
}

export function unitCodeFromUrl() {
  return new URLSearchParams(window.location.search).get('code') || '';
}

export function findUnit(board, code) {
  return board.units.find((unit) => unit.code === code) || null;
}

export function isAdmin(actor) {
  return actor?.role === 'admin';
}

export function canManageUnit(actor, unit) {
  return Boolean(unit) && (isAdmin(actor) || unit.head_user_id === actor?.id);
}

export function personName(board, userId) {
  const person = board.personnel.find((row) => row.id === userId);
  return person ? formatPersonnelName(person) || t('units.unnamed') : t('units.unassigned');
}

export function membersOf(board, unitId) {
  return board.personnel.filter((row) => row.unit_id === unitId);
}

export function ranksOf(board, unitId) {
  return board.ranks
    .filter((row) => row.unit_id === unitId)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function pendingOf(board, unitId) {
  return board.applications.filter((row) => row.unit_id === unitId && row.status === 'pending');
}

export function linkedAnnouncements(board, unitId) {
  const ids = new Set(
    board.links.filter((row) => row.unit_id === unitId).map((row) => row.announcement_id)
  );
  return board.announcements.filter((row) => ids.has(row.id));
}

export function ownPending(board, actor) {
  return board.applications.find((row) => row.user_id === actor?.id && row.status === 'pending') || null;
}

export function rankTitle(board, rankId) {
  return board.ranks.find((row) => row.id === rankId)?.title || '';
}

export function mergeActor(actor, board) {
  const fresh = board.personnel.find((row) => row.id === actor.id);
  return fresh ? { ...actor, ...fresh } : actor;
}

export function excerptText(content, limit = 90) {
  const text = String(content || '').trim().replace(/\s+/g, ' ');
  if (!text) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit).trim()}…`;
}

export function logoMarkup(unit, className = 'unit-logo-lg', clickable = true) {
  const image = unit.logo_url
    ? `<img class="${className}" src="${escapeHtml(unit.logo_url)}" alt="${escapeHtml(unit.name)}">`
    : `<div class="${className} unit-logo-fallback">${escapeHtml(unit.code)}</div>`;
  if (clickable && unit.logo_link) {
    return `<a href="${escapeHtml(unit.logo_link)}" target="_blank" rel="noopener noreferrer">${image}</a>`;
  }
  return image;
}

export function unitTabsMarkup(code, active, canManage) {
  const encoded = encodeURIComponent(code);
  const homeClass = active === 'home' ? ' is-active' : '';
  const manageClass = active === 'manage' ? ' is-active' : '';
  return `
    <nav class="unit-tabs" aria-label="${escapeHtml(t('units.tabs'))}">
      <a class="unit-tab${homeClass}" href="./unit.html?code=${encoded}">${escapeHtml(t('units.tabHome'))}</a>
      ${
        canManage
          ? `<a class="unit-tab${manageClass}" href="./unit-manage.html?code=${encoded}">${escapeHtml(t('units.tabManage'))}</a>`
          : ''
      }
    </nav>
  `;
}

export function rosterMarkup(unit, members, board) {
  if (!members.length) {
    return `<p class="empty-log">${escapeHtml(t('units.noMembers'))}</p>`;
  }
  const rows = members
    .slice()
    .sort((a, b) => {
      const headA = a.id === unit.head_user_id ? 0 : 1;
      const headB = b.id === unit.head_user_id ? 0 : 1;
      if (headA !== headB) {
        return headA - headB;
      }
      return formatPersonnelName(a).localeCompare(formatPersonnelName(b));
    })
    .map((member) => {
      const isHead = member.id === unit.head_user_id;
      const unitRank = rankTitle(board, member.unit_rank_id) || t('units.noUnitRank');
      const serviceRank = member.military_rank || '—';
      return `
        <li class="unit-roster-row${isHead ? ' is-head' : ''}">
          <div>
            <strong>${escapeHtml(formatPersonnelName(member) || t('units.unnamed'))}</strong>
            ${isHead ? `<span class="unit-head-badge">${escapeHtml(t('units.head'))}</span>` : ''}
          </div>
          <span>${escapeHtml(serviceRank)}</span>
          <span>${escapeHtml(unitRank)}</span>
        </li>
      `;
    })
    .join('');
  return `
    <ul class="unit-roster-list">
      <li class="unit-roster-row is-header">
        <span>${escapeHtml(t('units.memberName'))}</span>
        <span>${escapeHtml(t('units.serviceRank'))}</span>
        <span>${escapeHtml(t('units.yourRank'))}</span>
      </li>
      ${rows}
    </ul>
  `;
}
