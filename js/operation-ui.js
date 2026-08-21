import { logoMarkup } from './unit-common.js';
import { t } from './i18n.js';
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
