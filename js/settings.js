import { bootCommandShell, initAos } from './shell.js';
import {
  clearAuthRedirectParams,
  discordDisplay,
  findDiscordIdentity,
  linkDiscordIdentity,
  readAuthRedirectError,
  readAuthUser,
  readSession,
  readStoredActivePersonnelId,
  requireAuthenticatedPersonnel,
  setActivePersonnel,
  unlinkDiscordIdentity
} from './session.js';
import { readSessionVault, saveSessionToVault, deleteSessionFromVault } from './session-vault.js';
import { detectDeviceInfo, isPasskeySupported, getRegisteredPasskey, getSecondaryVerificationStatus, registerDevicePasskey, verifyDevicePasskey } from './device-auth.js';
import { formatPersonnelName } from './domain.js';
import { t } from './i18n.js';
import { confirmNotice, escapeHtml, initialsFromName, showStatus } from './ui.js';
import { applyAccent, readStoredAccent } from './theme.js';
import { fetchOwnSettings, saveOwnSettings, writeActivityLog } from './command-services.js';
import { applyUiMode, persistUiSkin, readUiMode } from './ui-mode.js';
import { applyPrefsToDom, mergeRemoteSettings, readLocalPrefs, resolvedUiScale, setPrefsOwner, writeLocalPrefs } from './user-prefs.js';
import { checkAppUpdate, openUpdateLink } from './updater.js';
import { applyLiveHotPatch } from './hot-updater.js';

let currentUser = null;
let currentAuthUser = null;
let ownedProfiles = [];

function discordMark() {
  return `<svg class="discord-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.07.07 0 0 0-.079.035c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.035A19.7 19.7 0 0 0 3.677 4.37a.08.08 0 0 0-.037.027C.533 9.047-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028 14 14 0 0 0 1.226-1.994.07.07 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.08.08 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.08.08 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.892.08.08 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;
}

function renderConnectedAccounts() {
  const host = document.querySelector('#connected-accounts');
  if (!host) {
    return;
  }
  const identity = findDiscordIdentity(currentAuthUser);
  const canUnlink = (currentAuthUser?.identities || []).length > 1;
  if (!identity) {
    host.innerHTML = `
      <div class="connected-account">
        ${discordMark()}
        <div class="connected-meta">
          <strong>${escapeHtml(t('settings.discord'))}</strong>
          <small>${escapeHtml(t('settings.discordNotLinked'))}</small>
        </div>
        <button class="btn btn-discord" id="discord-link" type="button">
          ${discordMark()}
          <span>${escapeHtml(t('settings.discordLink'))}</span>
        </button>
      </div>
    `;
    host.querySelector('#discord-link')?.addEventListener('click', onLinkDiscord);
    return;
  }

  const profile = discordDisplay(identity, currentAuthUser);
  const avatar = profile.avatar
    ? `<img class="connected-avatar" src="${escapeHtml(profile.avatar)}" alt="">`
    : `<span class="connected-avatar connected-avatar-fallback">${discordMark()}</span>`;
  host.innerHTML = `
    <div class="connected-account is-linked">
      ${avatar}
      <div class="connected-meta">
        <strong>${escapeHtml(profile.username)} <span class="badge-connected">${escapeHtml(t('settings.discordConnected'))}</span></strong>
        <small>${escapeHtml(t('settings.discord'))}</small>
      </div>
      <button class="btn" id="discord-unlink" type="button"${canUnlink ? '' : ' disabled'}>${escapeHtml(t('settings.discordUnlink'))}</button>
    </div>
  `;
  host.querySelector('#discord-unlink')?.addEventListener('click', onUnlinkDiscord);
}

function renderOwnedProfiles() {
  const host = document.querySelector('#owned-profiles');
  if (!host) {
    return;
  }
  const activeId = currentUser?.id || readStoredActivePersonnelId();
  if (!ownedProfiles.length) {
    host.innerHTML = `<p class="settings-lead">${escapeHtml(t('profiles.empty'))}</p>`;
    return;
  }
  host.innerHTML = ownedProfiles
    .map((row) => {
      const name = formatPersonnelName(row) || t('profiles.empty');
      const rank = row.military_rank || row.organization_role || '';
      const isActive = row.id === activeId;
      const avatar = row.avatar_url
        ? `<img class="connected-avatar" src="${escapeHtml(row.avatar_url)}" alt="">`
        : `<span class="connected-avatar connected-avatar-fallback">${escapeHtml(initialsFromName(name))}</span>`;
      return `
        <div class="connected-account${isActive ? ' is-linked' : ''}">
          ${avatar}
          <div class="connected-meta">
            <strong>${escapeHtml(name)}${isActive ? ` <span class="badge-connected">${escapeHtml(t('settings.activeProfile'))}</span>` : ''}</strong>
            <small>${escapeHtml(rank)}</small>
          </div>
          ${
            isActive
              ? ''
              : `<button class="btn" type="button" data-switch-profile="${escapeHtml(row.id)}">${escapeHtml(t('settings.switchProfile'))}</button>`
          }
        </div>
      `;
    })
    .join('');
  host.querySelectorAll('[data-switch-profile]').forEach((button) => {
    button.addEventListener('click', () => onSwitchProfile(button.getAttribute('data-switch-profile')));
  });
}

async function onSwitchProfile(personnelId) {
  try {
    await setActivePersonnel(personnelId);
    window.location.reload();
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function refreshAuthUser() {
  currentAuthUser = await readAuthUser();
  renderConnectedAccounts();
}

async function onLinkDiscord() {
  const button = document.querySelector('#discord-link');
  if (button?.disabled) {
    return;
  }
  if (button) {
    button.disabled = true;
  }
  try {
    await linkDiscordIdentity();
  } catch (error) {
    showStatus(error.message, true);
    if (button) {
      button.disabled = false;
    }
  }
}

async function onUnlinkDiscord() {
  if (!(await confirmNotice(t('settings.discordUnlinkConfirm')))) {
    return;
  }
  try {
    await unlinkDiscordIdentity();
    await refreshAuthUser();
    showStatus(t('settings.discordUnlinked'));
  } catch (error) {
    showStatus(error.message, true);
  }
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function drawColorWheel(canvas) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const inner = outer - 28;
  ctx.clearRect(0, 0, size, size);
  for (let angle = 0; angle < 360; angle += 1) {
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${angle} 100% 50%)`;
    ctx.lineWidth = outer - inner;
    ctx.arc(cx, cy, (outer + inner) / 2, ((angle - 90) * Math.PI) / 180, ((angle - 89) * Math.PI) / 180);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated') || '#fff';
  ctx.arc(cx, cy, inner - 8, 0, Math.PI * 2);
  ctx.fill();
}

