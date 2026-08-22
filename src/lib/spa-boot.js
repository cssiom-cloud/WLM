import { getJsxBase } from '../../js/ui-mode.js';

const SPA_PATH_KEY = 'wlr-spa-path';

function mergeAuthParams(targetSearch, fallbackSearch) {
  const target = new URLSearchParams(targetSearch || '');
  const fallback = new URLSearchParams(fallbackSearch || '');
  ['code', 'state', 'error', 'error_description', 'error_code'].forEach((key) => {
    if (!target.get(key) && fallback.get(key)) {
      target.set(key, fallback.get(key));
    }
  });
  const raw = target.toString();
  return raw ? `?${raw}` : '';
}

export function restoreSpaPath() {
  try {
    const saved = window.sessionStorage.getItem(SPA_PATH_KEY);
    if (!saved) {
      return false;
    }
    window.sessionStorage.removeItem(SPA_PATH_KEY);
    const url = new URL(saved, window.location.origin);
    const base = getJsxBase();
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
      return false;
    }
    const search = mergeAuthParams(url.search, window.location.search);
    const hash = url.hash || window.location.hash;
    window.history.replaceState(null, '', `${url.pathname}${search}${hash}`);
    return true;
  } catch {
    return false;
  }
}

export function leaveReactHtmlShell() {
  if (!window.location.pathname.endsWith('/react.html')) {
    return;
  }
  const base = getJsxBase();
  window.history.replaceState(null, '', `${base}/login${window.location.search}${window.location.hash}`);
}

restoreSpaPath();
leaveReactHtmlShell();
