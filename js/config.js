export const WLR_COMMAND_CONFIG = {
  supabaseUrl: 'https://ltfiluaddwebijhbipdb.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZmlsdWFkZHdlYmlqaGJpcGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQwNDEsImV4cCI6MjEwMjY0MDA0MX0.9ba9eaFDA6IlyJNRZYrj5txZPffZC-OoJ5VK-RN4SMI',
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