function bindColorWheel(canvas, hexInput, preview, onPick) {
  drawColorWheel(canvas);
  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (event.clientX - rect.left) * scale - canvas.width / 2;
    const y = (event.clientY - rect.top) * scale - canvas.height / 2;
    const distance = Math.hypot(x, y);
    const outer = canvas.width / 2 - 6;
    const inner = outer - 28;
    if (distance < inner - 4 || distance > outer + 4) {
      return;
    }
    let hue = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (hue < 0) {
      hue += 360;
    }
    const hex = hslToHex(hue, 100, 50);
    hexInput.value = hex;
    preview.style.background = hex;
    onPick(hex);
  };

  let dragging = false;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
    pick(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragging) {
      pick(event);
    }
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
}

function syncUiModeButtons(mode) {
  const next = mode === 'jsx' ? 'jsx' : 'html';
  document.querySelectorAll('[data-ui-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-ui-mode') === next);
  });
}

function selectedUiMode() {
  return document.querySelector('[data-ui-mode].is-active')?.getAttribute('data-ui-mode') === 'jsx' ? 'jsx' : 'html';
}

function syncUiScaleButtons(pref) {
  const next = pref === 'auto' || ['1', '2', '3', '4', '5'].includes(pref) ? pref : 'auto';
  const resolved = resolvedUiScale(next);
  document.querySelectorAll('[data-ui-scale-pick]').forEach((button) => {
    const value = button.getAttribute('data-ui-scale-pick');
    button.classList.toggle('is-active', value === next);
    button.classList.toggle('is-preview', next === 'auto' && value === resolved);
  });
  const caption = document.querySelector('#ui-scale-caption');
  if (caption) {
    caption.textContent = t('settings.uiScaleNow').replace('{level}', resolved);
  }
}

async function persistUiScale(pref) {
  const next = pref === 'auto' || ['1', '2', '3', '4', '5'].includes(pref) ? pref : 'auto';
  syncUiScaleButtons(next);
  const prefs = applyPrefsToDom({ ...readLocalPrefs(currentUser?.id || ''), ui_scale: next });
  writeLocalPrefs(currentUser?.id || '', prefs);
  window.dispatchEvent(new CustomEvent('wlr-prefs-changed', { detail: { ui_scale: next } }));
}

