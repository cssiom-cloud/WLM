import { isLocalTestMode, WLR_COMMAND_CONFIG } from './config.js';
import { fetchPersonnelRoster } from './personnel-service.js';
import { fetchAnnouncementBoard } from './announcement-service.js';
import { fetchDocuments, fetchLoreEntries } from './content-service.js';
import { fetchUnitBoard } from './unit-service.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function driveClientId() {
  return String(WLR_COMMAND_CONFIG.googleDriveClientId || '').trim();
}

function collectImageRefs(pack) {
  const images = [];
  pack.personnel.forEach((row) => {
    if (row.avatar_url) {
      images.push({ kind: 'avatar', id: row.id, url: row.avatar_url });
    }
    if (row.cover_url) {
      images.push({ kind: 'cover', id: row.id, url: row.cover_url });
    }
  });
  pack.announcements.forEach((row) => {
    if (row.image_url) {
      images.push({ kind: 'announcement', id: row.id, url: row.image_url });
    }
  });
  pack.units.forEach((row) => {
    if (row.logo_url) {
      images.push({ kind: 'unit-logo', id: row.id, url: row.logo_url });
    }
  });
  return images;
}

export async function buildMigrationPack() {
  const [personnel, announcements, lore, documents, board] = await Promise.all([
    fetchPersonnelRoster(),
    fetchAnnouncementBoard(null),
    fetchLoreEntries().catch(() => []),
    fetchDocuments().catch(() => []),
    fetchUnitBoard().catch(() => ({ units: [], ranks: [] }))
  ]);
  const pack = {
    exported_at: new Date().toISOString(),
    source: 'wlr-command',
    local_test: isLocalTestMode(),
    personnel,
    announcements: announcements.map(({ signed_count, is_signed, ...row }) => row),
    lore,
    documents,
    units: board.units || [],
    unit_ranks: board.ranks || []
  };
  pack.images = collectImageRefs(pack);
  return pack;
}

export function packFilename() {
  return `wlr-command-export-${new Date().toISOString().slice(0, 10)}.json`;
}

export function packToBlob(pack) {
  return new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
}

export function downloadMigrationPack(pack) {
  const blob = packToBlob(pack);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = packFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadGis() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Identity script failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity script failed to load.'));
    document.head.appendChild(script);
  });
}

export function requestDriveToken() {
  const clientId = driveClientId();
  if (!clientId) {
    throw new Error('Add googleDriveClientId in js/config.js to connect Google Drive.');
  }
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            resolve(response.access_token);
          }
        });
        client.requestAccessToken({ prompt: 'consent' });
      })
  );
}

export async function uploadPackToDrive(pack, accessToken) {
  const metadata = {
    name: packFilename(),
    mimeType: 'application/json'
  };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', packToBlob(pack));
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Google Drive upload failed.');
  }
  return payload;
}
