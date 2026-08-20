import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import {
  localCreateAnnouncement,
  localDeleteAnnouncement,
  localFetchAnnouncements,
  localJoinAnnouncement,
  localLeaveAnnouncement,
  localCloseAnnouncement,
  localUpdateAnnouncement
} from './local-station.js';

// Returns announcements with { signed_count, is_signed } computed per record.
// SUPABASE INJECT POINT: reads public.announcements and public.announcement_signups.
export async function fetchAnnouncementBoard(currentUserId) {
  let announcements;
  let signups;

  if (isLocalTestMode()) {
    ({ announcements, signups } = await localFetchAnnouncements());
  } else {
    const [announcementResult, signupResult] = await Promise.all([
      supabaseClient.from('announcements').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('announcement_signups').select('announcement_id, user_id')
    ]);
    if (announcementResult.error) {
      throw announcementResult.error;
    }
    if (signupResult.error) {
      throw signupResult.error;
    }
    announcements = announcementResult.data ?? [];
    signups = signupResult.data ?? [];
  }

  return announcements.map((announcement) => {
    const related = signups.filter((row) => row.announcement_id === announcement.id);
    return {
      ...announcement,
      signed_count: related.length,
      is_signed: Boolean(currentUserId && related.some((row) => row.user_id === currentUserId))
    };
  });
}

// SUPABASE STORAGE INJECT POINT: cover image goes to the public
// 'announcement_covers' bucket (RLS allows admin uploads only), then the
// public URL is stored on the announcement row as image_url.
async function uploadCoverImage(imageFile, announcementId) {
  const extension = imageFile.type === 'image/png' ? 'png' : String(imageFile.name.split('.').pop() || 'jpg').toLowerCase();
  const objectPath = announcementId
    ? `${announcementId}/cover.${extension === 'png' ? 'png' : 'jpg'}`
    : `${window.crypto.randomUUID()}.${extension === 'png' ? 'png' : 'jpg'}`;

  const { error } = await supabaseClient.storage
    .from('announcement_covers')
    .upload(objectPath, imageFile, {
      cacheControl: '3600',
      upsert: Boolean(announcementId),
      contentType: imageFile.type || 'image/jpeg'
    });
  if (error) {
    throw error;
  }

  const { data } = supabaseClient.storage.from('announcement_covers').getPublicUrl(objectPath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Cover image could not be read.'));
    reader.readAsDataURL(file);
  });
}

// SUPABASE INJECT POINT: insert into public.announcements (RLS allows admins only).
export async function createAnnouncement({
  title,
  content,
  maxCapacity,
  createdBy,
  imageFile,
  awardHonorEnabled = false,
  honorRankTitle = null
}) {
  const honorPayload = {
    award_honor_enabled: Boolean(awardHonorEnabled),
    honor_rank_title: awardHonorEnabled ? String(honorRankTitle || '').trim() || null : null
  };

  if (isLocalTestMode()) {
    const imageUrl = imageFile ? await fileToDataUrl(imageFile) : null;
    return localCreateAnnouncement({
      title,
      content,
      maxCapacity,
      createdBy,
      imageUrl,
      ...honorPayload
    });
  }

  const imageUrl = imageFile ? await uploadCoverImage(imageFile) : null;

  const { data, error } = await supabaseClient
    .from('announcements')
    .insert({
      title,
      content,
      max_capacity: maxCapacity,
      created_by: createdBy,
      image_url: imageUrl,
      ...honorPayload
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
}

function honorPayload({ awardHonorEnabled = false, honorRankTitle = null }) {
  return {
    award_honor_enabled: Boolean(awardHonorEnabled),
    honor_rank_title: awardHonorEnabled ? String(honorRankTitle || '').trim() || null : null
  };
}

export async function updateAnnouncement(announcementId, {
  title,
  content,
  maxCapacity,
  imageFile,
  awardHonorEnabled = false,
  honorRankTitle = null
}) {
  const payload = {
    title,
    content,
    max_capacity: maxCapacity,
    ...honorPayload({ awardHonorEnabled, honorRankTitle })
  };

  if (isLocalTestMode()) {
    if (imageFile) {
      payload.image_url = await fileToDataUrl(imageFile);
    }
    return localUpdateAnnouncement(announcementId, payload);
  }

  if (imageFile) {
    payload.image_url = await uploadCoverImage(imageFile, announcementId);
  }

  const { data, error } = await supabaseClient
    .from('announcements')
    .update(payload)
    .eq('id', announcementId)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
}

// SUPABASE INJECT POINT: admin-only RPC close_announcement sets ended_at
// and optionally awards honor_ranks to remaining signups.
export async function closeAnnouncement(announcementId) {
  if (isLocalTestMode()) {
    return localCloseAnnouncement(announcementId);
  }

  const { data, error } = await supabaseClient.rpc('close_announcement', {
    p_announcement_id: announcementId
  });
  if (error) {
    throw error;
  }
  return data;
}

// SUPABASE INJECT POINT: delete from public.announcements (admin-only via RLS);
// signups cascade automatically at the database level.
export async function deleteAnnouncement(announcementId) {
  if (isLocalTestMode()) {
    return localDeleteAnnouncement(announcementId);
  }

  const { error } = await supabaseClient.from('announcements').delete().eq('id', announcementId);
  if (error) {
    throw error;
  }
}

// SUPABASE INJECT POINT: insert into public.announcement_signups.
// A database trigger rejects the insert once max_capacity is reached.
export async function joinAnnouncement(announcementId, userId) {
  if (isLocalTestMode()) {
    return localJoinAnnouncement(announcementId, userId);
  }

  const { error } = await supabaseClient
    .from('announcement_signups')
    .insert({ announcement_id: announcementId, user_id: userId });
  if (error) {
    throw error;
  }
}

// SUPABASE INJECT POINT: delete own row from public.announcement_signups.
export async function leaveAnnouncement(announcementId, userId) {
  if (isLocalTestMode()) {
    return localLeaveAnnouncement(announcementId, userId);
  }

  const { error } = await supabaseClient
    .from('announcement_signups')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}