bootCommandShell('settings');

const redirectError = readAuthRedirectError();
const oauthReturned = new URLSearchParams(window.location.search).has('code');
requireAuthenticatedPersonnel()
  .then(async (result) => {
    if (!result) {
      return;
    }
    currentUser = result.personnel;
    ownedProfiles = result.profiles || [];
    await refreshAuthUser();
    renderOwnedProfiles();
    renderVaultSessions();
    await initDeviceAndPasskeyUI();
    clearAuthRedirectParams();
    if (redirectError) {
      showStatus(redirectError, true);
    } else if (oauthReturned && findDiscordIdentity(currentAuthUser)) {
      showStatus(t('settings.discordLinked'));
    }
    const settings = await fetchOwnSettings(currentUser.id);
    setPrefsOwner(currentUser.id);
    const prefs = mergeRemoteSettings(settings, readLocalPrefs(currentUser.id));
    writeLocalPrefs(currentUser.id, prefs);
    applyPrefsToDom(prefs);
    const accent = prefs.theme_accent || readStoredAccent() || (document.documentElement.getAttribute('data-theme') === 'dark' ? '#8A90FF' : '#1E4E8C');
    document.querySelector('#bio-public').checked = settings.bio_public !== false;
    const uiMode = settings.ui_skin === 'jsx' || settings.ui_skin === 'html' ? settings.ui_skin : readUiMode() || 'html';
    syncUiModeButtons(uiMode);
    syncUiScaleButtons(prefs.ui_scale);
    document.querySelector('#accent-hex').value = accent;
    document.querySelector('#accent-preview').style.background = accent;
    if (settings.theme_accent) {
      applyAccent(settings.theme_accent);
    }
    bindColorWheel(
      document.querySelector('#color-wheel'),
      document.querySelector('#accent-hex'),
      document.querySelector('#accent-preview'),
      (hex) => applyAccent(hex)
    );
    initAos();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#add-theme').addEventListener('click', () => {
  document.querySelector('#theme-picker').hidden = !document.querySelector('#theme-picker').hidden;
});

document.querySelector('#accent-hex').addEventListener('input', (event) => {
  const hex = event.target.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    document.querySelector('#accent-preview').style.background = hex;
    applyAccent(hex);
  }
});

