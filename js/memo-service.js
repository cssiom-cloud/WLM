import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import { localDeleteOfficialDoc, localFetchOfficialDocs, localSaveOfficialDoc } from './local-station.js';

function payloadFrom(doc) {
  return {
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
}

export async function fetchOfficialDocs() {
  if (isLocalTestMode()) {
    return localFetchOfficialDocs();
  }
  const { data, error } = await supabaseClient
    .from('oc_official_docs')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function saveOfficialDoc(doc, actorId) {
  if (isLocalTestMode()) {
    return localSaveOfficialDoc(doc, actorId);
  }
  const payload = payloadFrom(doc);
  if (doc.id) {
    const { data, error } = await supabaseClient
      .from('oc_official_docs')
      .update(payload)
      .eq('id', doc.id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return data;
  }
  const { data, error } = await supabaseClient
    .from('oc_official_docs')
    .insert({ ...payload, created_by: actorId })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteOfficialDoc(docId) {
  if (isLocalTestMode()) {
    return localDeleteOfficialDoc(docId);
  }
  const { error } = await supabaseClient.from('oc_official_docs').delete().eq('id', docId);
  if (error) {
    throw error;
  }
}
