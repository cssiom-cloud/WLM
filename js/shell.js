import { isLocalTestMode } from './config.js';
import { applyAccent, applyStoredAccent, initThemeToggle } from './theme.js';
import { initCommandNavbar } from './navigation.js';
import { initVisualEffects } from './effects.js';
import { readCurrentPersonnel } from './session.js';
import { fetchOwnSettings } from './command-services.js';
import { applyTranslations, getLang, t } from './i18n.js';
import { installCrestIcon, showStatus, upgradeCheckboxes, upgradeSelects } from './ui.js';
import { bindImageEditorHost } from './image-editor.js';
import { enterPage } from './motion.js';
import { isOpsExportHandoffActive, maybeRedirectForUiMode, writeUiMode } from './ui-mode.js';

export function bootCommandShell(activePage) {
  if (maybeRedirectForUiMode()) {
    return Promise.resolve();
  }
  document.body.dataset.page = activePage || 'auth';
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
  hydrateRemoteAccent();
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

async function hydrateRemoteAccent() {
  try {
    const { session, personnel } = await readCurrentPersonnel();
    if (!session || !personnel) {
      return;
    }
    const settings = await fetchOwnSettings(personnel.id);
    if (settings?.theme_accent) {
      applyAccent(settings.theme_accent);
    }
    if (settings?.ui_skin === 'jsx' && !isOpsExportHandoffActive()) {
      writeUiMode('jsx');
      maybeRedirectForUiMode();
    }
  } catch {
    return;
  }
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
