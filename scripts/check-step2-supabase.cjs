const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ltfiluaddwebijhbipdb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZmlsdWFkZHdlYmlqaGJpcGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQwNDEsImV4cCI6MjEwMjY0MDA0MX0.9ba9eaFDA6IlyJNRZYrj5txZPffZC-OoJ5VK-RN4SMI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStep2() {
  console.log('Checking Supabase connection to:', SUPABASE_URL);

  // 1. Check Table app_versions
  const { data: versions, error: versionsErr } = await supabase
    .from('app_versions')
    .select('*')
    .limit(1);

  if (versionsErr) {
    console.log('[Table app_versions]: Not ready / error ->', versionsErr.message);
  } else {
    console.log('[Table app_versions]: READY! Sample data ->', versions);
  }

  // 2. Check Storage Bucket app-updates
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    console.log('[Storage Bucket app-updates]: Note ->', bucketErr.message);
  } else {
    const found = buckets.find(b => b.name === 'app-updates');
    if (found) {
      console.log('[Storage Bucket app-updates]: READY! (Public:', found.public, ')');
    } else {
      console.log('[Storage Bucket app-updates]: Not created yet. Available buckets:', buckets.map(b => b.name));
    }
  }
}

checkStep2();
