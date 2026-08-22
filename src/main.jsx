import React from 'react';
import { createRoot } from 'react-dom/client';
import { getJsxBase, maybeRedirectForUiMode } from '../js/ui-mode.js';
import App from './App.jsx';
import './index.css';

const SPA_PATH_KEY = 'wlr-spa-path';

function restoreSpaPath() {
  try {
    const saved = window.sessionStorage.getItem(SPA_PATH_KEY);
    if (saved) {
      window.sessionStorage.removeItem(SPA_PATH_KEY);
      const url = new URL(saved, window.location.origin);
      const base = getJsxBase();
      if (url.pathname === base || url.pathname.startsWith(`${base}/`)) {
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }
  } catch {
    /* ignore storage errors */
  }
}

restoreSpaPath();

if (window.location.pathname.endsWith('/react.html')) {
  window.location.replace(`${getJsxBase()}/login${window.location.search}`);
} else if (!maybeRedirectForUiMode()) {
  createRoot(document.getElementById('root')).render(<App />);
}