document.querySelector('#save-theme').addEventListener('click', async () => {
  if (!currentUser) {
    return;
  }
  const hex = document.querySelector('#accent-hex').value.trim();
  try {
    applyAccent(hex);
    await saveOwnSettings(currentUser.id, { theme_accent: hex });
    await writeActivityLog({
      userId: currentUser.id,
      roleSnapshot: currentUser.role,
      actionType: 'theme_update',
      details: `Updated theme accent to ${hex}`
    });
    showStatus('Theme saved.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelector('#bio-public').addEventListener('change', async (event) => {
  if (!currentUser) {
    return;
  }
  const bioPublic = event.target.checked;
  try {
    await saveOwnSettings(currentUser.id, { bio_public: bioPublic });
    await writeActivityLog({
      userId: currentUser.id,
      roleSnapshot: currentUser.role,
      actionType: 'privacy_update',
      details: bioPublic ? 'Biography set to public' : 'Biography set to private'
    });
    showStatus('Privacy setting saved.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelectorAll('[data-ui-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    syncUiModeButtons(button.getAttribute('data-ui-mode'));
  });
});

document.querySelector('#save-ui-mode').addEventListener('click', async () => {
  if (!currentUser) {
    return;
  }
  const mode = selectedUiMode();
  try {
    await persistUiSkin((payload) => saveOwnSettings(currentUser.id, payload), mode);
    const result = applyUiMode(mode);
    if (result.unavailable) {
      showStatus(t('settings.uiUnavailable'));
      return;
    }
    if (!result.navigated) {
      showStatus(t('settings.uiSaved'));
    }
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelectorAll('[data-ui-scale-pick]').forEach((button) => {
  button.addEventListener('click', () => {
    persistUiScale(button.getAttribute('data-ui-scale-pick'));
  });
});

// ── Secondary Verification & Session Vault ────────────────
let pendingDeleteSessionId = null;

async function initDeviceAndPasskeyUI() {
  const deviceInfo = detectDeviceInfo();
  const labelEl = document.querySelector('#current-device-label');
  const labelInput = document.querySelector('#vault-label-input');
  if (labelEl) labelEl.textContent = deviceInfo.defaultLabel;
  if (labelInput && !labelInput.value) {
    labelInput.value = deviceInfo.defaultLabel;
  }

  const passkeyBadge = document.querySelector('#passkey-status-badge');
  const registerBtn = document.querySelector('#register-passkey-btn');
  const passkeyDeleteOpt = document.querySelector('#passkey-delete-opt');

  const status = getSecondaryVerificationStatus();

  if (status.enabled) {
    if (passkeyBadge) {
      passkeyBadge.className = 'badge badge-green';
      passkeyBadge.textContent = t('settings.passkeyRegistered');
    }
    if (registerBtn) {
      registerBtn.className = 'btn';
      registerBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.25rem;"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zM9 7a3 3 0 0 1 6 0v3H9V7z"/></svg>
        <span>${escapeHtml(t('settings.passkeyRegistered'))}</span>
      `;
    }
    if (passkeyDeleteOpt) passkeyDeleteOpt.style.display = 'block';
  } else {
    if (passkeyBadge) {
      passkeyBadge.className = 'badge badge-blue';
      passkeyBadge.textContent = t('settings.passkeyTitle');
    }
    if (registerBtn) {
      registerBtn.className = 'btn btn-primary';
      registerBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.25rem;"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zM9 7a3 3 0 0 1 6 0v3H9V7z"/></svg>
        <span>${escapeHtml(t('settings.registerPasskey'))}</span>
      `;
    }
    if (passkeyDeleteOpt) passkeyDeleteOpt.style.display = 'block';
  }
}

// Open Setup 2FA Modal
document.querySelector('#register-passkey-btn')?.addEventListener('click', () => {
  const modal = document.querySelector('#setup-passkey-modal');
  const input = document.querySelector('#setup-pin-input');
  const err = document.querySelector('#setup-pin-error');
  if (input) input.value = '';
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  if (modal) modal.hidden = false;
  if (input) input.focus();
});

document.querySelector('#cancel-setup-pin-btn')?.addEventListener('click', () => {
  const modal = document.querySelector('#setup-passkey-modal');
  if (modal) modal.hidden = true;
});

document.querySelector('#setup-passkey-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    const modal = document.querySelector('#setup-passkey-modal');
    if (modal) modal.hidden = true;
  }
});

document.querySelector('#confirm-setup-pin-btn')?.addEventListener('click', async () => {
  const input = document.querySelector('#setup-pin-input');
  const err = document.querySelector('#setup-pin-error');
  const pin = input?.value?.trim() || '';

  if (!pin || pin.length < 4) {
    if (err) {
      err.textContent = t('settings.sessionPasswordPlaceholder');
      err.style.display = 'block';
    }
    return;
  }

  try {
    const user = currentUser?.callsign || currentUser?.first_name || 'Personnel';
    await registerDevicePasskey(user, `${user} (${detectDeviceInfo().defaultLabel})`, pin);
    const modal = document.querySelector('#setup-passkey-modal');
    if (modal) modal.hidden = true;
    await initDeviceAndPasskeyUI();
    showStatus(t('settings.passkeyRegisteredOk'));
  } catch (error) {
    if (err) {
      err.textContent = error.message;
      err.style.display = 'block';
    }
  }
});

function renderVaultSessions() {
  const host = document.querySelector('#vault-sessions-list');
  if (!host) return;

  const sessions = readSessionVault();
  if (!sessions.length) {
    host.innerHTML = `<p class="settings-lead" style="margin:0;">${escapeHtml(t('settings.noSavedSessions'))}</p>`;
    return;
  }

  host.innerHTML = sessions.map((item) => {
    const d = new Date(item.saved_at);
    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const devInfo = item.device_info || {};
    const devOs = devInfo.os || 'Device';
    const isPasskey = item.auth_method === 'passkey';
    return `
      <div class="connected-account" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-elevated);">
        <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;">
          <div style="width:38px;height:38px;border-radius:10px;background:var(--accent-soft);display:grid;place-items:center;flex-shrink:0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
              <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.95rem;">${escapeHtml(item.label)}</strong>
              <span class="badge ${isPasskey ? 'badge-green' : 'badge-blue'}" style="font-size:0.7rem;">${isPasskey ? 'Passkey' : 'PIN Protected'}</span>
            </div>
            <small style="color:var(--text-muted);display:block;font-size:0.8rem;">${escapeHtml(devOs)} • ${escapeHtml(item.personnel_name || item.user_email || 'Session')} • ${escapeHtml(dateStr)}</small>
          </div>
        </div>
        <button class="btn btn-danger" type="button" data-delete-vault-id="${escapeHtml(item.id)}" style="flex-shrink:0;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.25rem;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ${escapeHtml(t('settings.deleteSession'))}
        </button>
      </div>
    `;
  }).join('');

  host.querySelectorAll('[data-delete-vault-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openDeleteSessionModal(btn.getAttribute('data-delete-vault-id'));
    });
  });
}

function openDeleteSessionModal(sessionId) {
  pendingDeleteSessionId = sessionId;
  const modal = document.querySelector('#delete-session-modal');
  const input = document.querySelector('#delete-password-input');
  const err = document.querySelector('#delete-modal-error');
  if (input) input.value = '';
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  if (modal) modal.hidden = false;
  if (input) input.focus();
}

function closeDeleteSessionModal() {
  pendingDeleteSessionId = null;
  const modal = document.querySelector('#delete-session-modal');
  if (modal) modal.hidden = true;
}

document.querySelector('#cancel-delete-session-btn')?.addEventListener('click', closeDeleteSessionModal);
document.querySelector('#delete-session-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDeleteSessionModal();
});

