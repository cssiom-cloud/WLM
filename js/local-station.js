const STORAGE_ACCOUNTS = 'wlr-local-accounts';
const STORAGE_PERSONNEL = 'wlr-local-personnel';
const STORAGE_SESSION = 'wlr-local-session';
const STORAGE_SETTINGS = 'wlr-local-settings';
const STORAGE_LOGS = 'wlr-local-logs';
const STORAGE_ANNOUNCEMENTS = 'wlr-local-announcements';
const STORAGE_SIGNUPS = 'wlr-local-signups';
const STORAGE_LORE = 'wlr-local-lore';
const STORAGE_DOCS = 'wlr-local-documents';

export const LOCAL_TEST_ACCOUNTS = [
  { email: 'admin@local.test', password: 'admin' },
  { email: 'officer@local.test', password: 'officer' }
];

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedPersonnel() {
  return [
    {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@local.test',
      role: 'admin',
      first_name: 'Local',
      middle_name: '',
      last_name: 'Administrator',
      age: 29,
      nationality: 'Aquilish',
      gender: 'Male',
      avatar_url: '',
      religion: '',
      race: 'Human',
      wlc_agency: 'Test Agency Alpha',
      training_course: 'Test course',
      military_branch: 'Navy',
      organization_role: 'Test organization role',
      military_rank: 'Captain',
      biography: 'Command administrator assigned to Test Agency Alpha. Responsible for personnel records and rank control.',
      completed_missions: ['Operation Silent Tide', 'Fleet Escort Exercise', 'Harbor Defense Drill'],
      medals: ['Meritorious Service Medal', 'Fleet Command Ribbon'],
      honor_ranks: []
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'officer@local.test',
      role: 'user',
      first_name: 'Local',
      middle_name: '',
      last_name: 'Officer',
      age: 21,
      nationality: 'Renjima',
      gender: 'Female',
      avatar_url: '',
      religion: '',
      race: 'Elf',
      wlc_agency: 'Test Agency Bravo',
      training_course: 'Test course',
      military_branch: 'Marines',
      organization_role: 'Test organization role',
      military_rank: 'Lieutenant',
      biography: 'Commissioned officer of the Marines. Training course completed under Test Agency Bravo.',
      completed_missions: ['Amphibious Landing Exercise'],
      medals: ['Basic Training Honor'],
      honor_ranks: []
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      email: 'roster-a@local.test',
      role: 'user',
      first_name: 'Local',
      middle_name: '',
      last_name: 'Admiral',
      age: 41,
      nationality: 'Schwartland',
      gender: 'Male',
      avatar_url: '',
      religion: '',
      race: 'Neko',
      wlc_agency: 'Test Agency Alpha',
      training_course: 'Test course',
      military_branch: 'Navy',
      organization_role: 'Test organization role',
      military_rank: 'Admiral',
      biography: 'Senior Navy command. Assigned to Test Agency Alpha.',
      completed_missions: ['Operation Silent Tide', 'Northern Blockade', 'Joint Fleet Review'],
      medals: ['Distinguished Command Cross', 'Long Service Medal'],
      honor_ranks: []
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      email: 'roster-b@local.test',
      role: 'user',
      first_name: 'Local',
      middle_name: '',
      last_name: 'Sergeant',
      age: 24,
      nationality: 'Aquilish',
      gender: 'Female',
      avatar_url: '',
      religion: '',
      race: 'Demon',
      wlc_agency: 'Test Agency Bravo',
      training_course: 'Test course',
      military_branch: 'Marines',
      organization_role: 'Test organization role',
      military_rank: 'Sergeant',
      biography: 'Marine sergeant attached to Test Agency Bravo.',
      completed_missions: ['Coastal Patrol Rotation'],
      medals: ['Marksmanship Badge'],
      honor_ranks: []
    },
    {
      id: '00000000-0000-4000-8000-000000000005',
      email: 'roster-c@local.test',
      role: 'user',
      first_name: 'Local',
      middle_name: '',
      last_name: 'Student',
      age: 17,
      nationality: 'Renjima',
      gender: 'Male',
      avatar_url: '',
      religion: '',
      race: 'Human',
      wlc_agency: 'Test Agency Alpha',
      training_course: 'Test course',
      military_branch: 'Navy',
      organization_role: 'Test organization role',
      military_rank: 'Naval academy student',
      biography: 'Naval academy student. Age 17. Assigned to Test Agency Alpha.',
      completed_missions: [],
      medals: [],
      honor_ranks: []
    }
  ];
}

