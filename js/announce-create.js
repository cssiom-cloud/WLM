import { bootCommandShell, initAos } from './shell.js';
import { requireCommandAdmin } from './session.js';
import { showToast } from './ui.js';
import { t } from './i18n.js';
// SUPABASE INJECT POINT: createAnnouncement() uploads the cover image to the
// 'announcement_covers' Storage bucket, then inserts into public.announcements.
// RLS restricts both the upload and the insert to command admins.
import { createAnnouncement } from './announcement-service.js';
import { supabaseClient } from './supabase-client.js';

let currentAdmin = null;

bootCommandShell('announce-create');
initAos();

// Admin-only page: client-side redirect here, RLS enforcement on the database side.
requireCommandAdmin()
  .then((result) => {
    if (result) {
      currentAdmin = result.personnel;
    }
  })
  .catch((error) => {
    showToast(error.message, 'error', 6000);
  });

const imageInput = document.querySelector('#announce-image');
const imagePreview = document.querySelector('#announce-image-preview');
const honorEnabledInput = document.querySelector('#announce-honor-enabled');
const honorTitleInput = document.querySelector('#announce-honor-title');

function syncHonorTitleField() {
  honorTitleInput.disabled = !honorEnabledInput.checked;
  if (!honorEnabledInput.checked) {
    honorTitleInput.value = '';
  }
}

honorEnabledInput.addEventListener('change', syncHonorTitleField);

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) {
    imagePreview.hidden = true;
    return;
  }
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.hidden = false;
});

document.querySelector('#announce-form').addEventListener('reset', () => {
  imagePreview.hidden = true;
  honorEnabledInput.checked = false;
  syncHonorTitleField();
});

document.querySelector('#announce-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentAdmin) {
    return;
  }

  const title = document.querySelector('#announce-title').value.trim();
  const content = document.querySelector('#announce-content').value.trim();
  const maxCapacity = Number(document.querySelector('#announce-capacity').value);
  const imageFile = imageInput.files?.[0] || null;
  const awardHonorEnabled = honorEnabledInput.checked;
  const honorRankTitle = honorTitleInput.value.trim();

  if (!title || !content || !Number.isInteger(maxCapacity) || maxCapacity < 1) {
    showToast(t('create.invalid'), 'error');
    return;
  }

  if (awardHonorEnabled && !honorRankTitle) {
    showToast(t('create.honorRequired'), 'error');
    return;
  }

  try {
    const created = await createAnnouncement({
      title,
      content,
      maxCapacity,
      createdBy: currentAdmin.id,
      imageFile,
      awardHonorEnabled,
      honorRankTitle: awardHonorEnabled ? honorRankTitle : null
    });

    // DISCORD WEBHOOK INJECT POINT:
    // Proxy through Edge Function notify-discord so the webhook URL stays server-side.
    if (supabaseClient) {
      const { error: notifyError } = await supabaseClient.functions.invoke('notify-discord', {
        body: {
          title,
          content,
          maxCapacity,
          imageUrl: created?.image_url || ''
        }
      });
      if (notifyError) {
        console.warn('Discord notify failed', notifyError.message);
      }
    }

    showToast(t('create.published'), 'success');
    window.setTimeout(() => {
      window.location.href = './announcements.html';
    }, 700);
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
});
