const THEME_STORAGE_KEY = 'wlr-command-theme';
const ACCENT_STORAGE_KEY = 'wlr-command-accent';

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
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  const theme = stored === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  applyStoredAccent();
  return theme;
}

export function applyAccent(hex) {
  const value = String(hex || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-hover');
    window.localStorage.removeItem(ACCENT_STORAGE_KEY);
    return;
  }
  document.documentElement.style.setProperty('--accent', value);
  document.documentElement.style.setProperty('--accent-hover', value);
  window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
}

export function applyStoredAccent() {
  const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  if (stored) {
    applyAccent(stored);
  }
}

export function readStoredAccent() {
  return window.localStorage.getItem(ACCENT_STORAGE_KEY) || '';
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
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    button.innerHTML = next === 'dark' ? sunIcon() : moonIcon();
  });

  document.body.appendChild(button);
}
