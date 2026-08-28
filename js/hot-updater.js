// ────────────────────────────────────────────────────────────
// WLR Live Hot-Patcher & Micro-Updater Engine
// ────────────────────────────────────────────────────────────

import { t } from './i18n.js';
import { showStatus } from './ui.js';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/cssiom-cloud/WLM/main/';
const GITHUB_API_COMMITS = 'https://api.github.com/repos/cssiom-cloud/WLM/commits/main';

export async function checkLiveHotPatch() {
  try {
    const currentVersion = window.desktopApp?.version || '1.0.6';
    const resp = await fetch(`${GITHUB_RAW_BASE}package.json?t=${Date.now()}`);
    if (!resp.ok) {
      throw new Error('Unable to connect to GitHub update server');
    }
    const pkg = await resp.json();
    const remoteVersion = pkg.version || currentVersion;
    const isNewer = compareSemVer(remoteVersion, currentVersion) > 0;

    return {
      patchAvailable: isNewer,
      currentVersion,
      latestVersion: remoteVersion,
      rawBase: GITHUB_RAW_BASE,
      downloadUrl: `https://github.com/cssiom-cloud/WLM/tree/main/release/v${remoteVersion}`
    };
  } catch (err) {
    return {
      patchAvailable: false,
      currentVersion: window.desktopApp?.version || '1.0.6',
      latestVersion: window.desktopApp?.version || '1.0.6',
      error: err.message
    };
  }
}

export async function applyLiveHotPatch(onProgress) {
  const criticalFiles = [
    'package.json',
    'index.html',
    'login.html',
    'settings.html',
    'announcements.html',
    'js/hot-updater.js',
    'js/updater.js',
    'js/device-auth.js',
    'js/settings.js',
    'js/i18n.js',
    'js/shell.js',
    'js/ui.js',
    'css/styles.css'
  ];

  const downloadedFiles = [];
  let totalBytes = 0;

  for (let i = 0; i < criticalFiles.length; i++) {
    const file = criticalFiles[i];
    try {
      if (onProgress) {
        onProgress({
          stage: 'downloading',
          current: i + 1,
          total: criticalFiles.length,
          fileName: file,
          totalBytes
        });
      }

      const res = await fetch(`${GITHUB_RAW_BASE}${file}?t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        totalBytes += text.length;
        downloadedFiles.push({ relativePath: file, content: text });
      }
    } catch (e) {
      console.warn(`Failed to patch file ${file}:`, e);
    }
  }

  // Apply to local filesystem via Desktop IPC
  if (window.desktopApp?.applyHotPatch) {
    if (onProgress) {
      onProgress({ stage: 'applying', current: criticalFiles.length, total: criticalFiles.length });
    }
    const result = await window.desktopApp.applyHotPatch(downloadedFiles);
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to write patch files');
    }
  }

  if (onProgress) {
    onProgress({ stage: 'success' });
  }

  return { success: true, count: downloadedFiles.length, totalBytes };
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
