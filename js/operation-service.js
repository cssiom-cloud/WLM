import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import {
  localDeleteOperation,
  localFetchOperations,
  localSaveOperation,
  localSaveOperationAar
} from './local-station.js';

export const OPERATION_STATUSES = ['planning', 'active', 'completed'];

export function canPlanOperations(actor, units = []) {
  if (!actor) {
    return false;
  }
  if (actor.role === 'admin') {
    return true;
  }
  return units.some((unit) => unit.head_user_id === actor.id);
}

export function canEditOperation(actor, operation, units = [], sides = []) {
  if (!actor || !operation) {
    return false;
  }
  if (actor.role === 'admin') {
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
  return Boolean(actor && operation && (actor.role === 'admin' || operation.created_by === actor.id));
}

function normalizeDrawings(value) {
  return Array.isArray(value) ? value : [];
}

export async function fetchOperationBoard() {
  if (isLocalTestMode()) {
    const local = await localFetchOperations();
    return {
      operations: (local.operations || []).map((row) => ({ ...row, drawings: normalizeDrawings(row.drawings) })),
      sides: local.sides || [],
      aars: local.aars || []
    };
  }

  const [opsResult, sidesResult, aarResult] = await Promise.all([
    supabaseClient.from('oc_operations').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('oc_operation_sides').select('*'),
    supabaseClient.from('oc_operation_aar').select('*')
  ]);
  const firstError = opsResult.error || sidesResult.error || aarResult.error;
  if (firstError) {
    throw firstError;
  }
  return {
    operations: (opsResult.data ?? []).map((row) => ({ ...row, drawings: normalizeDrawings(row.drawings) })),
    sides: sidesResult.data ?? [],
    aars: aarResult.data ?? []
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Map image could not be read.'));
    reader.readAsDataURL(file);
  });
}

async function uploadMapImage(imageFile, operationId) {
  const extension = imageFile.type === 'image/png' ? 'png' : String(imageFile.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = extension === 'png' ? 'png' : 'jpg';
  const objectPath = `${operationId}/map.${safeExt}`;
  const { error } = await supabaseClient.storage.from('operation_maps').upload(objectPath, imageFile, {
    cacheControl: '3600',
    upsert: true,
    contentType: imageFile.type || 'image/jpeg'
  });
  if (error) {
    throw error;
  }
  const { data } = supabaseClient.storage.from('operation_maps').getPublicUrl(objectPath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function saveOperation(payload) {
  const {
    id,
    title,
    briefing,
    status,
    drawings,
    sides,
    mapFile,
    mapUrl,
    createdBy,
    commandingOfficer
  } = payload;

  if (isLocalTestMode()) {
    let storedMap = mapUrl || '';
    if (mapFile) {
      storedMap = await fileToDataUrl(mapFile);
    }
    return localSaveOperation({
      id,
      title,
      briefing,
      status,
      drawings: normalizeDrawings(drawings),
      sides,
      map_url: storedMap,
      created_by: createdBy,
      commanding_officer: commandingOfficer || ''
    });
  }

  const operationId = id || window.crypto.randomUUID();
  let nextMapUrl = mapUrl || null;
  if (mapFile) {
    nextMapUrl = await uploadMapImage(mapFile, operationId);
  }

  const row = {
    id: operationId,
    title,
    briefing: briefing || '',
    status: OPERATION_STATUSES.includes(status) ? status : 'planning',
    drawings: normalizeDrawings(drawings),
    map_url: nextMapUrl,
    commanding_officer: commandingOfficer || ''
  };

  if (id) {
    const { id: _id, ...patch } = row;
    const { error } = await supabaseClient.from('oc_operations').update(patch).eq('id', operationId);
    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabaseClient.from('oc_operations').insert({
      ...row,
      created_by: createdBy
    });
    if (error) {
      throw error;
    }
  }

  const { error: deleteError } = await supabaseClient.from('oc_operation_sides').delete().eq('operation_id', operationId);
  if (deleteError) {
    throw deleteError;
  }
  const nextSides = (sides || []).filter((item) => item.unit_id && item.side);
  if (nextSides.length) {
    const { error: sideError } = await supabaseClient.from('oc_operation_sides').insert(
      nextSides.map((item) => ({
        operation_id: operationId,
        unit_id: item.unit_id,
        side: item.side
      }))
    );
    if (sideError) {
      throw sideError;
    }
  }
  return operationId;
}

export async function deleteOperation(operationId) {
  if (isLocalTestMode()) {
    return localDeleteOperation(operationId);
  }
  const { error } = await supabaseClient.from('oc_operations').delete().eq('id', operationId);
  if (error) {
    throw error;
  }
}

export async function saveOperationAar(operationId, unitId, evaluation, authoredBy) {
  if (isLocalTestMode()) {
    return localSaveOperationAar({
      operation_id: operationId,
      unit_id: unitId,
      evaluation,
      authored_by: authoredBy
    });
  }
  const { error } = await supabaseClient.from('oc_operation_aar').upsert({
    operation_id: operationId,
    unit_id: unitId,
    evaluation: evaluation || '',
    authored_by: authoredBy
  });
  if (error) {
    throw error;
  }
}
