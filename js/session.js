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
    throw error;
  }
  return data;
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
