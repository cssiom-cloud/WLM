import { comparePersonnelByRank } from '../../js/domain.js';
import { emptySettingsRow } from '../../js/user-prefs.js';
import { decorateAnnouncement } from '../../js/announce-meta.js';

export async function fetchPersonnelRoster(supabase) {
  const { data, error } = await supabase.from('oc_personnel').select('*');
  if (error) {
    throw error;
  }
  return (data || []).slice().sort(comparePersonnelByRank);
}

export function uniqueAgencyValues(records) {
  return [...new Set((records || []).map((record) => record.wlc_agency).filter(Boolean))].sort();
}

export async function updatePersonnelRecord(supabase, personnelId, payload) {
  const { data, error } = await supabase.from('oc_personnel').update(payload).eq('id', personnelId).select().single();
  if (error) {
    throw error;
  }
  return data;
}

export async function uploadPersonnelImage(supabase, personnelId, file, field = 'avatar_url', authUserId) {
  const safeField = field === 'cover_url' ? 'cover_url' : 'avatar_url';
  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const stem = safeField === 'cover_url' ? 'cover' : 'avatar';
  const folder = personnelId || authUserId;
  const objectPath = `${folder}/${stem}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('oc_avatars').upload(objectPath, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || (extension === 'png' ? 'image/png' : 'image/jpeg')
  });
  if (uploadError) {
    throw uploadError;
  }
  const { data } = supabase.storage.from('oc_avatars').getPublicUrl(objectPath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  return updatePersonnelRecord(supabase, personnelId, { [safeField]: publicUrl });
}

export async function deletePersonnelAccount(supabase, userId) {
  const { error } = await supabase.rpc('delete_personnel_account', { p_user_id: userId });
  if (error) {
    throw error;
  }
}

export async function fetchLoginAccounts(supabase) {
  const roster = await fetchPersonnelRoster(supabase);
  return roster.map((record) => ({ ...record, login_password: null, has_login: true }));
}

export async function updateLoginCredentials(supabase, userId, { email, password }) {
  const { error } = await supabase.rpc('admin_update_login_credentials', {
    p_user_id: userId,
    p_email: email || null,
    p_password: password || null
  });
  if (error) {
    throw error;
  }
}

export async function fetchRankStructure(supabase) {
  const { data, error } = await supabase
    .from('oc_rank_structure')
    .select('rank_title, nato_grade, sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function createPersonnelProfile(supabase, { firstName = '', lastName = '' } = {}) {
  const { data, error } = await supabase.rpc('create_personnel_profile', {
    p_first_name: firstName,
    p_last_name: lastName
  });
  if (error) {
    throw error;
  }
  const { data: row, error: rowError } = await supabase.from('oc_personnel').select('*').eq('id', data).single();
  if (rowError) {
    throw rowError;
  }
  return row;
}

export async function fetchUnitBoard(supabase) {
  const [unitsResult, ranksResult, linksResult, appsResult, peopleResult, announcementsResult] = await Promise.all([
    supabase.from('command_units').select('*').order('sort_order', { ascending: true }),
    supabase.from('command_unit_ranks').select('*').order('sort_order', { ascending: true }),
    supabase.from('command_unit_announcements').select('*'),
    supabase.from('command_unit_applications').select('*'),
    supabase
      .from('oc_personnel')
      .select('id, first_name, middle_name, last_name, role, military_rank, unit_id, unit_rank_id, honor_ranks, is_dev, avatar_url'),
    supabase.from('announcements').select('id, title').order('created_at', { ascending: false })
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
    units: unitsResult.data || [],
    ranks: ranksResult.data || [],
    links: linksResult.data || [],
    applications: appsResult.data || [],
    personnel: peopleResult.data || [],
    announcements: announcementsResult.data || []
  };
}

export async function applyToUnit(supabase, unitId) {
  const { error } = await supabase.rpc('apply_to_unit', { p_unit_id: unitId });
  if (error) {
    throw error;
  }
}

export async function reviewUnitApplication(supabase, applicationId, approve) {
  const { error } = await supabase.rpc('review_unit_application', {
    p_application_id: applicationId,
    p_approve: approve
  });
  if (error) {
    throw error;
  }
}

export async function setUnitHead(supabase, unitId, userId) {
  const { error } = await supabase.rpc('set_unit_head', { p_unit_id: unitId, p_user_id: userId });
  if (error) {
    throw error;
  }
}

export async function saveUnitDetails(supabase, unitId, payload) {
  const { error } = await supabase.from('command_units').update(payload).eq('id', unitId);
  if (error) {
    throw error;
  }
}

export async function saveUnitRank(supabase, entry) {
  if (entry.id) {
    const { error } = await supabase
      .from('command_unit_ranks')
      .update({ title: entry.title, sort_order: entry.sort_order })
      .eq('id', entry.id);
    if (error) {
      throw error;
    }
    return;
  }
  const { error } = await supabase.from('command_unit_ranks').insert({
    unit_id: entry.unit_id,
    title: entry.title,
    sort_order: entry.sort_order ?? 0
  });
  if (error) {
    throw error;
  }
}

export async function deleteUnitRank(supabase, rankId) {
  const { error } = await supabase.from('command_unit_ranks').delete().eq('id', rankId);
  if (error) {
    throw error;
  }
}

export async function setUnitAnnouncements(supabase, unitId, announcementIds) {
  const { error: deleteError } = await supabase.from('command_unit_announcements').delete().eq('unit_id', unitId);
  if (deleteError) {
    throw deleteError;
  }
  if (!announcementIds.length) {
    return;
  }
  const { error } = await supabase.from('command_unit_announcements').insert(
    announcementIds.map((announcementId) => ({ unit_id: unitId, announcement_id: announcementId }))
  );
  if (error) {
    throw error;
  }
}

export async function uploadUnitLogo(supabase, unitId, file) {
  const extension = String(file.name.split('.').pop() || 'jpg').toLowerCase();
  const objectPath = `${unitId}/logo.${extension}`;
  const { error: uploadError } = await supabase.storage.from('unit_logos').upload(objectPath, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg'
  });
  if (uploadError) {
    throw uploadError;
  }
  const { data } = supabase.storage.from('unit_logos').getPublicUrl(objectPath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  await saveUnitDetails(supabase, unitId, { logo_url: publicUrl });
  return publicUrl;
}

export async function setUnitMemberRank(supabase, userId, rankId) {
  const { error } = await supabase.rpc('set_unit_member_rank', { p_user_id: userId, p_rank_id: rankId });
  if (error) {
    throw error;
  }
}

export async function removeUnitMember(supabase, userId) {
  const { error } = await supabase.rpc('remove_unit_member', { p_user_id: userId });
  if (error) {
    throw error;
  }
}

export async function fetchOfficialDocs(supabase) {
  const { data, error } = await supabase.from('oc_official_docs').select('*').order('updated_at', { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveOfficialDoc(supabase, doc, actorId) {
  const payload = {
    folder: doc.folder || 'normal',
    doc_no: doc.doc_no || '',
    doc_date: doc.doc_date || '',
    subject: doc.subject || '',
    addressed_to: doc.addressed_to || '',
    body: doc.body || '',
    sign_name: doc.sign_name || '',
    sign_title: doc.sign_title || '',
    logo_url: doc.logo_url || null
  };
  if (doc.id) {
    const { data, error } = await supabase.from('oc_official_docs').update(payload).eq('id', doc.id).select().single();
    if (error) {
      throw error;
    }
    return data;
  }
  const { data, error } = await supabase
    .from('oc_official_docs')
    .insert({ ...payload, created_by: actorId })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteOfficialDoc(supabase, docId) {
  const { error } = await supabase.from('oc_official_docs').delete().eq('id', docId);
  if (error) {
    throw error;
  }
}

export async function fetchOperationBoard(supabase) {
  const [opsResult, sidesResult, aarResult] = await Promise.all([
    supabase.from('oc_operations').select('*').order('created_at', { ascending: false }),
    supabase.from('oc_operation_sides').select('*'),
    supabase.from('oc_operation_aar').select('*')
  ]);
  const firstError = opsResult.error || sidesResult.error || aarResult.error;
  if (firstError) {
    throw firstError;
  }
  return {
    operations: (opsResult.data || []).map((row) => ({ ...row, drawings: Array.isArray(row.drawings) ? row.drawings : [] })),
    sides: sidesResult.data || [],
    aars: aarResult.data || []
  };
}

async function uploadMapImage(supabase, imageFile, operationId) {
  const extension = imageFile.type === 'image/png' ? 'png' : String(imageFile.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = extension === 'png' ? 'png' : 'jpg';
  const objectPath = `${operationId}/map.${safeExt}`;
  const { error } = await supabase.storage.from('operation_maps').upload(objectPath, imageFile, {
    cacheControl: '3600',
    upsert: true,
    contentType: imageFile.type || 'image/jpeg'
  });
  if (error) {
    throw error;
  }
  const { data } = supabase.storage.from('operation_maps').getPublicUrl(objectPath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function saveOperation(supabase, payload) {
  const { id, title, briefing, status, drawings, sides, mapFile, mapUrl, createdBy, commandingOfficer } = payload;
  const operationId = id || window.crypto.randomUUID();
  let nextMapUrl = mapUrl || null;
  if (mapFile) {
    nextMapUrl = await uploadMapImage(supabase, mapFile, operationId);
  }
  const row = {
    id: operationId,
    title,
    briefing: briefing || '',
    status: ['planning', 'active', 'completed'].includes(status) ? status : 'planning',
    drawings: Array.isArray(drawings) ? drawings : [],
    map_url: nextMapUrl,
    commanding_officer: commandingOfficer || ''
  };
  if (id) {
    const { id: _id, ...patch } = row;
    const { error } = await supabase.from('oc_operations').update(patch).eq('id', operationId);
    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from('oc_operations').insert({ ...row, created_by: createdBy });
    if (error) {
      throw error;
    }
  }
  const { error: deleteError } = await supabase.from('oc_operation_sides').delete().eq('operation_id', operationId);
  if (deleteError) {
    throw deleteError;
  }
  const nextSides = (sides || []).filter((item) => item.unit_id && item.side);
  if (nextSides.length) {
    const { error: sideError } = await supabase.from('oc_operation_sides').insert(
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

export async function deleteOperation(supabase, operationId) {
  const { error } = await supabase.from('oc_operations').delete().eq('id', operationId);
  if (error) {
    throw error;
  }
}

export async function saveOperationAar(supabase, operationId, unitId, evaluation, authoredBy) {
  const { error } = await supabase.from('oc_operation_aar').upsert({
    operation_id: operationId,
    unit_id: unitId,
    evaluation: evaluation || '',
    authored_by: authoredBy
  });
  if (error) {
    throw error;
  }
}

export async function fetchAnnouncementBoard(supabase, currentUserId) {
  const [announcementResult, signupResult, peopleResult] = await Promise.all([
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    supabase.from('announcement_signups').select('announcement_id, user_id'),
    supabase
      .from('oc_personnel')
      .select('id, first_name, middle_name, last_name, avatar_url, military_rank, organization_role, is_dev, owner_user_id')
  ]);
  if (announcementResult.error) {
    throw announcementResult.error;
  }
  if (signupResult.error) {
    throw signupResult.error;
  }
  const announcements = announcementResult.data || [];
  const signups = signupResult.data || [];
  const peopleById = new Map((peopleResult.data || []).map((row) => [row.id, row]));
  return announcements.map((announcement) => decorateAnnouncement(announcement, signups, peopleById, currentUserId));
}

async function uploadCoverImage(supabase, imageFile, announcementId) {
  const extension = imageFile.type === 'image/png' ? 'png' : String(imageFile.name.split('.').pop() || 'jpg').toLowerCase();
  const objectPath = announcementId
    ? `${announcementId}/cover.${extension === 'png' ? 'png' : 'jpg'}`
    : `${window.crypto.randomUUID()}.${extension === 'png' ? 'png' : 'jpg'}`;
  const { error } = await supabase.storage.from('announcement_covers').upload(objectPath, imageFile, {
    cacheControl: '3600',
    upsert: Boolean(announcementId),
    contentType: imageFile.type || 'image/jpeg'
  });
  if (error) {
    throw error;
  }
  const { data } = supabase.storage.from('announcement_covers').getPublicUrl(objectPath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function createAnnouncement(supabase, payload) {
  const honorPayload = {
    award_honor_enabled: Boolean(payload.awardHonorEnabled),
    honor_rank_title: payload.awardHonorEnabled ? String(payload.honorRankTitle || '').trim() || null : null,
    show_participants: payload.showParticipants !== false,
    capacity_limited: payload.capacityLimited !== false
  };
  const imageUrl = payload.imageFile ? await uploadCoverImage(supabase, payload.imageFile) : null;
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: payload.title,
      content: payload.content,
      max_capacity: Math.max(1, Number(payload.maxCapacity) || 1),
      created_by: payload.createdBy,
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

export async function updateAnnouncement(supabase, announcementId, payload) {
  const next = {
    title: payload.title,
    content: payload.content,
    max_capacity: Math.max(1, Number(payload.maxCapacity) || 1),
    award_honor_enabled: Boolean(payload.awardHonorEnabled),
    honor_rank_title: payload.awardHonorEnabled ? String(payload.honorRankTitle || '').trim() || null : null,
    show_participants: payload.showParticipants !== false,
    capacity_limited: payload.capacityLimited !== false
  };
  if (payload.imageFile) {
    next.image_url = await uploadCoverImage(supabase, payload.imageFile, announcementId);
  }
  const { data, error } = await supabase.from('announcements').update(next).eq('id', announcementId).select().single();
  if (error) {
    throw error;
  }
  return data;
}

export async function closeAnnouncement(supabase, announcementId) {
  const { data, error } = await supabase.rpc('close_announcement', { p_announcement_id: announcementId });
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteAnnouncement(supabase, announcementId) {
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
  if (error) {
    throw error;
  }
}

export async function joinAnnouncement(supabase, announcementId, userId) {
  const { error } = await supabase.from('announcement_signups').insert({ announcement_id: announcementId, user_id: userId });
  if (error) {
    throw error;
  }
}

export async function leaveAnnouncement(supabase, announcementId, userId) {
  const { error } = await supabase
    .from('announcement_signups')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

export async function fetchTickets(supabase, admin, userId) {
  if (!admin && !userId) {
    return [];
  }
  let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
  if (!admin) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function createTicket(supabase, { userId, category, customTopic, body, contactEmail }) {
  const { error } = await supabase.from('support_tickets').insert({
    user_id: userId || null,
    category,
    custom_topic: customTopic,
    body,
    contact_email: contactEmail || null
  });
  if (error) {
    throw error;
  }
}

export async function updateTicket(supabase, ticketId, payload) {
  const { error } = await supabase.from('support_tickets').update(payload).eq('id', ticketId);
  if (error) {
    throw error;
  }
}

export async function deleteTicket(supabase, ticketId) {
  const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId);
  if (error) {
    throw error;
  }
}

export async function fetchLoreEntries(supabase) {
  const { data, error } = await supabase.from('lore_entries').select('*').order('sort_order', { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveLoreEntry(supabase, entry) {
  const payload = {
    category: entry.category,
    title: entry.title,
    meta1: entry.meta1,
    meta2: entry.meta2,
    body: entry.body,
    sort_order: entry.sort_order
  };
  const query = entry.id
    ? supabase.from('lore_entries').update(payload).eq('id', entry.id)
    : supabase.from('lore_entries').insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteLoreEntry(supabase, entryId) {
  const { error } = await supabase.from('lore_entries').delete().eq('id', entryId);
  if (error) {
    throw error;
  }
}

export async function fetchDocuments(supabase) {
  const { data, error } = await supabase.from('command_documents').select('*').order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveDocument(supabase, doc) {
  const payload = { title: doc.title, markdown: doc.markdown };
  const query = doc.id
    ? supabase.from('command_documents').update(payload).eq('id', doc.id)
    : supabase.from('command_documents').insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteDocument(supabase, documentId) {
  const { error } = await supabase.from('command_documents').delete().eq('id', documentId);
  if (error) {
    throw error;
  }
}

export async function fetchSettingsMap(supabase) {
  const { data, error } = await supabase.from('user_settings').select('*');
  if (error) {
    throw error;
  }
  return Object.fromEntries((data || []).map((row) => [row.user_id, row]));
}

export async function fetchOwnSettings(supabase, userId) {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data || emptySettingsRow(userId);
}

export async function saveOwnSettings(supabase, userId, payload) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function writeActivityLog(supabase, { userId, roleSnapshot, actionType, details }) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    role_snapshot: roleSnapshot || null,
    action_type: actionType,
    details: details || ''
  });
  if (error) {
    throw error;
  }
}

export async function fetchActivityLogs(supabase, admin, userId) {
  let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
  if (!admin) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export function isUserLog(actionType) {
  return ['profile_update', 'theme_update', 'privacy_update', 'avatar_update'].includes(actionType);
}

export function isAdminLog(actionType) {
  return ['rank_update', 'admin_grant', 'admin_revoke', 'personnel_edit', 'personnel_delete', 'announcement_close'].includes(
    actionType
  );
}

export async function measureCommandStatus(supabase) {
  const pingStarted = performance.now();
  const { error: pingError } = await supabase.from('oc_rank_structure').select('rank_title').limit(1);
  const latencyMs = Math.round(performance.now() - pingStarted);
  if (pingError) {
    throw pingError;
  }
  const { data, error } = await supabase.rpc('command_system_status');
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
