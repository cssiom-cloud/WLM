import { isLocalTestMode, WLR_COMMAND_CONFIG } from './config.js';

let supabaseClient = null;

if (!isLocalTestMode()) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabaseClient = createClient(WLR_COMMAND_CONFIG.supabaseUrl, WLR_COMMAND_CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });
}

export { supabaseClient };
