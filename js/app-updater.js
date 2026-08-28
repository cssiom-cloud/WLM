// ────────────────────────────────────────────────────────────
// WLR Supabase-Powered Custom Auto-Updater & Security Engine
// ────────────────────────────────────────────────────────────

import { t } from './i18n.js';
import { applyLiveHotPatch } from './hot-updater.js';
import { openUpdateLink } from './updater.js';

export function getCurrentAppVersion() {
  if (typeof window !== 'undefined' && window.desktopApp?.version) {
    return window.desktopApp.version;
  }
  return '1.0.7';
}

export function compareSemVer(v1, v2) {
  const parts1 = String(v1 || '').replace(/^v/, '').split('.').map(Number);
  const parts2 = String(v2 || '').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function fetchLatestSupabaseVersion(client) {
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('app_versions')
      .select('*')
      .eq('is_active', true)
      .order('release_date', { ascending: false });

    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Sort by semver descending to pick the absolute highest version
    const sorted = [...data].sort((a, b) => compareSemVer(b.version, a.version));
    return sorted[0];
  } catch (err) {
    console.warn('Failed to query Supabase app_versions:', err);
    return null;
  }
}

export async function checkStartupUpdate(client, options = {}) {
  const currentVersion = getCurrentAppVersion();
  const latestRecord = await fetchLatestSupabaseVersion(client);

  if (!latestRecord || !latestRecord.version) {
    return { updateAvailable: false, currentVersion };
  }

  const isNewer = compareSemVer(latestRecord.version, currentVersion) > 0;
  if (!isNewer) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: latestRecord.version
    };
  }

  const dismissedKey = `wlr_dismissed_update_${latestRecord.version}`;
  const isDismissed = sessionStorage.getItem(dismissedKey) === 'true';

  // If dismissed and not critical, do not disturb startup
  if (isDismissed && !latestRecord.is_critical && !options.force) {
    return {
      updateAvailable: true,
      dismissed: true,
      currentVersion,
      latestVersion: latestRecord.version,
      record: latestRecord
    };
  }

  return {
    updateAvailable: true,
    dismissed: false,
    currentVersion,
    latestVersion: latestRecord.version,
    downloadUrl: latestRecord.download_url,
    portableUrl: latestRecord.portable_url,
    releaseNotes: latestRecord.release_notes || '',
    isCritical: Boolean(latestRecord.is_critical),
    releaseDate: latestRecord.release_date,
    record: latestRecord
  };
}

// ── Startup Modal UI for HTML Pages ─────────────────────────
export function showStartupUpdateModal(updateInfo) {
  if (!updateInfo || !updateInfo.updateAvailable || updateInfo.dismissed) return;
  if (document.getElementById('wlr-startup-update-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'wlr-startup-update-modal';
  modal.className = 'wlr-notice';
  modal.style.zIndex = '9999';

  const notesHtml = updateInfo.releaseNotes
    ? `<div style="max-height:120px;overflow-y:auto;padding:0.75rem;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.3);font-size:0.82rem;line-height:1.5;color:var(--text-muted);margin-bottom:1rem;white-space:pre-line;">${escapeHtml(updateInfo.releaseNotes)}</div>`
    : '';

  const criticalBadge = updateInfo.isCritical
    ? `<span style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.25rem 0.6rem;background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.4);border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;margin-bottom:0.75rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${t('update.criticalRequired') || 'Critical Update Required'}</span>`
    : '';

  modal.innerHTML = `
    <div class="wlr-notice-card" style="max-width:500px;text-align:left;animation:fadeInScale 0.4s ease;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
        <div style="width:46px;height:46px;border-radius:12px;background:var(--accent-soft);display:grid;place-items:center;flex-shrink:0;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </div>
        <div>
          <strong style="font-size:1.1rem;display:block;">${t('settings.updateAvailableTitle')}</strong>
          <small style="color:var(--text-muted);font-size:0.78rem;">Supabase Cloud Registry • Verified Official Release</small>
        </div>
      </div>

      ${criticalBadge}

      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:10px;background:var(--bg-muted);margin-bottom:1rem;">
        <div>
          <small style="color:var(--text-muted);display:block;font-size:0.72rem;text-transform:uppercase;">Current</small>
          <strong style="font-size:0.9rem;">v${updateInfo.currentVersion}</strong>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        <div>
          <small style="color:var(--text-muted);display:block;font-size:0.72rem;text-transform:uppercase;">New Version</small>
          <strong style="font-size:0.95rem;color:var(--accent);">v${updateInfo.latestVersion}</strong>
        </div>
      </div>

      ${notesHtml}

      <div style="display:grid;gap:0.5rem;margin-bottom:1rem;">
        <button id="startup-hotpatch-btn" class="btn btn-primary" type="button" style="width:100%;justify-content:center;background:linear-gradient(135deg,#10b981 0%,#059669 100%);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.35rem;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>${t('hotUpdate.btn')}</span>
        </button>
        <div id="startup-hotpatch-progress" style="display:none;padding:0.65rem 0.85rem;border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.3);">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.35rem;">
            <span id="startup-hotpatch-status">Downloading...</span>
            <span id="startup-hotpatch-pct">0%</span>
          </div>
          <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:10px;overflow:hidden;">
            <div id="startup-hotpatch-fill" style="width:0%;height:100%;background:var(--accent);transition:width 0.2s;"></div>
          </div>
        </div>
        <button id="startup-download-setup-btn" class="btn" type="button" style="width:100%;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.35rem;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>${t('settings.downloadSetup')}</span>
        </button>
      </div>

      <div class="btn-row" style="justify-content:flex-end;">
        ${
          !updateInfo.isCritical
            ? `<button id="startup-dismiss-btn" class="btn" type="button">${t('update.remindLater') || 'Remind Me Later'}</button>`
            : ''
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const hotpatchBtn = document.getElementById('startup-hotpatch-btn');
  const progressBox = document.getElementById('startup-hotpatch-progress');
  const statusLabel = document.getElementById('startup-hotpatch-status');
  const pctLabel = document.getElementById('startup-hotpatch-pct');
  const fillBar = document.getElementById('startup-hotpatch-fill');
  const downloadBtn = document.getElementById('startup-download-setup-btn');
  const dismissBtn = document.getElementById('startup-dismiss-btn');

  hotpatchBtn?.addEventListener('click', async () => {
    hotpatchBtn.disabled = true;
    if (progressBox) progressBox.style.display = 'block';

    try {
      await applyLiveHotPatch((p) => {
        if (p.stage === 'downloading') {
          const pct = Math.round((p.current / p.total) * 100);
          if (statusLabel) statusLabel.textContent = `Downloading ${p.fileName}...`;
          if (pctLabel) pctLabel.textContent = `${pct}%`;
          if (fillBar) fillBar.style.width = `${pct}%`;
        } else if (p.stage === 'applying') {
          if (statusLabel) statusLabel.textContent = t('hotUpdate.applying');
        } else if (p.stage === 'success') {
          if (statusLabel) statusLabel.textContent = t('hotUpdate.success');
          if (pctLabel) pctLabel.textContent = '100%';
          if (fillBar) fillBar.style.width = '100%';
        }
      });
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err) {
      if (statusLabel) statusLabel.textContent = err.message;
      hotpatchBtn.disabled = false;
    }
  });

  downloadBtn?.addEventListener('click', () => {
    if (updateInfo.downloadUrl) {
      openUpdateLink(updateInfo.downloadUrl);
    }
  });

  dismissBtn?.addEventListener('click', () => {
    sessionStorage.setItem(`wlr_dismissed_update_${updateInfo.latestVersion}`, 'true');
    modal.remove();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
