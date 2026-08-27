// ────────────────────────────────────────────────────────────
// In-App Self-Updater Engine & Version Checker
// ────────────────────────────────────────────────────────────

import { t } from './i18n.js';
import { showStatus } from './ui.js';

export async function checkAppUpdate() {
  if (window.desktopApp?.checkSystemUpdates) {
    try {
      const res = await window.desktopApp.checkSystemUpdates();
      return res;
    } catch (err) {
      console.warn('Desktop update check failed:', err);
    }
  }

  // Web Browser fallback
  try {
    const currentVersion = '1.0.5';
    const resp = await fetch('https://raw.githubusercontent.com/cssiom-cloud/WLM/main/package.json?t=' + Date.now());
    if (!resp.ok) {
      throw new Error('Failed to fetch remote repository data');
    }
    const pkg = await resp.json();
    const remoteVersion = pkg.version || currentVersion;
    const isNewer = compareSemVer(remoteVersion, currentVersion) > 0;

    return {
      updateAvailable: isNewer,
      currentVersion,
      latestVersion: remoteVersion,
      downloadUrl: `https://github.com/cssiom-cloud/WLM/tree/main/release/v${remoteVersion}`,
      setupExeUrl: `https://github.com/cssiom-cloud/WLM/raw/main/release/v${remoteVersion}/WLR%20Command%20Portal%20Setup%20${remoteVersion}.exe`,
      portableExeUrl: `https://github.com/cssiom-cloud/WLM/raw/main/release/v${remoteVersion}/WLR%20Command%20Portal-v${remoteVersion}-Portable.exe`,
      repoUrl: 'https://github.com/cssiom-cloud/WLM'
    };
  } catch (err) {
    return {
      updateAvailable: false,
      currentVersion: '1.0.5',
      latestVersion: '1.0.5',
      error: err.message
    };
  }
}

export function openUpdateLink(url) {
  if (!url) return;
  if (window.desktopApp?.openExternalUrl) {
    window.desktopApp.openExternalUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function compareSemVer(v1, v2) {
  const parts1 = String(v1).replace(/^v/, '').split('.').map(Number);
  const parts2 = String(v2).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