function seedAccounts() {
  return [
    { id: '00000000-0000-4000-8000-000000000001', email: 'admin@local.test', password: 'admin' },
    { id: '00000000-0000-4000-8000-000000000002', email: 'officer@local.test', password: 'officer' }
  ];
}

export function ensureLocalStation() {
  if (!window.localStorage.getItem(STORAGE_ACCOUNTS)) {
    writeJson(STORAGE_ACCOUNTS, seedAccounts());
  }
  if (!window.localStorage.getItem(STORAGE_PERSONNEL)) {
    writeJson(STORAGE_PERSONNEL, seedPersonnel());
  }
  if (!window.localStorage.getItem(STORAGE_SETTINGS)) {
    const rows = readJson(STORAGE_PERSONNEL, []);
    writeJson(
      STORAGE_SETTINGS,
      rows.map((row) => ({
        user_id: row.id,
        theme_accent: null,
        bio_public: true,
        updated_at: new Date().toISOString()
      }))
    );
  }
  if (!window.localStorage.getItem(STORAGE_LOGS)) {
    writeJson(STORAGE_LOGS, []);
  }
  if (!window.localStorage.getItem(STORAGE_ANNOUNCEMENTS)) {
    writeJson(STORAGE_ANNOUNCEMENTS, [
      {
        id: '10000000-0000-4000-8000-000000000001',
        title: 'Joint Fleet Training Exercise',
        content: 'Combined Navy and Marines training operation. Report to the assigned staging area on time. Registration is limited.',
        max_capacity: 12,
        created_by: '00000000-0000-4000-8000-000000000001',
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        title: 'Naval Academy Open Evaluation',
        content: 'Evaluation session for academy students and trainers. Seats are limited to keep evaluation quality high.',
        max_capacity: 5,
        created_by: '00000000-0000-4000-8000-000000000001',
        created_at: new Date(Date.now() - 43200000).toISOString()
      }
    ]);
  }
  if (!window.localStorage.getItem(STORAGE_LORE)) {
    writeJson(STORAGE_LORE, [
      { id: '20000000-0000-4000-8000-000000000001', category: 'timeline', title: 'Formation of the White Lion Regiment', meta1: 'Founding Era', meta2: null, body: 'The regiment is established as a joint Navy and Marines command under a unified fleet charter.', sort_order: 1 },
      { id: '20000000-0000-4000-8000-000000000002', category: 'timeline', title: 'Naval Academy Commissioned', meta1: 'Expansion Era', meta2: null, body: 'The academy opens to train students and trainers, formalizing the NS and TR programs.', sort_order: 2 },
      { id: '20000000-0000-4000-8000-000000000003', category: 'timeline', title: 'Union Republic of Eridian Accords', meta1: 'Modern Era', meta2: null, body: 'Joint operating agreements define fleet patrol zones and combined training exercises.', sort_order: 3 },
      { id: '20000000-0000-4000-8000-000000000011', category: 'geopolitics', title: 'Aquilish', meta1: 'Recognized nationality', meta2: null, body: 'Personnel of Aquilish origin serve across both branches.', sort_order: 1 },
      { id: '20000000-0000-4000-8000-000000000012', category: 'geopolitics', title: 'Renjima', meta1: 'Recognized nationality', meta2: null, body: 'Personnel of Renjima origin serve across both branches.', sort_order: 2 },
      { id: '20000000-0000-4000-8000-000000000013', category: 'geopolitics', title: 'Schwartland', meta1: 'Recognized nationality', meta2: null, body: 'Personnel of Schwartland origin serve across both branches.', sort_order: 3 },
      { id: '20000000-0000-4000-8000-000000000014', category: 'geopolitics', title: 'Union Republic of Eridian', meta1: 'Allied state', meta2: null, body: 'Treaty partner for joint fleet operations and naval specifications.', sort_order: 4 },
      { id: '20000000-0000-4000-8000-000000000021', category: 'naval', title: 'Eridian-class', meta1: 'Fleet flagship', meta2: '420', body: 'Fleet command and coordination', sort_order: 1 },
      { id: '20000000-0000-4000-8000-000000000022', category: 'naval', title: 'Lionheart-class', meta1: 'Cruiser', meta2: '260', body: 'Escort and patrol operations', sort_order: 2 },
      { id: '20000000-0000-4000-8000-000000000023', category: 'naval', title: 'Whitecrest-class', meta1: 'Landing ship', meta2: '180', body: 'Marine amphibious deployment', sort_order: 3 },
      { id: '20000000-0000-4000-8000-000000000024', category: 'naval', title: 'Academy Sloop', meta1: 'Training vessel', meta2: '60', body: 'Naval academy instruction', sort_order: 4 }
    ]);
  }
  if (!window.localStorage.getItem(STORAGE_DOCS)) {
    writeJson(STORAGE_DOCS, [
      {
        id: '30000000-0000-4000-8000-000000000001',
        title: 'General Regulations',
        markdown: '# General Regulations\n\n## Conduct\n- Personnel address superiors by rank at all times.\n- Uniform standards apply during all official operations.',
        updated_at: new Date().toISOString()
      },
      {
        id: '30000000-0000-4000-8000-000000000002',
        title: 'Operations Manual',
        markdown: '# Operations Manual\n\n## Registration\n- Operations are published in the Announcements Hub.\n- Each operation lists its maximum capacity.',
        updated_at: new Date().toISOString()
      },
      {
        id: '30000000-0000-4000-8000-000000000003',
        title: 'Recruit Guide',
        markdown: '# Recruit Guide\n\n## Getting Started\n- New members enter at the rank of Lieutenant.\n- Complete your profile on the Home page.',
        updated_at: new Date().toISOString()
      }
    ]);
  }
  if (!window.localStorage.getItem(STORAGE_SIGNUPS)) {
    writeJson(STORAGE_SIGNUPS, [
      {
        announcement_id: '10000000-0000-4000-8000-000000000001',
        user_id: '00000000-0000-4000-8000-000000000003',
        created_at: new Date().toISOString()
      },
      {
        announcement_id: '10000000-0000-4000-8000-000000000001',
        user_id: '00000000-0000-4000-8000-000000000004',
        created_at: new Date().toISOString()
      },
      {
        announcement_id: '10000000-0000-4000-8000-000000000002',
        user_id: '00000000-0000-4000-8000-000000000005',
        created_at: new Date().toISOString()
      }
    ]);
  }
}

