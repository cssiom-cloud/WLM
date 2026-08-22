import { createClient } from '@supabase/supabase-js';
import { WLR_COMMAND_CONFIG } from './config.js';

export const supabase = createClient(WLR_COMMAND_CONFIG.supabaseUrl, WLR_COMMAND_CONFIG.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window === 'undefined' ? undefined : window.localStorage
  }
});
