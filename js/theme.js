import { applyAccentCss, applyPrefsToDom, getPrefsOwner, readLocalPrefs, writeLocalPrefs } from './user-prefs.js';

function sunIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0-5h1v3h-2V2h1zm0 17h1v3h-2v-3h1zM2 11h3v2H2v-2zm17 0h3v2h-3v-2zM4.2 4.2l2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4zm12.9 12.9 2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4zM4.2 19.8l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zm12.9-12.9 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1z"/>
    </svg>
  `;
}

function moonIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.1 2a8.8 8.8 0 0 0 9.9 12.7A8.9 8.9 0 1 1 12.1 2z"/>
    </svg>
  `;
}

export function applyStoredTheme() {
  const prefs = applyPrefsToDom(readLocalPrefs(getPrefsOwner()));
  return prefs.color_theme;
}

export function applyAccent(hex) {
  const value = applyAccentCss(hex);
  writeLocalPrefs(getPrefsOwner(), { theme_accent: value });
  return value;
}

export function applyStoredAccent() {
  const stored = readLocalPrefs(getPrefsOwner()).theme_accent;
  if (stored) {
    applyAccentCss(stored);
  }
}

export function readStoredAccent() {
  return readLocalPrefs(getPrefsOwner()).theme_accent || '';
}

export function initThemeToggle() {
  const current = applyStoredTheme();
  if (document.querySelector('.theme-toggle')) {
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  button.setAttribute('aria-label', 'Toggle theme');
  button.innerHTML = current === 'dark' ? sunIcon() : moonIcon();

  button.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    writeLocalPrefs(getPrefsOwner(), { color_theme: next });
    applyPrefsToDom(readLocalPrefs(getPrefsOwner()));
    button.innerHTML = next === 'dark' ? sunIcon() : moonIcon();
    window.dispatchEvent(new CustomEvent('wlr-prefs-changed', { detail: { color_theme: next } }));
  });

  document.body.appendChild(button);
}