export function resetLocalStation() {
  window.localStorage.removeItem(STORAGE_ACCOUNTS);
  window.localStorage.removeItem(STORAGE_PERSONNEL);
  window.localStorage.removeItem(STORAGE_SESSION);
  window.localStorage.removeItem(STORAGE_SETTINGS);
  window.localStorage.removeItem(STORAGE_LOGS);
  window.localStorage.removeItem(STORAGE_ANNOUNCEMENTS);
  window.localStorage.removeItem(STORAGE_SIGNUPS);
  window.localStorage.removeItem(STORAGE_LORE);
  window.localStorage.removeItem(STORAGE_DOCS);
  ensureLocalStation();
}

function accounts() {
  ensureLocalStation();
  return readJson(STORAGE_ACCOUNTS, []);
}

function personnelRows() {
  ensureLocalStation();
  return readJson(STORAGE_PERSONNEL, []);
}

function savePersonnel(rows) {
  writeJson(STORAGE_PERSONNEL, rows);
}

export async function localReadSession() {
  const session = readJson(STORAGE_SESSION, null);
  if (!session?.user?.id) {
    return null;
  }
  return session;
}

export async function localReadCurrentPersonnel() {
  const session = await localReadSession();
  if (!session) {
    return { session: null, personnel: null };
  }
  const personnel = personnelRows().find((row) => row.id === session.user.id) || null;
  return { session, personnel: personnel ? clone(personnel) : null };
}

