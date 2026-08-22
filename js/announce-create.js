import { bootCommandShell, initAos } from './shell.js';
import { requireCommandAdmin } from './session.js';
import { showToast } from './ui.js';
import { t } from './i18n.js';
import { createAnnouncement, fetchAnnouncementBoard, updateAnnouncement } from './announcement-service.js';
import { supabaseClient } from './supabase-client.js';
import { openImageEditor, assignFileToInput } from './image-editor.js';

let currentAdmin = null;
let editingId = new URLSearchParams(window.location.search).get('id');
let currentCoverUrl = '';

bootCommandShell('announce-create');
initAos();

const imageInput = document.querySelector('#announce-image');
const imagePreview = document.querySelector('#announce-image-preview');
const honorEnabledInput = document.querySelector('#announce-honor-enabled');
const honorTitleInput = document.querySelector('#announce-honor-title');
const titleInput = document.querySelector('#announce-title');
const contentInput = document.querySelector('#announce-content');
const capacityInput = document.querySelector('#announce-capacity');
const capacityLimitedInput = document.querySelector('#announce-capacity-limited');
const capacityWrap = document.querySelector('#announce-capacity-wrap');
const capacityHint = document.querySelector('#announce-capacity-hint');
const showParticipantsInput = document.querySelector('#announce-show-participants');
const submitButton = document.querySelector('#announce-submit');
const pageTitle = document.querySelector('.page-title');

function syncHonorTitleField() {
  honorTitleInput.disabled = !honorEnabledInput.checked;
  if (!honorEnabledInput.checked) {
    honorTitleInput.value = '';
  }
}

function syncCapacityField() {
  const limited = capacityLimitedInput?.checked !== false;
  if (capacityWrap) {
    capacityWrap.hidden = !limited;
  }
  if (capacityInput) {
    capacityInput.required = limited;
    capacityInput.disabled = !limited;
  }
  if (capacityHint) {
    capacityHint.hidden = limited;
  }
}

function showPreview(url) {
  if (!url) {
    imagePreview.hidden = true;
    imagePreview.removeAttribute('src');
    return;
  }
  imagePreview.src = url;
  imagePreview.hidden = false;
}

function refreshCopy() {
  pageTitle.textContent = editingId ? t('create.editing') : t('create.title');
  submitButton.textContent = editingId ? t('create.update') : t('create.publish');
  const clearButton = document.querySelector('#announce-form [type="reset"]');
  if (clearButton) {
    clearButton.hidden = Boolean(editingId);
  }
}

honorEnabledInput.addEventListener('change', syncHonorTitleField);
capacityLimitedInput?.addEventListener('change', syncCapacityField);

document.querySelector('#announce-crop')?.addEventListener('click', async () => {
  const source = imageInput.files?.[0] || currentCoverUrl || null;
  const result = await openImageEditor({
    source,
    aspect: '16:9',
    previewMask: 'rect',
    filename: 'announcement-cover.jpg',
    size: 1280
  });
  if (!result?.file) {
    return;
  }
  assignFileToInput(imageInput, result.file);
  showPreview(URL.createObjectURL(result.file));
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) {
    if (currentCoverUrl) {
      showPreview(currentCoverUrl);
      return;
    }
    showPreview('');
    return;
  }
  showPreview(URL.createObjectURL(file));
});

document.querySelector('#announce-form').addEventListener('reset', () => {
  if (editingId) {
    return;
  }
  currentCoverUrl = '';
  showPreview('');
  honorEnabledInput.checked = false;
  if (capacityLimitedInput) {
    capacityLimitedInput.checked = true;
  }
  if (showParticipantsInput) {
    showParticipantsInput.checked = true;
  }
  syncHonorTitleField();
  syncCapacityField();
});

document.querySelector('#announce-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentAdmin) {
    return;
  }

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const maxCapacity = Number(capacityInput.value);
  const imageFile = imageInput.files?.[0] || null;
  const awardHonorEnabled = honorEnabledInput.checked;
  const honorRankTitle = honorTitleInput.value.trim();
  const capacityLimited = capacityLimitedInput?.checked !== false;
  const showParticipants = showParticipantsInput?.checked !== false;

  if (!title || !content || (capacityLimited && (!Number.isInteger(maxCapacity) || maxCapacity < 1))) {
    showToast(t('create.invalid'), 'error');
    return;
  }

  if (awardHonorEnabled && !honorRankTitle) {
    showToast(t('create.honorRequired'), 'error');
    return;
  }

  try {
    const payload = {
      title,
      content,
      maxCapacity: capacityLimited ? maxCapacity : 1,
      createdBy: currentAdmin.id,
      imageFile,
      awardHonorEnabled,
      honorRankTitle: awardHonorEnabled ? honorRankTitle : null,
      showParticipants,
      capacityLimited
    };
    const saved = editingId
      ? await updateAnnouncement(editingId, payload)
      : await createAnnouncement(payload);

    if (!editingId && supabaseClient) {
      const { error: notifyError } = await supabaseClient.functions.invoke('notify-discord', {
        body: {
          title,
          content,
          maxCapacity,
          imageUrl: saved?.image_url || ''
        }
      });
      if (notifyError) {
        console.warn('Discord notify failed', notifyError.message);
      }
    }

    showToast(editingId ? t('ann.updated') : t('create.published'), 'success');
    window.setTimeout(() => {
      window.location.href = './announcements.html';
    }, 700);
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
});

requireCommandAdmin()
  .then(async (result) => {
    if (!result) {
      return;
    }
    currentAdmin = result.personnel;
    refreshCopy();
    syncHonorTitleField();
    syncCapacityField();
    if (!editingId) {
      return;
    }
    const board = await fetchAnnouncementBoard(currentAdmin.id);
    const item = board.find((row) => row.id === editingId);
    if (!item) {
      showToast(t('ann.empty'), 'error');
      editingId = '';
      refreshCopy();
      return;
    }
    titleInput.value = item.title || '';
    contentInput.value = item.content || '';
    capacityInput.value = item.max_capacity || 1;
    honorEnabledInput.checked = Boolean(item.award_honor_enabled);
    honorTitleInput.value = item.honor_rank_title || '';
    if (capacityLimitedInput) {
      capacityLimitedInput.checked = item.capacity_limited !== false;
    }
    if (showParticipantsInput) {
      showParticipantsInput.checked = item.show_participants !== false;
    }
    currentCoverUrl = item.image_url || '';
    showPreview(currentCoverUrl);
    syncHonorTitleField();
    syncCapacityField();
    refreshCopy();
  })
  .catch((error) => {
    showToast(error.message, 'error', 6000);
  });

window.addEventListener('wlr-lang-changed', refreshCopy);