// Verify with Passkey / Windows Hello button
document.querySelector('#verify-passkey-delete-btn')?.addEventListener('click', async () => {
  if (!pendingDeleteSessionId) return;
  const err = document.querySelector('#delete-modal-error');
  try {
    await deleteSessionFromVault(pendingDeleteSessionId, { usePasskey: true });
    closeDeleteSessionModal();
    renderVaultSessions();
    showStatus(t('settings.sessionDeletedOk'));
  } catch (error) {
    if (err) {
      err.textContent = t('settings.passkeyFailed');
      err.style.display = 'block';
    }
  }
});

// Verify with PIN / Password button
document.querySelector('#confirm-delete-session-btn')?.addEventListener('click', async () => {
  if (!pendingDeleteSessionId) return;
  const input = document.querySelector('#delete-password-input');
  const err = document.querySelector('#delete-modal-error');
  const password = input?.value || '';

  if (!password) {
    if (err) {
      err.textContent = t('settings.pinRequired');
      err.style.display = 'block';
    }
    return;
  }

  try {
    await deleteSessionFromVault(pendingDeleteSessionId, { password });
    closeDeleteSessionModal();
    renderVaultSessions();
    showStatus(t('settings.sessionDeletedOk'));
  } catch (error) {
    if (err) {
      err.textContent = error.message === 'INVALID_PASSWORD'
        ? t('settings.sessionInvalidPass')
        : error.message;
      err.style.display = 'block';
    }
  }
});

document.querySelector('#save-vault-btn')?.addEventListener('click', async () => {
  const labelInput = document.querySelector('#vault-label-input');
  const passInput = document.querySelector('#vault-password-input');
  const label = labelInput?.value?.trim() || '';
  const pass = passInput?.value || '';

  if (!pass) {
    showStatus(t('settings.sessionFillRequired'), true);
    return;
  }

  try {
    const rawSession = await readSession();
    const registeredPasskey = getRegisteredPasskey();
    await saveSessionToVault({
      label,
      password: pass,
      authMethod: registeredPasskey ? 'passkey' : 'pin',
      session: rawSession,
      activePersonnel: currentUser
    });
    if (passInput) passInput.value = '';
    renderVaultSessions();
    showStatus(t('settings.sessionSavedOk'));
  } catch (error) {
    showStatus(error.message, true);
  }
});

// ── Live Self-Updater Handler ──────────────────────────────
let latestUpdateInfo = null;

const checkUpdatesBtn = document.querySelector('#check-updates-btn');
const updateModal = document.querySelector('#update-available-modal');
const updateCurrentVer = document.querySelector('#update-current-ver');
const updateLatestVer = document.querySelector('#update-latest-ver');
const downloadSetupBtn = document.querySelector('#download-setup-btn');
const downloadPortableBtn = document.querySelector('#download-portable-btn');
const viewGithubBtn = document.querySelector('#view-github-btn');
const closeUpdateModalBtn = document.querySelector('#close-update-modal-btn');

