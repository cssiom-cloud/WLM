import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import {
  localApplyToUnit,
  localFetchUnitBoard,
  localRemoveUnitMember,
  localReviewUnitApplication,
  localSaveUnit,
  localSaveUnitRank,
  localDeleteUnitRank,
  localSetUnitAnnouncements,
  localSetUnitHead,
  localSetUnitMemberRank
} from './local-station.js';

export async function fetchUnitBoard() {
  if (isLocalTestMode()) {
    return localFetchUnitBoard();
  }

  const [unitsResult, ranksResult, linksResult, appsResult, peopleResult, announcementsResult] = await Promise.all([
    supabaseClient.from('command_units').select('*').order('sort_order', { ascending: true }),
    supabaseClient.from('command_unit_ranks').select('*').order('sort_order', { ascending: true }),
    supabaseClient.from('command_unit_announcements').select('*'),
    supabaseClient.from('command_unit_applications').select('*'),
    supabaseClient.from('oc_personnel').select('id, first_name, middle_name, last_name, role, unit_id, unit_rank_id, honor_ranks'),
    supabaseClient.from('announcements').select('id, title').order('created_at', { ascending: false })
  ]);

  const firstError =
    unitsResult.error ||
    ranksResult.error ||
    linksResult.error ||
    appsResult.error ||
    peopleResult.error ||
    announcementsResult.error;
  if (firstError) {
    throw firstError;
  }

  return {
    units: unitsResult.data ?? [],
    ranks: ranksResult.data ?? [],
    links: linksResult.data ?? [],
    applications: appsResult.data ?? [],
    personnel: peopleResult.data ?? [],
    announcements: announcementsResult.data ?? []
  };
}

export async function applyToUnit(unitId) {
  if (isLocalTestMode()) {
    return localApplyToUnit(unitId);
  }
  const { error } = await supabaseClient.rpc('apply_to_unit', { p_unit_id: unitId });
  if (error) {
    throw error;
  }
}

export async function reviewUnitApplication(applicationId, approve) {
  if (isLocalTestMode()) {
    return localReviewUnitApplication(applicationId, approve);
  }
  const { error } = await supabaseClient.rpc('review_unit_application', {
    p_application_id: applicationId,
    p_approve: approve
  });
  if (error) {
    throw error;
  }
}

export async function setUnitHead(unitId, userId) {
  if (isLocalTestMode()) {
    return localSetUnitHead(unitId, userId);
  }
  const { error } = await supabaseClient.rpc('set_unit_head', {
    p_unit_id: unitId,
    p_user_id: userId
  });
  if (error) {
    throw error;
  }
}

export async function saveUnitDetails(unitId, payload) {
  if (isLocalTestMode()) {
    return localSaveUnit(unitId, payload);
  }
  const { error } = await supabaseClient.from('command_units').update(payload).eq('id', unitId);
  if (error) {
    throw error;
  }
}

export async function saveUnitRank(entry) {
  if (isLocalTestMode()) {
    return localSaveUnitRank(entry);
  }
  if (entry.id) {
    const { error } = await supabaseClient
      .from('command_unit_ranks')
      .update({ title: entry.title, sort_order: entry.sort_order })
      .eq('id', entry.id);
    if (error) {
      throw error;
    }
    return;
  }
  const { error } = await supabaseClient.from('command_unit_ranks').insert({
    unit_id: entry.unit_id,
    title: entry.title,
    sort_order: entry.sort_order ?? 0
  });
  if (error) {
    throw error;
  }
}

export async function deleteUnitRank(rankId) {
  if (isLocalTestMode()) {
    return localDeleteUnitRank(rankId);
  }
  const { error } = await supabaseClient.from('command_unit_ranks').delete().eq('id', rankId);
  if (error) {
    throw error;
  }
}

export async function setUnitAnnouncements(unitId, announcementIds) {
  if (isLocalTestMode()) {
    return localSetUnitAnnouncements(unitId, announcementIds);
  }
  const { error: deleteError } = await supabaseClient
    .from('command_unit_announcements')
    .delete()
    .eq('unit_id', unitId);
  if (deleteError) {
    throw deleteError;
  }
  if (!announcementIds.length) {
    return;
  }
  const { error } = await supabaseClient.from('command_unit_announcements').insert(
    announcementIds.map((announcementId) => ({ unit_id: unitId, announcement_id: announcementId }))
  );
  if (error) {
    throw error;
  }
}

export async function setUnitMemberRank(userId, rankId) {
  if (isLocalTestMode()) {
    return localSetUnitMemberRank(userId, rankId);
  }
  const { error } = await supabaseClient.rpc('set_unit_member_rank', {
    p_user_id: userId,
    p_rank_id: rankId
  });
  if (error) {
    throw error;
  }
}

export async function removeUnitMember(userId) {
  if (isLocalTestMode()) {
    return localRemoveUnitMember(userId);
  }
  const { error } = await supabaseClient.rpc('remove_unit_member', { p_user_id: userId });
  if (error) {
    throw error;
  }
}
