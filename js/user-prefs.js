const OWNER_KEY = 'wlr-prefs-owner';
const PREFS_PREFIX = 'wlr-prefs:';
const LEGACY = {
  lang: 'wlr-command-lang',
  theme: 'wlr-command-theme',
  accent: 'wlr-command-accent',
  rain: 'wlr-command-rain',
  glass: 'wlr-command-glass',
  glassMotion: 'wlr-command-glass-motion',
  ui: 'wlr-command-ui'
};

export const DEFAULT_PREFS = {
  locale: 'en',
  color_theme: 'light',
  rain: true,
  glass_visible: true,
  glass_motion: true,
  theme_accent: '',
  ui_skin: 'html'
};

export function getPrefsOwner() {
  return window.localStorage.getItem(OWNER_KEY) || '';
}

export function setPrefsOwner(userId) {
  const id = String(userId || '').trim();
  if (id) {
    window.localStorage.setItem(OWNER_KEY, id);
    return id;
  }
  window.localStorage.removeItem(OWNER_KEY);
  return '';
}

function prefsKey(userId) {
  return `${PREFS_PREFIX}${userId || 'guest'}`;
}

function fromLegacy() {
  return {
    ...DEFAULT_PREFS,
    locale: window.localStorage.getItem(LEGACY.lang) === 'th' ? 'th' : 'en',
    color_theme: window.localStorage.getItem(LEGACY.theme) === 'dark' ? 'dark' : 'light',
    rain: window.localStorage.getItem(LEGACY.rain) !== 'off',
    glass_visible: window.localStorage.getItem(LEGACY.glass) !== 'off',
    glass_motion: window.localStorage.getItem(LEGACY.glassMotion) !== 'off',
    theme_accent: window.localStorage.getItem(LEGACY.accent) || '',
    ui_skin: window.localStorage.getItem(LEGACY.ui) === 'jsx' ? 'jsx' : 'html'
  };
}

export function normalizePrefs(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const accent = String(source.theme_accent || '').trim();
  return {
    locale: source.locale === 'th' ? 'th' : 'en',
    color_theme: source.color_theme === 'dark' ? 'dark' : 'light',
    rain: source.rain !== false,
    glass_visible: source.glass_visible !== false,
    glass_motion: source.glass_motion !== false,
    theme_accent: /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : '',
    ui_skin: source.ui_skin === 'jsx' ? 'jsx' : 'html'
  };
}

export function prefsFromSettingsRow(row, fallback = {}) {
  const base = normalizePrefs({ ...DEFAULT_PREFS, ...fallback });
  if (!row || typeof row !== 'object') {
    return base;
  }
  return normalizePrefs({
    ...base,
    locale: row.locale || base.locale,
    color_theme: row.color_theme || base.color_theme,
    rain: typeof row.rain === 'boolean' ? row.rain : base.rain,
    glass_visible: typeof row.glass_visible === 'boolean' ? row.glass_visible : base.glass_visible,
    glass_motion: typeof row.glass_motion === 'boolean' ? row.glass_motion : base.glass_motion,
    theme_accent: row.theme_accent || base.theme_accent,
    ui_skin: row.ui_skin || base.ui_skin
  });
}

export function prefsToSettingsPayload(prefs, extra = {}) {
  const next = normalizePrefs(prefs);
  return {
    locale: next.locale,
    color_theme: next.color_theme,
    rain: next.rain,
    glass_visible: next.glass_visible,
    glass_motion: next.glass_motion,
    theme_accent: next.theme_accent || null,
    ui_skin: next.ui_skin,
    prefs_synced: true,
    ...extra
  };
}

export function readLocalPrefs(userId = getPrefsOwner()) {
  try {
    const raw = window.localStorage.getItem(prefsKey(userId));
    if (raw) {
      return normalizePrefs(JSON.parse(raw));
    }
  } catch {
    /* ignore broken cache */
  }
  return fromLegacy();
}

export function writeLocalPrefs(userId, patch = {}) {
  const owner = userId || getPrefsOwner();
  const next = normalizePrefs({ ...readLocalPrefs(owner), ...patch });
  window.localStorage.setItem(prefsKey(owner), JSON.stringify(next));
  if (owner) {
    setPrefsOwner(owner);
  }
  window.localStorage.setItem(LEGACY.lang, next.locale);
  window.localStorage.setItem(LEGACY.theme, next.color_theme);
  window.localStorage.setItem(LEGACY.rain, next.rain ? 'on' : 'off');
  window.localStorage.setItem(LEGACY.glass, next.glass_visible ? 'on' : 'off');
  window.localStorage.setItem(LEGACY.glassMotion, next.glass_motion ? 'on' : 'off');
  window.localStorage.setItem(LEGACY.ui, next.ui_skin);
  if (next.theme_accent) {
    window.localStorage.setItem(LEGACY.accent, next.theme_accent);
  } else {
    window.localStorage.removeItem(LEGACY.accent);
  }
  return next;
}

export function applyAccentCss(hex) {
  const value = String(hex || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-ink');
    return '';
  }
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  document.documentElement.style.setProperty('--accent', value);
  document.documentElement.style.setProperty('--accent-ink', luma > 168 ? '#1c1917' : '#ffffff');
  return value;
}

export function applyPrefsToDom(prefs) {
  const next = normalizePrefs(prefs);
  document.documentElement.lang = next.locale;
  document.documentElement.setAttribute('data-theme', next.color_theme);
  document.documentElement.classList.toggle('dark', next.color_theme === 'dark');
  applyAccentCss(next.theme_accent);
  return next;
}

export function emptySettingsRow(userId) {
  return {
    user_id: userId,
    theme_accent: null,
    bio_public: true,
    ui_skin: 'html',
    locale: 'en',
    color_theme: 'light',
    rain: true,
    glass_visible: true,
    glass_motion: true,
    prefs_synced: false
  };
}

export function mergeRemoteSettings(row, cached) {
  const local = normalizePrefs(cached);
  if (!row?.prefs_synced) {
    return normalizePrefs({
      ...local,
      theme_accent: row?.theme_accent || local.theme_accent,
      ui_skin: row?.ui_skin || local.ui_skin
    });
  }
  return prefsFromSettingsRow(row, local);
}