export async function localSignIn(email, password) {
  const account = accounts().find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!account || account.password !== password) {
    throw new Error('Invalid email or password.');
  }
  const session = { user: { id: account.id, email: account.email } };
  writeJson(STORAGE_SESSION, session);
  return { session, user: session.user };
}

export async function localSignUp(email, password) {
  const current = accounts();
  if (current.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('This email is already registered.');
  }

  const id = window.crypto.randomUUID();
  current.push({ id, email, password });
  writeJson(STORAGE_ACCOUNTS, current);

  const rows = personnelRows();
  rows.push({
    id,
    email,
    role: 'user',
    first_name: '',
    middle_name: '',
    last_name: '',
    age: null,
    nationality: null,
    gender: null,
    avatar_url: '',
    religion: '',
    race: null,
    wlc_agency: '',
    training_course: '',
    military_branch: null,
    organization_role: '',
    military_rank: 'Lieutenant',
    biography: '',
    completed_missions: [],
    medals: [],
    honor_ranks: []
  });
  savePersonnel(rows);

  const settings = readJson(STORAGE_SETTINGS, []);
  settings.push({
    user_id: id,
    theme_accent: null,
    bio_public: true,
    updated_at: new Date().toISOString()
  });
  writeJson(STORAGE_SETTINGS, settings);

  const session = { user: { id, email } };
  writeJson(STORAGE_SESSION, session);
  return { session, user: session.user };
}

export async function localSignOut() {
  window.localStorage.removeItem(STORAGE_SESSION);
}

export async function localFetchRoster() {
  return clone(personnelRows());
}

export async function localUpdatePersonnel(personnelId, payload) {
  const rows = personnelRows();
  const index = rows.findIndex((row) => row.id === personnelId);
  if (index === -1) {
    throw new Error('Personnel record was not found.');
  }

  const session = await localReadSession();
  const actor = rows.find((row) => row.id === session?.user?.id);
  const isAdmin = actor?.role === 'admin';
  const isSelf = session?.user?.id === personnelId;

  if (!isAdmin && !isSelf) {
    throw new Error('Update is not permitted.');
  }

  if (!isAdmin) {
    delete payload.military_rank;
    delete payload.role;
    delete payload.email;
    delete payload.id;
    delete payload.honor_ranks;
    delete payload.medals;
    delete payload.completed_missions;
  } else {
    delete payload.email;
    delete payload.id;
  }

  rows[index] = { ...rows[index], ...payload };
  savePersonnel(rows);
  return clone(rows[index]);
}

export async function localUploadAvatar(userId, file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Avatar file could not be read.'));
    reader.readAsDataURL(file);
  });
  return localUpdatePersonnel(userId, { avatar_url: dataUrl });
}

function settingsRows() {
  ensureLocalStation();
  return readJson(STORAGE_SETTINGS, []);
}

function logRows() {
  ensureLocalStation();
  return readJson(STORAGE_LOGS, []);
}

export async function localFetchSettings() {
  return clone(settingsRows());
}

export async function localFetchOwnSettings(userId) {
  const row = settingsRows().find((item) => item.user_id === userId);
  return row ? clone(row) : { user_id: userId, theme_accent: null, bio_public: true };
}

