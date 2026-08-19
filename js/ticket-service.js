import { isLocalTestMode } from './config.js';
import { supabaseClient } from './supabase-client.js';
import { localCreateTicket, localFetchTickets, localUpdateTicket } from './local-station.js';

export async function fetchTickets(isAdmin, userId) {
  if (isLocalTestMode()) {
    return localFetchTickets(isAdmin, userId);
  }

  if (!isAdmin && !userId) {
    return [];
  }

  let query = supabaseClient.from('support_tickets').select('*').order('created_at', { ascending: false });
  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function createTicket({ userId, category, customTopic, body, contactEmail }) {
  if (isLocalTestMode()) {
    return localCreateTicket({ userId, category, customTopic, body, contactEmail });
  }

  const { error } = await supabaseClient.from('support_tickets').insert({
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

export async function updateTicket(ticketId, payload) {
  if (isLocalTestMode()) {
    return localUpdateTicket(ticketId, payload);
  }
  const { error } = await supabaseClient.from('support_tickets').update(payload).eq('id', ticketId);
  if (error) {
    throw error;
  }
}
