import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import { comparePersonnelByRank } from './domain.js';
import {
  localDeletePersonnelAccount,
  localFetchLoginAccounts,
  localFetchRoster,
  localUpdateLoginCredentials,
  localUpdatePersonnel,
  localUploadPersonnelImage
} from './local-station.js';

export async function fetchPersonnelRoster() {
  if (isLocalTestMode()) {
    const data = await localFetchRoster();
    return data.slice().sort(comparePersonnelByRank);
  }

  const { data, error } = await supabaseClient.from('oc_personnel').select('*');
  if (error) {
    throw error;
  }
  return (data ?? []).slice().sort(comparePersonnelByRank);
}

export async function updatePersonnelRecord(personnelId, payload) {
  if (isLocalTestMode()) {
    return localUpdatePersonnel(personnelId, payload);
  }

  const { data, error } = await supabaseClient
    .from('oc_personnel')
    .update(payload)
    .eq('id', personnelId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function uploadPersonnelImage(userId, file, field = 'avatar_url') {
  const safeField = field === 'cover_url' ? 'cover_url' : 'avatar_url';
  if (isLocalTestMode()) {
    return localUploadPersonnelImage(userId, file, safeField);
  }

  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const stem = safeField === 'cover_url' ? 'cover' : 'avatar';
  const objectPath = `${userId}/${stem}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage.from('oc_avatars').upload(objectPath, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || (extension === 'png' ? 'image/png' : 'image/jpeg')
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient.storage.from('oc_avatars').getPublicUrl(objectPath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  return updatePersonnelRecord(userId, { [safeField]: publicUrl });
}

export async function uploadPersonnelAvatar(userId, file) {
  return uploadPersonnelImage(userId, file, 'avatar_url');
}

export async function deletePersonnelAccount(userId) {
  if (isLocalTestMode()) {
    return localDeletePersonnelAccount(userId);
  }

  const { error } = await supabaseClient.rpc('delete_personnel_account', { p_user_id: userId });
  if (error) {
    throw error;
  }
}

export async function fetchLoginAccounts() {
  if (isLocalTestMode()) {
    const data = await localFetchLoginAccounts();
    return data.slice().sort(comparePersonnelByRank);
  }

  const roster = await fetchPersonnelRoster();
  return roster.map((record) => ({
    ...record,
    login_password: null,
    has_login: true
  }));
}

export async function updateLoginCredentials(userId, { email, password }) {
  if (isLocalTestMode()) {
    return localUpdateLoginCredentials(userId, { email, password });
  }

  const { error } = await supabaseClient.rpc('admin_update_login_credentials', {
    p_user_id: userId,
    p_email: email || null,
    p_password: password || null
  });
  if (error) {
    throw error;
  }
}

export function uniqueAgencyValues(records) {
  return [...new Set(records.map((record) => record.wlc_agency).filter(Boolean))].sort();
}
