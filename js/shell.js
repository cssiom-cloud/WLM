import { isLocalTestMode } from './config.js';
import { applyStoredAccent, initThemeToggle } from './theme.js';
import { initCommandNavbar } from './navigation.js';
import { initVisualEffects } from './effects.js';
import { readCurrentPersonnel } from './session.js';
import { fetchOwnSettings, saveOwnSettings } from './command-services.js';
import { applyTranslations, getLang, t } from './i18n.js';
import { installCrestIcon, showStatus, upgradeCheckboxes, upgradeSelects } from './ui.js';
import { bindImageEditorHost } from './image-editor.js';
import { enterPage } from './motion.js';
import { isDossierExportHandoffActive, isOpsExportHandoffActive, maybeRedirectForUiMode, writeUiMode } from './ui-mode.js';
import {
  applyPrefsToDom,
  mergeRemoteSettings,
  readLocalPrefs,
  savePrefsOrOmitScale,
  setPrefsOwner,
  writeLocalPrefs
} from './user-prefs.js';

export function bootCommandShell(activePage) {
  if (maybeRedirectForUiMode()) {
    return Promise.resolve();
  }
  document.body.dataset.page = activePage || 'auth';
  applyPrefsToDom(readLocalPrefs());
  document.documentElement.lang = getLang();
  applyTranslations();
  installCrestIcon();
  bindImageEditorHost();
  initThemeToggle();
  applyStoredAccent();
  initVisualEffects();
  if (isLocalTestMode()) {
    document.body.classList.add('is-local-test');
    if (!document.querySelector('.local-test-banner')) {
      const banner = document.createElement('div');
      banner.className = 'local-test-banner';
      banner.textContent = 'Local test mode. Data stays in this browser until you connect Supabase.';
      document.body.appendChild(banner);
    }
  }
  hydrateRemotePrefs();
  bindPrefsPersistence();
  enterPage(document.querySelector('.page-content'));
  const ready = Promise.resolve(initCommandNavbar(activePage)).finally(() => {
    upgradeSelects();
    upgradeCheckboxes();
  });
  if (!window.__wlrNetworkBound) {
    window.__wlrNetworkBound = true;
    window.addEventListener('offline', () => showStatus(t('notice.offline'), true));
  }
  return ready;
}

async function hydrateRemotePrefs() {
  try {
    const { session, personnel } = await readCurrentPersonnel();
    if (!session || !personnel) {
      return;
    }
    setPrefsOwner(personnel.id);
    const settings = await fetchOwnSettings(personnel.id);
    const prefs = mergeRemoteSettings(settings, readLocalPrefs(personnel.id));
    writeLocalPrefs(personnel.id, prefs);
    applyPrefsToDom(prefs);
    applyTranslations();
    if (!settings?.prefs_synced) {
      savePrefsOrOmitScale((payload) => saveOwnSettings(personnel.id, payload), prefs).catch(() => {});
    }
    if (prefs.ui_skin === 'jsx' && !isOpsExportHandoffActive() && !isDossierExportHandoffActive()) {
      writeUiMode('jsx');
      maybeRedirectForUiMode();
    } else {
      writeUiMode(prefs.ui_skin);
    }
  } catch {
    return;
  }
}

async function persistCurrentPrefs(patch = {}) {
  try {
    const { personnel } = await readCurrentPersonnel();
    if (!personnel) {
      return;
    }
    setPrefsOwner(personnel.id);
    const prefs = writeLocalPrefs(personnel.id, patch);
    applyPrefsToDom(prefs);
    await savePrefsOrOmitScale((payload) => saveOwnSettings(personnel.id, payload), prefs);
  } catch {
    return;
  }
}

function bindPrefsPersistence() {
  if (window.__wlrPrefsBound) {
    return;
  }
  window.__wlrPrefsBound = true;
  window.addEventListener('wlr-lang-changed', (event) => {
    persistCurrentPrefs({ locale: event.detail?.lang === 'th' ? 'th' : 'en' });
  });
  window.addEventListener('wlr-prefs-changed', (event) => {
    persistCurrentPrefs(event.detail || {});
  });
}

export function initAos() {
  if (window.AOS) {
    window.AOS.init({
      duration: 650,
      once: true,
      offset: 40
    });
  }
}
