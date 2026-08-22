import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import { emptySettingsRow } from './user-prefs.js';
import {
  localFetchLogs,
  localFetchOwnSettings,
  localFetchSettings,
  localSystemStatus,
  localUpsertSettings,
  localWriteLog
} from './local-station.js';

export async function fetchSettingsMap() {
  if (isLocalTestMode()) {
    const rows = await localFetchSettings();
    return Object.fromEntries(rows.map((row) => [row.user_id, row]));
  }

  const { data, error } = await supabaseClient.from('user_settings').select('*');
  if (error) {
    throw error;
  }
  return Object.fromEntries((data ?? []).map((row) => [row.user_id, row]));
}

export async function fetchOwnSettings(userId) {
  if (isLocalTestMode()) {
    return localFetchOwnSettings(userId);
  }

  const { data, error } = await supabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data || emptySettingsRow(userId);
}

export async function saveOwnSettings(userId, payload) {
  if (isLocalTestMode()) {
    return localUpsertSettings(userId, payload);
  }

  const { data, error } = await supabaseClient
    .from('user_settings')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function writeActivityLog({ userId, roleSnapshot, actionType, details }) {
  if (isLocalTestMode()) {
    return localWriteLog({ userId, roleSnapshot, actionType, details });
  }

  const { error } = await supabaseClient.from('activity_logs').insert({
    user_id: userId,
    role_snapshot: roleSnapshot || null,
    action_type: actionType,
    details: details || ''
  });
  if (error) {
    throw error;
  }
}

export async function fetchActivityLogs(isAdmin, userId) {
  if (isLocalTestMode()) {
    return localFetchLogs(isAdmin, userId);
  }

  let query = supabaseClient
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data ?? [];
}

export function isUserLog(actionType) {
  return ['profile_update', 'theme_update', 'privacy_update', 'avatar_update'].includes(actionType);
}

export function isAdminLog(actionType) {
  return ['rank_update', 'admin_grant', 'admin_revoke', 'personnel_edit', 'personnel_delete', 'announcement_close'].includes(actionType);
}

export async function measureCommandStatus() {
  const started = performance.now();
  if (isLocalTestMode()) {
    const status = localSystemStatus();
    return {
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      ...status,
      source: 'local'
    };
  }

  const pingStarted = performance.now();
  const { error: pingError } = await supabaseClient.from('oc_rank_structure').select('rank_title').limit(1);
  const latencyMs = Math.round(performance.now() - pingStarted);
  if (pingError) {
    throw pingError;
  }

  const { data, error } = await supabaseClient.rpc('command_system_status');
  if (error) {
    throw error;
  }

  return {
    latencyMs,
    storage_used_bytes: data.storage_used_bytes,
    storage_limit_bytes: data.storage_limit_bytes,
    storage_remaining_bytes: data.storage_remaining_bytes,
    source: 'supabase'
  };
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
