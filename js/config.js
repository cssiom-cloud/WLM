export const WLR_COMMAND_CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  forceLocalTest: false
};

export function isLocalTestMode() {
  if (WLR_COMMAND_CONFIG.forceLocalTest) {
    return true;
  }

  const url = String(WLR_COMMAND_CONFIG.supabaseUrl || '');
  const key = String(WLR_COMMAND_CONFIG.supabaseAnonKey || '');
  return url.startsWith('YOUR_') || key.startsWith('YOUR_') || url.trim() === '' || key.trim() === '';
}
