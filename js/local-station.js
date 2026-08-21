import { COMMAND_UNITS } from './domain.js';
import { canAccessMemoFolder, canEditMemo, visiblePersonnel } from './access.js';

const STORAGE_ACCOUNTS = 'wlr-local-accounts';
const STORAGE_PERSONNEL = 'wlr-local-personnel';
const STORAGE_SESSION = 'wlr-local-session';
const STORAGE_SETTINGS = 'wlr-local-settings';
const STORAGE_LOGS = 'wlr-local-logs';
const STORAGE_ANNOUNCEMENTS = 'wlr-local-announcements';
const STORAGE_SIGNUPS = 'wlr-local-signups';
const STORAGE_LORE = 'wlr-local-lore';
const STORAGE_DOCS = 'wlr-local-documents';
const STORAGE_UNITS = 'wlr-local-units';
const STORAGE_UNIT_RANKS = 'wlr-local-unit-ranks';
const STORAGE_UNIT_LINKS = 'wlr-local-unit-links';
const STORAGE_UNIT_APPS = 'wlr-local-unit-apps';
const STORAGE_TICKETS = 'wlr-local-tickets';
const STORAGE_OPERATIONS = 'wlr-local-operations';
const STORAGE_OP_SIDES = 'wlr-local-operation-sides';
const STORAGE_OP_AAR = 'wlr-local-operation-aar';
const STORAGE_MEMOS = 'wlr-local-official-docs';

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
      is_dev: true,
      biography: 'Command administrator assigned to Test Agency Alpha. Responsible for personnel records and rank control.',
      completed_missions: ['Operation Silent Tide', 'Fleet Escort Exercise', 'Harbor Defense Drill'],
      medals: ['Meritorious Service Medal', 'Fleet Command Ribbon'],
      honor_ranks: [],
      owner_user_id: '00000000-0000-4000-8000-000000000001'
    },
    {
      id: '00000000-0000-4000-8000-0000000000a2',
      owner_user_id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@local.test',
      role: 'user',
      first_name: 'Maiddress',
      middle_name: '',
      last_name: '',
      age: 24,
      nationality: 'Aquilish',
      gender: 'Female',
      avatar_url: '',
      religion: '',
      race: 'Human',
      wlc_agency: '',
      training_course: '',
      military_branch: 'Navy',
      organization_role: 'Systems Developer',
      military_rank: 'Lieutenant',
      is_dev: true,
      biography: 'Alternate personnel file used for local profile-switch testing.',
      completed_missions: [],
      medals: [],
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
      honor_ranks: [],
      owner_user_id: '00000000-0000-4000-8000-000000000002'
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
  if (!window.localStorage.getItem(STORAGE_UNITS)) {
    writeJson(
      STORAGE_UNITS,
      COMMAND_UNITS.map((unit, index) => ({
        id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        code: unit.code,
        name: unit.name,
        sort_order: unit.sort_order,
        content: '',
        max_capacity: 40,
        head_user_id: null,
        logo_url: null,
        logo_link: null,
        created_at: new Date().toISOString()
      }))
    );
  }
  if (!window.localStorage.getItem(STORAGE_UNIT_RANKS)) {
    writeJson(STORAGE_UNIT_RANKS, []);
  }
  if (!window.localStorage.getItem(STORAGE_UNIT_LINKS)) {
    writeJson(STORAGE_UNIT_LINKS, []);
  }
  if (!window.localStorage.getItem(STORAGE_UNIT_APPS)) {
    writeJson(STORAGE_UNIT_APPS, []);
  }
  if (!window.localStorage.getItem(STORAGE_TICKETS)) {
    writeJson(STORAGE_TICKETS, []);
  }
  if (!window.localStorage.getItem(STORAGE_OPERATIONS)) {
    writeJson(STORAGE_OPERATIONS, []);
  }
  if (!window.localStorage.getItem(STORAGE_OP_SIDES)) {
    writeJson(STORAGE_OP_SIDES, []);
  }
  if (!window.localStorage.getItem(STORAGE_OP_AAR)) {
    writeJson(STORAGE_OP_AAR, []);
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
  if (!window.localStorage.getItem(STORAGE_MEMOS)) {
    writeJson(STORAGE_MEMOS, []);
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
  window.localStorage.removeItem(STORAGE_UNITS);
  window.localStorage.removeItem(STORAGE_UNIT_RANKS);
  window.localStorage.removeItem(STORAGE_UNIT_LINKS);
  window.localStorage.removeItem(STORAGE_UNIT_APPS);
  window.localStorage.removeItem(STORAGE_TICKETS);
  window.localStorage.removeItem(STORAGE_OPERATIONS);
  window.localStorage.removeItem(STORAGE_OP_SIDES);
  window.localStorage.removeItem(STORAGE_OP_AAR);
  window.localStorage.removeItem(STORAGE_MEMOS);
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
  const owned = localOwnedPersonnel(session.user.id);
  const stored = window.localStorage.getItem('wlr-active-personnel-id');
  const personnel = owned.find((row) => row.id === stored) || owned[0] || null;
  return { session, personnel: personnel ? clone(personnel) : null, profiles: owned };
}

export function localOwnedPersonnel(authUserId) {
  return personnelRows()
    .filter((row) => (row.owner_user_id || row.id) === authUserId)
    .map((row) => clone(row));
}

export function localSetActivePersonnel(personnelId) {
  window.localStorage.setItem('wlr-active-personnel-id', personnelId);
}

export function localCreatePersonnelProfile(authUserId, email, firstName, lastName) {
  const id = window.crypto.randomUUID();
  const rows = personnelRows();
  rows.push({
    id,
    owner_user_id: authUserId,
    email: email || '',
    role: 'user',
    first_name: firstName || '',
    middle_name: '',
    last_name: lastName || '',
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
    honor_ranks: [],
    is_dev: false
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
  localSetActivePersonnel(id);
  return rows.find((row) => row.id === id);
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
    owner_user_id: id,
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
    honor_ranks: [],
    is_dev: false
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
  window.localStorage.removeItem('wlr-active-personnel-id');
}

export async function localFetchRoster() {
  const actor = await localActor();
  return visiblePersonnel(clone(personnelRows()), actor);
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

  if (!actor?.is_dev) {
    delete payload.is_dev;
  }

  if (!isAdmin) {
    delete payload.military_rank;
    delete payload.role;
    delete payload.email;
    delete payload.id;
    delete payload.honor_ranks;
    delete payload.medals;
    delete payload.completed_missions;
    delete payload.nationality;
    delete payload.race;
    delete payload.religion;
    delete payload.wlc_agency;
    delete payload.training_course;
    delete payload.military_branch;
    delete payload.organization_role;
    delete payload.unit_id;
    delete payload.unit_rank_id;
    delete payload.service_skills;
    delete payload.service_timeline;
  } else {
    delete payload.email;
    delete payload.id;
  }

  rows[index] = { ...rows[index], ...payload };
  savePersonnel(rows);
  return clone(rows[index]);
}

export async function localFetchLoginAccounts() {
  const actor = await localActor();
  if (actor?.role !== 'admin') {
    throw new Error('Only command administrators can view login accounts.');
  }
  const login = accounts();
  return personnelRows().map((person) => {
    const account = login.find((item) => item.id === person.id);
    return {
      ...clone(person),
      email: account?.email || person.email,
      login_password: account ? account.password : null,
      has_login: Boolean(account)
    };
  });
}

export async function localUpdateLoginCredentials(userId, { email, password }) {
  const actor = await localActor();
  if (actor?.role !== 'admin') {
    throw new Error('Only command administrators can update login credentials.');
  }

  const nextEmail = String(email || '').trim();
  const nextPassword = String(password ?? '');
  if (!nextEmail || !nextEmail.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  if (nextPassword && nextPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const login = accounts();
  const people = personnelRows();
  const personIndex = people.findIndex((row) => row.id === userId);
  if (personIndex === -1) {
    throw new Error('Personnel was not found.');
  }

  const emailTaken =
    login.some((row) => row.id !== userId && row.email.toLowerCase() === nextEmail.toLowerCase()) ||
    people.some((row) => row.id !== userId && String(row.email || '').toLowerCase() === nextEmail.toLowerCase());
  if (emailTaken) {
    throw new Error('This email is already registered.');
  }

  const accountIndex = login.findIndex((row) => row.id === userId);
  if (accountIndex === -1) {
    if (!nextPassword) {
      throw new Error('Enter a password to create a login for this personnel.');
    }
    login.push({ id: userId, email: nextEmail, password: nextPassword });
  } else {
    login[accountIndex] = {
      ...login[accountIndex],
      email: nextEmail,
      password: nextPassword ? nextPassword : login[accountIndex].password
    };
  }
  writeJson(STORAGE_ACCOUNTS, login);

  people[personIndex] = { ...people[personIndex], email: nextEmail };
  savePersonnel(people);

  const session = await localReadSession();
  if (session?.user?.id === userId) {
    writeJson(STORAGE_SESSION, { user: { id: userId, email: nextEmail } });
  }

  await localWriteLog({
    userId: actor.id,
    roleSnapshot: 'admin',
    actionType: 'login_credentials_update',
    details: `Updated login credentials for ${userId}`
  });
}

export async function localUploadPersonnelImage(userId, file, field = 'avatar_url') {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Image file could not be read.'));
    reader.readAsDataURL(file);
  });
  const safeField = field === 'cover_url' ? 'cover_url' : 'avatar_url';
  return localUpdatePersonnel(userId, { [safeField]: dataUrl });
}

export async function localUploadAvatar(userId, file) {
  return localUploadPersonnelImage(userId, file, 'avatar_url');
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

export async function localUpdateAnnouncement(announcementId, payload) {
  const rows = announcementRows();
  const index = rows.findIndex((row) => row.id === announcementId);
  if (index === -1) {
    throw new Error('Announcement was not found.');
  }
  rows[index] = { ...rows[index], ...payload };
  writeJson(STORAGE_ANNOUNCEMENTS, rows);
  return clone(rows[index]);
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

async function localActor() {
  const session = await localReadSession();
  const rows = personnelRows();
  return rows.find((row) => row.id === session?.user?.id) || null;
}

function unitRows() {
  ensureLocalStation();
  return readJson(STORAGE_UNITS, []);
}

function unitRankRows() {
  ensureLocalStation();
  return readJson(STORAGE_UNIT_RANKS, []);
}

function unitLinkRows() {
  ensureLocalStation();
  return readJson(STORAGE_UNIT_LINKS, []);
}

function unitAppRows() {
  ensureLocalStation();
  return readJson(STORAGE_UNIT_APPS, []);
}

function ticketRows() {
  ensureLocalStation();
  return readJson(STORAGE_TICKETS, []);
}

function canManageUnit(actor, unitId) {
  if (!actor) {
    return false;
  }
  if (actor.role === 'admin') {
    return true;
  }
  const unit = unitRows().find((row) => row.id === unitId);
  return unit?.head_user_id === actor.id;
}

export async function localFetchUnitBoard() {
  const actor = await localActor();
  const announcements = announcementRows().map((row) => ({ id: row.id, title: row.title }));
  const personnel = visiblePersonnel(
    personnelRows().map((row) => ({
      id: row.id,
      first_name: row.first_name,
      middle_name: row.middle_name,
      last_name: row.last_name,
      role: row.role,
      military_rank: row.military_rank || '',
      unit_id: row.unit_id || null,
      unit_rank_id: row.unit_rank_id || null,
      honor_ranks: row.honor_ranks || [],
      is_dev: Boolean(row.is_dev)
    })),
    actor
  );
  return {
    units: clone(unitRows()).sort((a, b) => a.sort_order - b.sort_order),
    ranks: clone(unitRankRows()),
    links: clone(unitLinkRows()),
    applications: clone(unitAppRows()),
    personnel,
    announcements
  };
}

export async function localApplyToUnit(unitId) {
  const actor = await localActor();
  if (!actor) {
    throw new Error('Sign in is required.');
  }
  if (actor.unit_id) {
    throw new Error('You already belong to a unit.');
  }
  const apps = unitAppRows();
  if (apps.some((row) => row.user_id === actor.id && row.status === 'pending')) {
    throw new Error('You already have a pending unit application.');
  }
  const unit = unitRows().find((row) => row.id === unitId);
  if (!unit) {
    throw new Error('Unit was not found.');
  }
  const memberCount = personnelRows().filter((row) => row.unit_id === unitId).length;
  if (memberCount >= unit.max_capacity) {
    throw new Error('Unit is at full capacity.');
  }
  const existing = apps.findIndex((row) => row.unit_id === unitId && row.user_id === actor.id);
  const entry = {
    id: existing >= 0 ? apps[existing].id : window.crypto.randomUUID(),
    unit_id: unitId,
    user_id: actor.id,
    status: 'pending',
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null
  };
  if (existing >= 0) {
    apps[existing] = entry;
  } else {
    apps.push(entry);
  }
  writeJson(STORAGE_UNIT_APPS, apps);
  return entry.id;
}

export async function localReviewUnitApplication(applicationId, approve) {
  const actor = await localActor();
  const apps = unitAppRows();
  const rec = apps.find((row) => row.id === applicationId);
  if (!rec) {
    throw new Error('Application was not found.');
  }
  if (rec.status !== 'pending') {
    throw new Error('Application is no longer pending.');
  }
  if (!canManageUnit(actor, rec.unit_id)) {
    throw new Error('Only the unit head or a command administrator can review applications.');
  }
  const people = personnelRows();
  const person = people.find((row) => row.id === rec.user_id);
  const unit = unitRows().find((row) => row.id === rec.unit_id);
  if (approve) {
    if (person?.unit_id) {
      throw new Error('This personnel already belongs to a unit.');
    }
    const memberCount = people.filter((row) => row.unit_id === rec.unit_id).length;
    if (memberCount >= unit.max_capacity) {
      throw new Error('Unit is at full capacity.');
    }
    person.unit_id = rec.unit_id;
    person.unit_rank_id = null;
    person.wlc_agency = unit.name;
    savePersonnel(people);
    rec.status = 'approved';
  } else {
    rec.status = 'rejected';
  }
  rec.reviewed_at = new Date().toISOString();
  rec.reviewed_by = actor.id;
  writeJson(STORAGE_UNIT_APPS, apps);
}

export async function localSetUnitHead(unitId, userId) {
  const actor = await localActor();
  if (actor?.role !== 'admin') {
    throw new Error('Only command administrators can appoint unit heads.');
  }
  const units = unitRows();
  const unit = units.find((row) => row.id === unitId);
  if (!unit) {
    throw new Error('Unit was not found.');
  }
  unit.head_user_id = userId;
  writeJson(STORAGE_UNITS, units);
  if (userId) {
    const people = personnelRows();
    const person = people.find((row) => row.id === userId);
    if (person) {
      person.unit_id = unitId;
      person.wlc_agency = unit.name;
      savePersonnel(people);
    }
  }
}

export async function localSaveUnit(unitId, payload) {
  const actor = await localActor();
  if (!canManageUnit(actor, unitId)) {
    throw new Error('Unit update is not permitted.');
  }
  const units = unitRows();
  const unit = units.find((row) => row.id === unitId);
  if (!unit) {
    throw new Error('Unit was not found.');
  }
  if ('head_user_id' in payload && actor.role !== 'admin') {
    delete payload.head_user_id;
  }
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });
  Object.assign(unit, payload);
  writeJson(STORAGE_UNITS, units);
}

export async function localUploadUnitLogo(unitId, file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Logo file could not be read.'));
    reader.readAsDataURL(file);
  });
  await localSaveUnit(unitId, { logo_url: dataUrl });
  return dataUrl;
}

export async function localSaveUnitRank(entry) {
  const actor = await localActor();
  if (!canManageUnit(actor, entry.unit_id)) {
    throw new Error('Unit rank update is not permitted.');
  }
  const ranks = unitRankRows();
  if (entry.id) {
    const current = ranks.find((row) => row.id === entry.id);
    if (!current) {
      throw new Error('Unit rank was not found.');
    }
    current.title = entry.title;
    current.sort_order = entry.sort_order;
  } else {
    ranks.push({
      id: window.crypto.randomUUID(),
      unit_id: entry.unit_id,
      title: entry.title,
      sort_order: entry.sort_order ?? 0
    });
  }
  writeJson(STORAGE_UNIT_RANKS, ranks);
}

export async function localDeleteUnitRank(rankId) {
  const ranks = unitRankRows();
  const current = ranks.find((row) => row.id === rankId);
  if (!current) {
    return;
  }
  const actor = await localActor();
  if (!canManageUnit(actor, current.unit_id)) {
    throw new Error('Unit rank update is not permitted.');
  }
  writeJson(STORAGE_UNIT_RANKS, ranks.filter((row) => row.id !== rankId));
  const people = personnelRows();
  people.forEach((person) => {
    if (person.unit_rank_id === rankId) {
      person.unit_rank_id = null;
    }
  });
  savePersonnel(people);
}

export async function localSetUnitAnnouncements(unitId, announcementIds) {
  const actor = await localActor();
  if (!canManageUnit(actor, unitId)) {
    throw new Error('Unit update is not permitted.');
  }
  const others = unitLinkRows().filter((row) => row.unit_id !== unitId);
  writeJson(
    STORAGE_UNIT_LINKS,
    others.concat(announcementIds.map((announcementId) => ({ unit_id: unitId, announcement_id: announcementId })))
  );
}

export async function localSetUnitMemberRank(userId, rankId) {
  const people = personnelRows();
  const person = people.find((row) => row.id === userId);
  if (!person?.unit_id) {
    throw new Error('This personnel is not assigned to a unit.');
  }
  const actor = await localActor();
  if (!canManageUnit(actor, person.unit_id)) {
    throw new Error('Only the unit head or a command administrator can assign unit ranks.');
  }
  person.unit_rank_id = rankId;
  savePersonnel(people);
}

export async function localRemoveUnitMember(userId) {
  const people = personnelRows();
  const person = people.find((row) => row.id === userId);
  if (!person?.unit_id) {
    throw new Error('This personnel is not assigned to a unit.');
  }
  const actor = await localActor();
  if (!canManageUnit(actor, person.unit_id)) {
    throw new Error('Only the unit head or a command administrator can remove members.');
  }
  const units = unitRows();
  units.forEach((unit) => {
    if (unit.head_user_id === userId) {
      unit.head_user_id = null;
    }
  });
  writeJson(STORAGE_UNITS, units);
  person.unit_id = null;
  person.unit_rank_id = null;
  person.wlc_agency = null;
  savePersonnel(people);
}

export async function localDeletePersonnelAccount(userId) {
  const actor = await localActor();
  if (actor?.role !== 'admin') {
    throw new Error('Only command administrators can delete personnel.');
  }
  if (userId === actor.id) {
    throw new Error('You cannot delete your own account.');
  }
  const people = personnelRows();
  const target = people.find((row) => row.id === userId);
  if (!target) {
    throw new Error('Personnel was not found.');
  }
  if (target.role === 'admin' && people.filter((row) => row.role === 'admin').length <= 1) {
    throw new Error('The last administrator cannot be deleted.');
  }
  await localWriteLog({
    userId: actor.id,
    roleSnapshot: 'admin',
    actionType: 'personnel_delete',
    details: `Deleted personnel record ${userId}`
  });
  savePersonnel(people.filter((row) => row.id !== userId));
  writeJson(
    STORAGE_ACCOUNTS,
    accounts().filter((row) => row.id !== userId)
  );
}

export async function localFetchTickets(isAdmin, userId) {
  const rows = ticketRows()
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (isAdmin) {
    return clone(rows);
  }
  if (!userId) {
    return [];
  }
  return clone(rows.filter((row) => row.user_id === userId));
}

export async function localCreateTicket({ userId, category, customTopic, body, contactEmail }) {
  const rows = ticketRows();
  rows.unshift({
    id: window.crypto.randomUUID(),
    user_id: userId || null,
    category,
    custom_topic: customTopic,
    body,
    contact_email: contactEmail || null,
    status: 'open',
    admin_reply: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  writeJson(STORAGE_TICKETS, rows);
}

export async function localUpdateTicket(ticketId, payload) {
  const rows = ticketRows();
  const row = rows.find((item) => item.id === ticketId);
  if (!row) {
    throw new Error('Ticket was not found.');
  }
  Object.assign(row, payload, { updated_at: new Date().toISOString() });
  writeJson(STORAGE_TICKETS, rows);
}

function operationRows() {
  ensureLocalStation();
  return readJson(STORAGE_OPERATIONS, []);
}

function canPlanOps(actor) {
  if (!actor) {
    return false;
  }
  if (actor.role === 'admin') {
    return true;
  }
  return unitRows().some((unit) => unit.head_user_id === actor.id);
}

function canEditOp(actor, operationId) {
  if (!actor) {
    return false;
  }
  if (actor.role === 'admin') {
    return true;
  }
  const operation = operationRows().find((row) => row.id === operationId);
  if (operation?.created_by === actor.id) {
    return true;
  }
  return readJson(STORAGE_OP_SIDES, []).some(
    (row) => row.operation_id === operationId && canManageUnit(actor, row.unit_id)
  );
}

export async function localFetchOperations() {
  ensureLocalStation();
  return {
    operations: clone(operationRows()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    sides: clone(readJson(STORAGE_OP_SIDES, [])),
    aars: clone(readJson(STORAGE_OP_AAR, []))
  };
}

export async function localSaveOperation(payload) {
  const actor = await localActor();
  if (payload.id) {
    if (!canEditOp(actor, payload.id)) {
      throw new Error('Only administrators and unit leaders can edit this operation.');
    }
  } else if (!canPlanOps(actor)) {
    throw new Error('Only administrators and unit leaders can plan operations.');
  }
  const rows = operationRows();
  const now = new Date().toISOString();
  if (payload.id) {
    const row = rows.find((item) => item.id === payload.id);
    if (!row) {
      throw new Error('Operation was not found.');
    }
    Object.assign(row, {
      title: payload.title,
      briefing: payload.briefing,
      status: payload.status,
      drawings: payload.drawings || [],
      map_url: payload.map_url || row.map_url || '',
      commanding_officer: payload.commanding_officer || '',
      updated_at: now
    });
    writeJson(STORAGE_OPERATIONS, rows);
    writeJson(
      STORAGE_OP_SIDES,
      readJson(STORAGE_OP_SIDES, [])
        .filter((item) => item.operation_id !== payload.id)
        .concat((payload.sides || []).map((item) => ({ operation_id: payload.id, unit_id: item.unit_id, side: item.side })))
    );
    return payload.id;
  }
  const id = window.crypto.randomUUID();
  rows.unshift({
    id,
    title: payload.title,
    briefing: payload.briefing || '',
    status: payload.status || 'planning',
    drawings: payload.drawings || [],
    map_url: payload.map_url || '',
    commanding_officer: payload.commanding_officer || '',
    created_by: actor.id,
    created_at: now,
    updated_at: now
  });
  writeJson(STORAGE_OPERATIONS, rows);
  writeJson(
    STORAGE_OP_SIDES,
    readJson(STORAGE_OP_SIDES, []).concat(
      (payload.sides || []).map((item) => ({ operation_id: id, unit_id: item.unit_id, side: item.side }))
    )
  );
  return id;
}

export async function localDeleteOperation(operationId) {
  const actor = await localActor();
  const row = operationRows().find((item) => item.id === operationId);
  if (!row) {
    throw new Error('Operation was not found.');
  }
  if (!(actor?.role === 'admin' || row.created_by === actor?.id)) {
    throw new Error('You cannot delete this operation.');
  }
  writeJson(
    STORAGE_OPERATIONS,
    operationRows().filter((item) => item.id !== operationId)
  );
  writeJson(
    STORAGE_OP_SIDES,
    readJson(STORAGE_OP_SIDES, []).filter((item) => item.operation_id !== operationId)
  );
  writeJson(
    STORAGE_OP_AAR,
    readJson(STORAGE_OP_AAR, []).filter((item) => item.operation_id !== operationId)
  );
}

export async function localSaveOperationAar(payload) {
  const actor = await localActor();
  if (!canEditOp(actor, payload.operation_id)) {
    throw new Error('Only administrators and unit leaders can write after-action reports.');
  }
  const rows = readJson(STORAGE_OP_AAR, []);
  const existing = rows.find(
    (item) => item.operation_id === payload.operation_id && item.unit_id === payload.unit_id
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.evaluation = payload.evaluation || '';
    existing.authored_by = actor.id;
    existing.updated_at = now;
  } else {
    rows.push({
      operation_id: payload.operation_id,
      unit_id: payload.unit_id,
      evaluation: payload.evaluation || '',
      authored_by: actor.id,
      updated_at: now
    });
  }
  writeJson(STORAGE_OP_AAR, rows);
}

export async function localFetchOfficialDocs() {
  const actor = await localActor();
  if (!actor) {
    throw new Error('Sign in is required.');
  }
  const units = unitRows();
  return clone(readJson(STORAGE_MEMOS, [])).filter((row) => canAccessMemoFolder(actor, row.folder, units));
}

export async function localSaveOfficialDoc(doc) {
  const actor = await localActor();
  if (!actor) {
    throw new Error('Sign in is required.');
  }
  const units = unitRows();
  if (!canAccessMemoFolder(actor, doc.folder || 'normal', units)) {
    throw new Error('You cannot save to this folder.');
  }
  const rows = readJson(STORAGE_MEMOS, []);
  const now = new Date().toISOString();
  if (doc.id) {
    const index = rows.findIndex((row) => row.id === doc.id);
    if (index === -1) {
      throw new Error('Memorandum was not found.');
    }
    if (!canEditMemo(actor, rows[index], units)) {
      throw new Error('You cannot edit this memorandum.');
    }
    rows[index] = {
      ...rows[index],
      folder: doc.folder || rows[index].folder,
      doc_no: doc.doc_no || '',
      doc_date: doc.doc_date || '',
      subject: doc.subject || '',
      addressed_to: doc.addressed_to || '',
      body: doc.body || '',
      sign_name: doc.sign_name || '',
      sign_title: doc.sign_title || '',
      logo_url: doc.logo_url || rows[index].logo_url || null,
      updated_at: now
    };
    writeJson(STORAGE_MEMOS, rows);
    return clone(rows[index]);
  }
  const saved = {
    id: window.crypto.randomUUID(),
    folder: doc.folder || 'normal',
    doc_no: doc.doc_no || '',
    doc_date: doc.doc_date || '',
    subject: doc.subject || '',
    addressed_to: doc.addressed_to || '',
    body: doc.body || '',
    sign_name: doc.sign_name || '',
    sign_title: doc.sign_title || '',
    logo_url: doc.logo_url || null,
    created_by: actor.id,
    created_at: now,
    updated_at: now
  };
  rows.unshift(saved);
  writeJson(STORAGE_MEMOS, rows);
  return clone(saved);
}

export async function localDeleteOfficialDoc(docId) {
  const actor = await localActor();
  const units = unitRows();
  const rows = readJson(STORAGE_MEMOS, []);
  const row = rows.find((item) => item.id === docId);
  if (!row) {
    throw new Error('Memorandum was not found.');
  }
  if (!canEditMemo(actor, row, units)) {
    throw new Error('You cannot delete this memorandum.');
  }
  writeJson(
    STORAGE_MEMOS,
    rows.filter((item) => item.id !== docId)
  );
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