export async function localUpsertSettings(userId, payload) {
  const rows = settingsRows();
  const index = rows.findIndex((item) => item.user_id === userId);
  const next = {
    user_id: userId,
    theme_accent: null,
    bio_public: true,
    ...(index >= 0 ? rows[index] : {}),
    ...payload,
    updated_at: new Date().toISOString()
  };
  if (index >= 0) {
    rows[index] = next;
  } else {
    rows.push(next);
  }
  writeJson(STORAGE_SETTINGS, rows);
  return clone(next);
}

export async function localWriteLog({ userId, roleSnapshot, actionType, details }) {
  const rows = logRows();
  const entry = {
    log_id: window.crypto.randomUUID(),
    user_id: userId,
    role_snapshot: roleSnapshot || null,
    action_type: actionType,
    details: details || '',
    created_at: new Date().toISOString()
  };
  rows.unshift(entry);
  writeJson(STORAGE_LOGS, rows.slice(0, 500));
  return entry;
}

export async function localFetchLogs(isAdmin, userId) {
  const rows = logRows().slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (isAdmin) {
    return clone(rows);
  }
  return clone(rows.filter((row) => row.user_id === userId));
}

function announcementRows() {
  ensureLocalStation();
  return readJson(STORAGE_ANNOUNCEMENTS, []);
}

function signupRows() {
  ensureLocalStation();
  return readJson(STORAGE_SIGNUPS, []);
}

export async function localFetchAnnouncements() {
  const announcements = announcementRows()
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { announcements: clone(announcements), signups: clone(signupRows()) };
}

export async function localCreateAnnouncement({
  title,
  content,
  maxCapacity,
  createdBy,
  imageUrl = null,
  award_honor_enabled = false,
  honor_rank_title = null
}) {
  const rows = announcementRows();
  const entry = {
    id: window.crypto.randomUUID(),
    title,
    content,
    max_capacity: maxCapacity,
    created_by: createdBy,
    image_url: imageUrl,
    award_honor_enabled: Boolean(award_honor_enabled),
    honor_rank_title: honor_rank_title || null,
    ended_at: null,
    created_at: new Date().toISOString()
  };
  rows.unshift(entry);
  writeJson(STORAGE_ANNOUNCEMENTS, rows);
  return clone(entry);
}

export async function localDeleteAnnouncement(announcementId) {
  writeJson(
    STORAGE_ANNOUNCEMENTS,
    announcementRows().filter((row) => row.id !== announcementId)
  );
  writeJson(
    STORAGE_SIGNUPS,
    signupRows().filter((row) => row.announcement_id !== announcementId)
  );
}

export async function localJoinAnnouncement(announcementId, userId) {
  const signups = signupRows();
  if (signups.some((row) => row.announcement_id === announcementId && row.user_id === userId)) {
    throw new Error('Already signed up for this announcement.');
  }
  const announcement = announcementRows().find((row) => row.id === announcementId);
  if (!announcement) {
    throw new Error('Announcement was not found.');
  }
  if (announcement.ended_at) {
    throw new Error('Announcement is closed.');
  }
  const currentCount = signups.filter((row) => row.announcement_id === announcementId).length;
  if (currentCount >= announcement.max_capacity) {
    throw new Error('Announcement is at full capacity.');
  }
  signups.push({ announcement_id: announcementId, user_id: userId, created_at: new Date().toISOString() });
  writeJson(STORAGE_SIGNUPS, signups);
}

export async function localLeaveAnnouncement(announcementId, userId) {
  const announcement = announcementRows().find((row) => row.id === announcementId);
  if (announcement?.ended_at) {
    throw new Error('Announcement is closed.');
  }
  const signups = signupRows().filter(
    (row) => !(row.announcement_id === announcementId && row.user_id === userId)
  );
  writeJson(STORAGE_SIGNUPS, signups);
}

