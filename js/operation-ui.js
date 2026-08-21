import { logoMarkup } from './unit-common.js';
import { getLang, t } from './i18n.js';
import { escapeHtml } from './ui.js';

export function statusLabel(status) {
  return t(`ops.status.${status}`) || status;
}

export function statusBadge(status) {
  const key = status === 'active' || status === 'completed' || status === 'planning' ? status : 'planning';
  return `<span class="badge badge-op-${key}">${escapeHtml(statusLabel(key))}</span>`;
}

export function briefingHtml(text) {
  return escapeHtml(text || '').replace(/\n/g, '<br>');
}

export function unitsForSide(units, sides, operationId, side) {
  const ids = new Set(
    sides.filter((row) => row.operation_id === operationId && row.side === side).map((row) => row.unit_id)
  );
  return units.filter((unit) => ids.has(unit.id));
}

export function factionStackMarkup(units, { compact = false, removable = false } = {}) {
  if (!units.length) {
    return `<p class="empty-log">${escapeHtml(t('ops.noUnitsAssigned'))}</p>`;
  }
  const logoClass = compact ? 'unit-logo-sm' : 'unit-logo';
  return `
    <ul class="ops-unit-stack">
      ${units
        .map(
          (unit) => `
            <li class="ops-unit-chip">
              ${logoMarkup(unit, logoClass, false)}
              <span>
                <strong>${escapeHtml(unit.name)}</strong>
                <small>${escapeHtml(unit.code)}</small>
              </span>
              ${
                removable
                  ? `<button class="btn btn-inline" type="button" data-remove-unit="${escapeHtml(unit.id)}">${escapeHtml(t('ops.assign.remove'))}</button>`
                  : ''
              }
            </li>
          `
        )
        .join('')}
    </ul>
  `;
}

export function factionBoardMarkup(allies, objectives, { compact = false } = {}) {
  return `
    <div class="ops-factions">
      <section class="ops-faction ops-faction-allies">
        <h2>${escapeHtml(t('ops.allies'))}</h2>
        ${factionStackMarkup(allies, { compact })}
      </section>
      <section class="ops-faction ops-faction-objectives">
        <h2>${escapeHtml(t('ops.objectives'))}</h2>
        ${factionStackMarkup(objectives, { compact })}
      </section>
    </div>
  `;
}

export function filedDate(iso) {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(getLang() === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

export function docId(operation) {
  return String(operation?.id || '')
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase() || '—';
}

function overviewCell(units) {
  if (!units.length) {
    return escapeHtml(t('ops.noUnitsAssigned'));
  }
  return factionStackMarkup(units, { compact: true });
}

export function overviewGridMarkup(operation, allies, objectives) {
  return `
    <table class="ops-doc-grid">
      <tbody>
        <tr>
          <th>${escapeHtml(t('ops.doc.operationName'))}</th>
          <td>${escapeHtml(operation.title || '—')}</td>
          <th>${escapeHtml(t('ops.statusLabel'))}</th>
          <td>${escapeHtml(statusLabel(operation.status))}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('ops.auth.officer'))}</th>
          <td>${escapeHtml(String(operation.commanding_officer || '').trim() || t('ops.auth.unsigned'))}</td>
          <th>${escapeHtml(t('ops.doc.date'))}</th>
          <td>${escapeHtml(filedDate(operation.created_at))}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('ops.allies'))}</th>
          <td>${overviewCell(allies)}</td>
          <th>${escapeHtml(t('ops.objectives'))}</th>
          <td>${overviewCell(objectives)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

export function authorizationMarkup(operation) {
  const name = String(operation?.commanding_officer || '').trim();
  const approved = operation?.status === 'completed' && Boolean(name);
  const stampClass = approved ? 'ops-stamp-approved' : 'ops-stamp-restricted';
  const stampLabel = approved ? t('ops.auth.approved') : t('ops.auth.restricted');
  return `
    <section class="ops-doc-section ops-auth" aria-label="${escapeHtml(t('ops.auth.title'))}">
      <h2>${escapeHtml(t('ops.doc.auth'))}</h2>
      <div class="ops-auth-grid">
        <div class="ops-auth-sign">
          <p class="ops-auth-kicker">${escapeHtml(t('ops.auth.officer'))}</p>
          <p class="ops-auth-name">${escapeHtml(name || t('ops.auth.unsigned'))}</p>
          <p class="ops-auth-rule" aria-hidden="true"></p>
          <p class="ops-auth-role">${escapeHtml(t('ops.auth.role'))}</p>
        </div>
        <div class="ops-auth-stamp-wrap">
          <div class="ops-stamp ${stampClass}">${escapeHtml(stampLabel)}</div>
        </div>
      </div>
    </section>
  `;
}
