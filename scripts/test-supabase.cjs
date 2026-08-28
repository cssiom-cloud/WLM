const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ltfiluaddwebijhbipdb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZmlsdWFkZHdlYmlqaGJpcGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQwNDEsImV4cCI6MjEwMjY0MDA0MX0.9ba9eaFDA6IlyJNRZYrj5txZPffZC-OoJ5VK-RN4SMI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing Supabase connection to:', supabaseUrl);
  
  try {
    // 1. Test app_versions query
    const { data: versions, error: versionsErr } = await supabase
      .from('app_versions')
      .select('*');
      
    if (versionsErr) {
      console.log('app_versions query result: Error / Table not created yet:', versionsErr.message);
    } else {
      console.log('app_versions query SUCCESS! Found records:', versions);
    }

    // 2. Test personnel query
    const { data: personnel, error: personnelErr } = await supabase
      .from('personnel')
      .select('count', { count: 'exact', head: true });
      
    if (personnelErr) {
      console.log('personnel table test:', personnelErr.message);
    } else {
      console.log('Supabase connection verified! Personnel count query successful.');
    }
  } catch (err) {
    console.error('Fatal connection error:', err);
  }
}

testConnection();
