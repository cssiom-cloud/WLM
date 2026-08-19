import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import {
  localReadCurrentPersonnel,
  localReadSession,
  localSignIn,
  localSignOut,
  localSignUp
} from './local-station.js';

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

export async function readCurrentPersonnel() {
  if (isLocalTestMode()) {
    return localReadCurrentPersonnel();
  }

  const session = await readSession();
  if (!session?.user) {
    return { session: null, personnel: null };
  }

  const { data, error } = await supabaseClient
    .from('oc_personnel')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    throw error;
  }

  return { session, personnel: data };
}

export async function requireAuthenticatedPersonnel() {
  const result = await readCurrentPersonnel();
  if (!result.session) {
    window.location.replace('./login.html');
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

export async function signOutSession() {
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