checkUpdatesBtn?.addEventListener('click', async () => {
  const originalHtml = checkUpdatesBtn.innerHTML;
  checkUpdatesBtn.disabled = true;
  checkUpdatesBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin" style="margin-right:0.35rem;animation:spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
    <span>${escapeHtml(t('settings.checkingUpdates'))}</span>
  `;

  try {
    const res = await checkAppUpdate();
    latestUpdateInfo = res;

    if (res?.updateAvailable) {
      if (updateCurrentVer) updateCurrentVer.textContent = `v${res.currentVersion}`;
      if (updateLatestVer) updateLatestVer.textContent = `v${res.latestVersion}`;
      if (updateModal) updateModal.hidden = false;
    } else if (res?.error) {
      showStatus(t('settings.updateError'), true);
    } else {
      showStatus(t('settings.updateStatusUpToDate'));
    }
  } catch (err) {
    showStatus(t('settings.updateError'), true);
  } finally {
    checkUpdatesBtn.disabled = false;
    checkUpdatesBtn.innerHTML = originalHtml;
  }
});

const applyHotpatchBtn = document.querySelector('#apply-hotpatch-btn');
const hotpatchProgressBox = document.querySelector('#hotpatch-progress-box');
const hotpatchStatusText = document.querySelector('#hotpatch-status-text');
const hotpatchPctText = document.querySelector('#hotpatch-pct-text');
const hotpatchProgressFill = document.querySelector('#hotpatch-progress-fill');

applyHotpatchBtn?.addEventListener('click', async () => {
  if (!applyHotpatchBtn) return;
  applyHotpatchBtn.disabled = true;
  if (hotpatchProgressBox) hotpatchProgressBox.style.display = 'block';

  try {
    await applyLiveHotPatch((p) => {
      if (p.stage === 'downloading') {
        const pct = Math.round((p.current / p.total) * 100);
        if (hotpatchStatusText) hotpatchStatusText.textContent = `Downloading ${p.fileName}...`;
        if (hotpatchPctText) hotpatchPctText.textContent = `${pct}%`;
        if (hotpatchProgressFill) hotpatchProgressFill.style.width = `${pct}%`;
      } else if (p.stage === 'applying') {
        if (hotpatchStatusText) hotpatchStatusText.textContent = t('hotUpdate.applying');
      } else if (p.stage === 'success') {
        if (hotpatchStatusText) hotpatchStatusText.textContent = t('hotUpdate.success');
        if (hotpatchPctText) hotpatchPctText.textContent = '100%';
        if (hotpatchProgressFill) hotpatchProgressFill.style.width = '100%';
      }
    });

    showStatus(t('hotUpdate.success'));
    setTimeout(() => {
      window.location.reload();
    }, 1800);
  } catch (err) {
    showStatus(err.message, true);
    applyHotpatchBtn.disabled = false;
  }
});

downloadSetupBtn?.addEventListener('click', () => {
  if (latestUpdateInfo?.setupExeUrl) {
    openUpdateLink(latestUpdateInfo.setupExeUrl);
  } else if (latestUpdateInfo?.downloadUrl) {
    openUpdateLink(latestUpdateInfo.downloadUrl);
  }
});

downloadPortableBtn?.addEventListener('click', () => {
  if (latestUpdateInfo?.portableExeUrl) {
    openUpdateLink(latestUpdateInfo.portableExeUrl);
  } else if (latestUpdateInfo?.downloadUrl) {
    openUpdateLink(latestUpdateInfo.downloadUrl);
  }
});

viewGithubBtn?.addEventListener('click', () => {
  if (latestUpdateInfo?.downloadUrl || latestUpdateInfo?.repoUrl) {
    openUpdateLink(latestUpdateInfo.downloadUrl || latestUpdateInfo.repoUrl);
  }
});

closeUpdateModalBtn?.addEventListener('click', () => {
  if (updateModal) updateModal.hidden = true;
});

updateModal?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    if (updateModal) updateModal.hidden = true;
  }
});

window.addEventListener('resize', () => {
  if (readLocalPrefs(currentUser?.id || '').ui_scale === 'auto') {
    syncUiScaleButtons('auto');
  }
});

window.addEventListener('wlr-lang-changed', () => {
  renderConnectedAccounts();
  renderOwnedProfiles();
  renderVaultSessions();
  syncUiScaleButtons(readLocalPrefs(currentUser?.id || '').ui_scale);
});