export async function localCloseAnnouncement(announcementId) {
  const session = await localReadSession();
  const rows = personnelRows();
  const actor = rows.find((row) => row.id === session?.user?.id);
  if (actor?.role !== 'admin') {
    throw new Error('Only command administrators can close announcements.');
  }

  const announcements = announcementRows();
  const rec = announcements.find((row) => row.id === announcementId);
  if (!rec) {
    throw new Error('Announcement was not found.');
  }
  if (rec.ended_at) {
    throw new Error('Announcement is already closed.');
  }

  rec.ended_at = new Date().toISOString();
  writeJson(STORAGE_ANNOUNCEMENTS, announcements);

  let awarded = 0;
  const honorTitle = String(rec.honor_rank_title || '').trim();
  if (rec.award_honor_enabled && honorTitle) {
    const remaining = signupRows().filter((row) => row.announcement_id === announcementId);
    remaining.forEach((signup) => {
      const person = rows.find((row) => row.id === signup.user_id);
      if (!person) {
        return;
      }
      person.honor_ranks = Array.isArray(person.honor_ranks) ? person.honor_ranks : [];
      if (!person.honor_ranks.includes(honorTitle)) {
        person.honor_ranks.push(honorTitle);
      }
      person.completed_missions = Array.isArray(person.completed_missions) ? person.completed_missions : [];
      if (!person.completed_missions.includes(rec.title)) {
        person.completed_missions.push(rec.title);
      }
      awarded += 1;
    });
    savePersonnel(rows);
  }

  await localWriteLog({
    userId: actor.id,
    roleSnapshot: 'admin',
    actionType: 'announcement_close',
    details: rec.award_honor_enabled && honorTitle
      ? `Closed announcement ${rec.title} and awarded honor rank ${honorTitle} to ${awarded} personnel`
      : `Closed announcement ${rec.title}`
  });

  return { awarded, honor_rank_title: honorTitle || null };
}

function loreRows() {
  ensureLocalStation();
  return readJson(STORAGE_LORE, []);
}

function documentRows() {
  ensureLocalStation();
  return readJson(STORAGE_DOCS, []);
}

export async function localFetchLore() {
  return clone(loreRows());
}

export async function localSaveLoreEntry(entry) {
  const rows = loreRows();
  if (entry.id) {
    const index = rows.findIndex((row) => row.id === entry.id);
    if (index === -1) {
      throw new Error('Lore entry was not found.');
    }
    rows[index] = { ...rows[index], ...entry };
    writeJson(STORAGE_LORE, rows);
    return clone(rows[index]);
  }
  const created = { ...entry, id: window.crypto.randomUUID() };
  rows.push(created);
  writeJson(STORAGE_LORE, rows);
  return clone(created);
}

export async function localDeleteLoreEntry(entryId) {
  writeJson(STORAGE_LORE, loreRows().filter((row) => row.id !== entryId));
}

export async function localFetchDocuments() {
  return clone(documentRows());
}

export async function localSaveDocument(doc) {
  const rows = documentRows();
  if (doc.id) {
    const index = rows.findIndex((row) => row.id === doc.id);
    if (index === -1) {
      throw new Error('Document was not found.');
    }
    rows[index] = { ...rows[index], ...doc, updated_at: new Date().toISOString() };
    writeJson(STORAGE_DOCS, rows);
    return clone(rows[index]);
  }
  const created = { ...doc, id: window.crypto.randomUUID(), updated_at: new Date().toISOString() };
  rows.push(created);
  writeJson(STORAGE_DOCS, rows);
  return clone(created);
}

export async function localDeleteDocument(documentId) {
  writeJson(STORAGE_DOCS, documentRows().filter((row) => row.id !== documentId));
}

export function localSystemStatus() {
  const used = new Blob([window.localStorage.getItem(STORAGE_PERSONNEL) || '']).size;
  const limit = 1073741824;
  return {
    storage_used_bytes: used,
    storage_limit_bytes: limit,
    storage_remaining_bytes: Math.max(limit - used, 0)
  };
}

