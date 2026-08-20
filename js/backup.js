import { bootCommandShell } from './shell.js';
import { requireCommandAdmin } from './session.js';
import { showToast, withOverlay } from './ui.js';
import { t } from './i18n.js';
import {
  buildMigrationPack,
  downloadMigrationPack,
  driveClientId,
  requestDriveToken,
  uploadPackToDrive
} from './drive-migration.js';

let packCache = null;

function renderStatus(message, kind = '') {
  const status = document.querySelector('#backup-status');
  status.textContent = message || '';
  status.hidden = !message;
  status.className = `form-hint${kind ? ` is-${kind}` : ''}`;
}

function renderSummary(pack) {
  const box = document.querySelector('#backup-summary');
  if (!pack) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <li>${pack.personnel.length} ${t('backup.personnel')}</li>
    <li>${pack.announcements.length} ${t('backup.announcements')}</li>
    <li>${pack.units.length} ${t('backup.units')}</li>
    <li>${pack.lore.length} ${t('backup.lore')}</li>
    <li>${pack.documents.length} ${t('backup.documents')}</li>
    <li>${pack.images.length} ${t('backup.images')}</li>
  `;
}

function refreshCopy() {
  document.querySelector('#backup-client-note').textContent = driveClientId()
    ? t('backup.clientReady')
    : t('backup.needClient');
  document.querySelector('[data-backup-prepare]').textContent = t('backup.prepare');
  document.querySelector('[data-backup-download]').textContent = t('backup.download');
  document.querySelector('[data-backup-drive]').textContent = t('backup.upload');
}

bootCommandShell('backup');

requireCommandAdmin()
  .then((result) => {
    if (!result) {
      return;
    }
    refreshCopy();
  })
  .catch((error) => {
    showToast(error.message, 'error', 6000);
  });

document.querySelector('[data-backup-prepare]').addEventListener('click', async () => {
  try {
    packCache = await withOverlay(() => buildMigrationPack(), t('notice.loading'));
    renderSummary(packCache);
    renderStatus(t('backup.ready'));
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
});

document.querySelector('[data-backup-download]').addEventListener('click', async () => {
  try {
    if (!packCache) {
      packCache = await withOverlay(() => buildMigrationPack(), t('notice.loading'));
      renderSummary(packCache);
    }
    downloadMigrationPack(packCache);
    renderStatus(t('backup.exported'));
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
});

document.querySelector('[data-backup-drive]').addEventListener('click', async () => {
  try {
    if (!driveClientId()) {
      showToast(t('backup.needClient'), 'error', 6000);
      return;
    }
    if (!packCache) {
      packCache = await withOverlay(() => buildMigrationPack(), t('notice.loading'));
      renderSummary(packCache);
    }
    const token = await requestDriveToken();
    const uploaded = await withOverlay(() => uploadPackToDrive(packCache, token), t('notice.saving'));
    renderStatus(`${t('backup.uploaded')} ${uploaded.name || ''}`.trim());
    showToast(t('backup.uploaded'), 'success');
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
});

window.addEventListener('wlr-lang-changed', () => {
  refreshCopy();
  if (packCache) {
    renderSummary(packCache);
  }
});
