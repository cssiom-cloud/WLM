import { isLocalTestMode } from './config.js';
import { t } from './i18n.js';
import { supabaseClient } from './supabase-client.js';
import {
  localCreatePersonnelProfile,
  localOwnedPersonnel,
  localReadCurrentPersonnel,
  localReadSession,
  localSetActivePersonnel,
  localSignIn,
  localSignOut,
  localSignUp
} from './local-station.js';

const ACTIVE_PERSONNEL_KEY = 'wlr-active-personnel-id';

export async function readSession() {
  if (isLocalTestMode()) {
    return localReadSession();
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function readStoredActivePersonnelId() {
  return window.localStorage.getItem(ACTIVE_PERSONNEL_KEY) || '';
}

export function clearStoredActivePersonnelId() {
  window.localStorage.removeItem(ACTIVE_PERSONNEL_KEY);
}

function rememberActivePersonnelId(personnelId) {
  if (personnelId) {
    window.localStorage.setItem(ACTIVE_PERSONNEL_KEY, personnelId);
  }
}

function isProfileSelectorPage() {
  return /profiles\.html$/i.test(window.location.pathname);
}

export async function fetchOwnedPersonnel(authUserId) {
  if (isLocalTestMode()) {
    return localOwnedPersonnel(authUserId);
  }

  const { data, error } = await supabaseClient
    .from('oc_personnel')
    .select('*')
    .eq('owner_user_id', authUserId)
    .order('first_name', { ascending: true });

  if (!error) {
    return data || [];
  }

  const { data: legacy, error: legacyError } = await supabaseClient
    .from('oc_personnel')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();
  if (legacyError) {
    throw error;
  }
  return legacy ? [legacy] : [];
}

export async function setActivePersonnel(personnelId) {
  rememberActivePersonnelId(personnelId);
  if (isLocalTestMode()) {
    localSetActivePersonnel(personnelId);
    return personnelId;
  }
  const { error } = await supabaseClient.rpc('set_active_personnel', {
    p_personnel_id: personnelId
  });
  if (error) {
    throw error;
  }
  return personnelId;
}

export async function createPersonnelProfile({ firstName = '', lastName = '' } = {}) {
  if (isLocalTestMode()) {
    const session = await localReadSession();
    return localCreatePersonnelProfile(session.user.id, session.user.email, firstName, lastName);
  }

  const { data, error } = await supabaseClient.rpc('create_personnel_profile', {
    p_first_name: firstName,
    p_last_name: lastName
  });
  if (error) {
    throw error;
  }
  rememberActivePersonnelId(data);
  const { data: row, error: rowError } = await supabaseClient
    .from('oc_personnel')
    .select('*')
    .eq('id', data)
    .single();
  if (rowError) {
    throw rowError;
  }
  return row;
}

function findOwnedPersonnel(owned, personnelId) {
  return owned.find((row) => row.id === personnelId) || null;
}

function pickActivePersonnel(owned, preferredId) {
  return findOwnedPersonnel(owned, preferredId) || owned[0] || null;
}

export async function routeAfterAuth() {
  const session = await readSession();
  if (!session?.user) {
    return;
  }
  let owned = await fetchOwnedPersonnel(session.user.id);
  if (!owned.length) {
    await createPersonnelProfile({});
    owned = await fetchOwnedPersonnel(session.user.id);
  }
  if (owned.length > 1) {
    window.location.replace('./profiles.html');
    return;
  }
  if (owned[0]) {
    await setActivePersonnel(owned[0].id);
  }
  window.location.replace('./index.html');
}

export async function readCurrentPersonnel() {
  // AuthUser = Discord/email identity (session.user).
  // ActivePersonnel = selected oc_personnel row owned by that identity.
  if (isLocalTestMode()) {
    const local = await localReadCurrentPersonnel();
    return {
      session: local.session,
      personnel: local.personnel,
      authUser: local.session?.user || null,
      profiles: local.profiles || []
    };
  }

  const session = await readSession();
  if (!session?.user) {
    return { session: null, personnel: null, authUser: null, profiles: [] };
  }

  const owned = await fetchOwnedPersonnel(session.user.id);
  let preferredId = readStoredActivePersonnelId();
  if (!isLocalTestMode() && supabaseClient) {
    const { data: state } = await supabaseClient
      .from('oc_auth_state')
      .select('active_personnel_id')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();
    if (state?.active_personnel_id) {
      preferredId = state.active_personnel_id;
    }
  }
  const personnel = pickActivePersonnel(owned, preferredId);
  if (personnel && personnel.id !== readStoredActivePersonnelId()) {
    rememberActivePersonnelId(personnel.id);
  }
  return { session, personnel, authUser: session.user, profiles: owned };
}

export async function requireAuthUser() {
  const session = await readSession();
  if (!session?.user) {
    window.location.replace('./login.html');
    return null;
  }
  const owned = await fetchOwnedPersonnel(session.user.id);
  return { session, authUser: session.user, profiles: owned };
}

export async function requireAuthenticatedPersonnel() {
  const result = await readCurrentPersonnel();
  if (!result.session) {
    window.location.replace('./login.html');
    return null;
  }
  if (isProfileSelectorPage()) {
    return result;
  }
  if (!result.profiles.length) {
    await createPersonnelProfile({});
    window.location.replace('./index.html');
    return null;
  }
  if (result.profiles.length > 1 && !findOwnedPersonnel(result.profiles, readStoredActivePersonnelId())) {
    window.location.replace('./profiles.html');
    return null;
  }
  if (!result.personnel) {
    window.location.replace('./profiles.html');
    return null;
  }
  return result;
}

export async function requireCommandAdmin() {
  const result = await requireAuthenticatedPersonnel();
  if (!result) {
    return null;
  }
  if (result.personnel?.role !== 'admin') {
    window.location.replace('./index.html');
    return null;
  }
  return result;
}

export async function signInWithEmail(email, password) {
  if (isLocalTestMode()) {
    return localSignIn(email, password);
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data;
}

export async function signUpWithEmail(email, password) {
  if (isLocalTestMode()) {
    return localSignUp(email, password);
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    throw clarifySignupError(error);
  }
  return data;
}

function clarifySignupError(error) {
  const message = String(error?.message || '');
  const code = String(error?.code || error?.name || '');
  const alreadyRegistered =
    code === 'user_already_exists' ||
    /already registered/i.test(message) ||
    /users_email_partial_key/i.test(message) ||
    /database error saving new user/i.test(message);

  if (alreadyRegistered) {
    return new Error('This email is already registered. Sign in instead.');
  }

  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return new Error('Too many confirmation emails were sent. Sign in if the account already exists, or try again in about an hour.');
  }

  if (
    code === 'email_address_invalid' ||
    /email address .* is invalid/i.test(message) ||
    /example and test domains/i.test(message)
  ) {
    return new Error(
      'Use a real personal email address. Addresses such as test@gmail.com are not accepted.'
    );
  }

  return error;
}

function oauthRedirectUrl(relativePath) {
  return new URL(relativePath, window.location.href).href.split('#')[0].split('?')[0];
}

function requireRemoteAuth() {
  if (isLocalTestMode() || !supabaseClient) {
    throw new Error(t('auth.discordLocal'));
  }
}

export function readAuthRedirectError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  return (
    query.get('error_description') ||
    query.get('error') ||
    hash.get('error_description') ||
    hash.get('error') ||
    ''
  );
}

export function clearAuthRedirectParams() {
  const url = new URL(window.location.href);
  ['code', 'error', 'error_description', 'error_code', 'state'].forEach((key) => {
    url.searchParams.delete(key);
  });
  if (url.hash && /access_token|error|code|provider/.test(url.hash)) {
    url.hash = '';
  }
  const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ''}`;
  window.history.replaceState({}, document.title, next);
}

export async function readAuthUser() {
  if (isLocalTestMode()) {
    const session = await localReadSession();
    return session?.user || { identities: [] };
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    throw error;
  }
  const user = data.user;
  if (user && !(user.identities || []).length) {
    const { data: identityData } = await supabaseClient.auth.getUserIdentities();
    if (identityData?.identities) {
      user.identities = identityData.identities;
    }
  }
  return user;
}

export function findDiscordIdentity(user) {
  return (user?.identities || []).find((item) => item.provider === 'discord') || null;
}

export function discordDisplay(identity, user) {
  const data = identity?.identity_data || {};
  const meta = user?.user_metadata || {};
  const claims = data.custom_claims || meta.custom_claims || {};
  const username =
    claims.global_name ||
    data.full_name ||
    data.name ||
    data.preferred_username ||
    meta.full_name ||
    meta.name ||
    meta.preferred_username ||
    'Discord';
  return {
    username,
    avatar: data.avatar_url || meta.avatar_url || ''
  };
}

export async function signInWithDiscord() {
  requireRemoteAuth();
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: oauthRedirectUrl('./login.html'),
      scopes: 'identify email'
    }
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function linkDiscordIdentity() {
  requireRemoteAuth();
  const { data, error } = await supabaseClient.auth.linkIdentity({
    provider: 'discord',
    options: {
      redirectTo: oauthRedirectUrl('./settings.html'),
      scopes: 'identify email'
    }
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function unlinkDiscordIdentity() {
  requireRemoteAuth();
  const { data, error } = await supabaseClient.auth.getUserIdentities();
  if (error) {
    throw error;
  }
  const identities = data?.identities || [];
  if (identities.length < 2) {
    throw new Error(t('settings.discordNeedOther'));
  }
  const discord = identities.find((item) => item.provider === 'discord');
  if (!discord) {
    throw new Error(t('settings.discordMissing'));
  }
  const { error: unlinkError } = await supabaseClient.auth.unlinkIdentity(discord);
  if (unlinkError) {
    throw unlinkError;
  }
}

export async function signOutSession() {
  clearStoredActivePersonnelId();
  if (isLocalTestMode()) {
    await localSignOut();
    window.location.replace('./login.html');
    return;
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    throw error;
  }
  window.location.replace('./login.html');
}
