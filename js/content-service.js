import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import {
  localDeleteDocument,
  localDeleteLoreEntry,
  localFetchDocuments,
  localFetchLore,
  localSaveDocument,
  localSaveLoreEntry
} from './local-station.js';

/* ---------- Lore archive (admin managed) ---------- */

// SUPABASE INJECT POINT: reads public.lore_entries (public select via RLS).
export async function fetchLoreEntries() {
  if (isLocalTestMode()) {
    return localFetchLore();
  }
  const { data, error } = await supabaseClient
    .from('lore_entries')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
}

// SUPABASE INJECT POINT: insert/update public.lore_entries (admin-only via RLS).
export async function saveLoreEntry(entry) {
  if (isLocalTestMode()) {
    return localSaveLoreEntry(entry);
  }
  const payload = {
    category: entry.category,
    title: entry.title,
    meta1: entry.meta1,
    meta2: entry.meta2,
    body: entry.body,
    sort_order: entry.sort_order
  };
  const query = entry.id
    ? supabaseClient.from('lore_entries').update(payload).eq('id', entry.id)
    : supabaseClient.from('lore_entries').insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    throw error;
  }
  return data;
}

// SUPABASE INJECT POINT: delete from public.lore_entries (admin-only via RLS).
export async function deleteLoreEntry(entryId) {
  if (isLocalTestMode()) {
    return localDeleteLoreEntry(entryId);
  }
  const { error } = await supabaseClient.from('lore_entries').delete().eq('id', entryId);
  if (error) {
    throw error;
  }
}

/* ---------- Document center (admin managed) ---------- */

// SUPABASE INJECT POINT: reads public.command_documents.
export async function fetchDocuments() {
  if (isLocalTestMode()) {
    return localFetchDocuments();
  }
  const { data, error } = await supabaseClient
    .from('command_documents')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
}

// SUPABASE INJECT POINT: insert/update public.command_documents (admin-only via RLS).
export async function saveDocument(doc) {
  if (isLocalTestMode()) {
    return localSaveDocument(doc);
  }
  const payload = { title: doc.title, markdown: doc.markdown };
  const query = doc.id
    ? supabaseClient.from('command_documents').update(payload).eq('id', doc.id)
    : supabaseClient.from('command_documents').insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    throw error;
  }
  return data;
}

// SUPABASE INJECT POINT: delete from public.command_documents (admin-only via RLS).
export async function deleteDocument(documentId) {
  if (isLocalTestMode()) {
    return localDeleteDocument(documentId);
  }
  const { error } = await supabaseClient.from('command_documents').delete().eq('id', documentId);
  if (error) {
    throw error;
  }
}
