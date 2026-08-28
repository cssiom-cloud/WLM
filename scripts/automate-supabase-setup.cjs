const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ltfiluaddwebijhbipdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZmlsdWFkZHdlYmlqaGJpcGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQwNDEsImV4cCI6MjEwMjY0MDA0MX0.9ba9eaFDA6IlyJNRZYrj5txZPffZC-OoJ5VK-RN4SMI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAutomation() {
  console.log('=== Step 2: Supabase Automated Backend Setup ===');
  console.log('Target URL:', SUPABASE_URL);

  // 1. Create or Verify Storage Bucket "app-updates"
  try {
    console.log('\n[1/3] Checking Storage Bucket "app-updates"...');
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    
    if (listErr) {
      console.log('List buckets note:', listErr.message);
    } else {
      console.log('Existing buckets:', buckets.map(b => b.name));
      const exists = buckets.some(b => b.name === 'app-updates');
      if (!exists) {
        console.log('Creating bucket "app-updates" (public: true)...');
        const { data: createData, error: createErr } = await supabase.storage.createBucket('app-updates', {
          public: true,
          fileSizeLimit: 104857600 // 100MB
        });
        if (createErr) {
          console.log('Storage bucket create note (requires auth/service role if RLS locked):', createErr.message);
        } else {
          console.log('Storage bucket "app-updates" created successfully!');
        }
      } else {
        console.log('Storage bucket "app-updates" already exists.');
      }
    }
  } catch (err) {
    console.warn('Storage operation exception:', err.message);
  }

  // 2. Check and Insert Table "app_versions"
  try {
    console.log('\n[2/3] Checking table "app_versions"...');
    const { data, error } = await supabase
      .from('app_versions')
      .select('*');

    if (error) {
      console.log('app_versions status: Table needs to be created in Supabase SQL Editor.');
      console.log('Error detail:', error.message);
    } else {
      console.log('app_versions table is active! Current records:', data);

      // Insert or upsert v1.0.1
      console.log('Upserting v1.0.1 release record...');
      const { data: upsertData, error: upsertErr } = await supabase
        .from('app_versions')
        .upsert({
          version: 'v1.0.1',
          release_date: new Date().toISOString(),
          download_url: 'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal%20Setup%201.0.6.exe',
          portable_url: 'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal-v1.0.6-Portable.exe',
          release_notes: 'WLR Command Portal v1.0.1 - Clean Reset Release with WebAuthn Passkey support and Supabase Cloud Auto-Updater.',
          is_critical: false,
          is_active: true
        }, { onConflict: 'version' });

      if (upsertErr) {
        console.log('Upsert error:', upsertErr.message);
      } else {
        console.log('v1.0.1 release record inserted successfully!');
      }
    }
  } catch (err) {
    console.warn('Database operation exception:', err.message);
  }

  console.log('\n=== Automation Task Completed ===');
}

runAutomation();
