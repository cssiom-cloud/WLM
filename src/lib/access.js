import { getJsxBase, getSiteBasePath, isReactRuntime } from '../../js/ui-mode.js';

export function isAdmin(person) {
  return person?.role === 'admin';
}

export function isDev(person) {
  return Boolean(person?.is_dev);
}

export function isUnitLeader(person, units = []) {
  return Boolean(person && units.some((unit) => unit.head_user_id === person.id));
}

export function canManageUnit(person, unit) {
  return Boolean(unit) && (isAdmin(person) || unit.head_user_id === person?.id);
}

export function visiblePersonnel(records, viewer) {
  const rows = Array.isArray(records) ? records : [];
  if (isDev(viewer)) {
    return rows;
  }
  return rows.filter(
    (row) => !row.is_dev || row.id === viewer?.id || row.owner_user_id === viewer?.owner_user_id
  );
}

export function visibleMemoFolders(person, units = []) {
  if (isDev(person)) {
    return ['normal', 'unit_leader', 'admin', 'dev'];
  }
  if (isAdmin(person)) {
    return ['normal', 'unit_leader', 'admin'];
  }
  if (isUnitLeader(person, units) || units.some((unit) => canManageUnit(person, unit))) {
    return ['normal', 'unit_leader'];
  }
  return person ? ['normal'] : [];
}

export function canAccessMemoFolder(person, folder, units = []) {
  return visibleMemoFolders(person, units).includes(folder);
}

export function canEditMemo(person, doc, units = []) {
  if (!person || !doc || !canAccessMemoFolder(person, doc.folder, units)) {
    return false;
  }
  return doc.created_by === person.id || isAdmin(person) || isDev(person);
}

export function canPlanOperations(actor, units = []) {
  if (!actor) {
    return false;
  }
  if (isAdmin(actor)) {
    return true;
  }
  return units.some((unit) => unit.head_user_id === actor.id);
}

export function canEditOperation(actor, operation, units = [], sides = []) {
  if (!actor || !operation) {
    return false;
  }
  if (isAdmin(actor)) {
    return true;
  }
  if (operation.created_by === actor.id) {
    return true;
  }
  return sides
    .filter((row) => row.operation_id === operation.id)
    .some((row) => units.some((unit) => unit.id === row.unit_id && unit.head_user_id === actor.id));
}

export function canDeleteOperation(actor, operation) {
  return Boolean(actor && operation && (isAdmin(actor) || operation.created_by === actor.id));
}

export function membersOf(board, unitId) {
  return (board.personnel || []).filter((row) => row.unit_id === unitId);
}

export function ranksOf(board, unitId) {
  return (board.ranks || [])
    .filter((row) => row.unit_id === unitId)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function pendingOf(board, unitId) {
  return (board.applications || []).filter((row) => row.unit_id === unitId && row.status === 'pending');
}

export function linkedAnnouncements(board, unitId) {
  const ids = new Set(
    (board.links || []).filter((row) => row.unit_id === unitId).map((row) => row.announcement_id)
  );
  return (board.announcements || []).filter((row) => ids.has(row.id));
}

export function ownPending(board, actor) {
  return (board.applications || []).find((row) => row.user_id === actor?.id && row.status === 'pending') || null;
}

export function excerptText(content, limit = 90) {
  const text = String(content || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit).trim()}…`;
}

export function unitsForSide(units, sides, operationId, side) {
  const ids = new Set(
    (sides || []).filter((row) => row.operation_id === operationId && row.side === side).map((row) => row.unit_id)
  );
  return (units || []).filter((unit) => ids.has(unit.id));
}

export function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function oauthRedirectTo(path = '/') {
  const origin = window.location.origin;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (isReactRuntime()) {
    return `${origin}${getJsxBase()}${suffix === '/' ? '' : suffix}`;
  }
  const site = getSiteBasePath();
  return `${origin}${site}${suffix}`;
}
