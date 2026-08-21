import { isAdmin, canManageUnit } from './unit-common.js';

export const MEMO_FOLDERS = ['normal', 'unit_leader', 'admin', 'dev'];

// Dev is a hidden status, not a military rank and not app role admin/user.
export function isDev(person) {
  return Boolean(person?.is_dev);
}

export function isUnitLeader(person, units = []) {
  return Boolean(person && units.some((unit) => unit.head_user_id === person.id));
}

export function visiblePersonnel(records, viewer) {
  const rows = Array.isArray(records) ? records : [];
  // Dev check: non-Dev viewers never see Dev personnel in directories.
  if (isDev(viewer)) {
    return rows;
  }
  return rows.filter((row) => !row.is_dev || row.id === viewer?.id);
}

export function visibleMemoFolders(person, units = []) {
  // Dev check: only Devs receive the Dev folder.
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
