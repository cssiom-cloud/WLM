import { getPrefsOwner, readLocalPrefs, writeLocalPrefs } from './user-prefs.js';

const UI_MODE_KEY = 'wlr-command-ui';

function viteSiteBase() {
  try {
    const url = import.meta.env.BASE_URL;
    if (typeof url === 'string') {
      const trimmed = url.replace(/\/$/, '');
      return trimmed === '.' ? '' : trimmed;
    }
  } catch {
    /* Vanilla pages do not have a Vite base. */
  }
  return null;
}

export function getSiteBasePath() {
  const fromVite = viteSiteBase();
  if (fromVite !== null) {
    return fromVite;
  }
  const path = (window.location.pathname.replace(/\/+$/, '') || '/');
  if (path === '/app' || path.startsWith('/app/')) {
    return '';
  }
  const appMatch = path.match(/^(.*)\/app(?:\/|$)/);
  if (appMatch) {
    return appMatch[1];
  }
  const file = path.split('/').pop() || '';
  if (file.includes('.')) {
    return path.slice(0, Math.max(0, path.length - file.length - 1));
  }
  return path === '/' ? '' : path;
}

export function getJsxBase() {
  const base = getSiteBasePath();
  return base ? `${base}/app` : '/app';
}

export const JSX_BASE = '/app';

export function readUiMode() {
  const fromPrefs = readLocalPrefs(getPrefsOwner()).ui_skin;
  if (fromPrefs === 'jsx' || fromPrefs === 'html') {
    return fromPrefs;
  }
  const value = window.localStorage.getItem(UI_MODE_KEY);
  if (value === 'jsx' || value === 'html') {
    return value;
  }
  return null;
}

export function writeUiMode(mode) {
  const next = mode === 'jsx' ? 'jsx' : 'html';
  writeLocalPrefs(getPrefsOwner(), { ui_skin: next });
  window.localStorage.setItem(UI_MODE_KEY, next);
}

export function isReactRuntime() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const base = getJsxBase();
  return path === base || path.startsWith(`${base}/`);
}

export function reactUiAvailable() {
  return true;
}

function stripJsxBase(pathname) {
  const base = getJsxBase();
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === base || path === '') {
    return '/';
  }
  if (path.startsWith(`${base}/`)) {
    return path.slice(base.length) || '/';
  }
  return path || '/';
}

function withJsxBase(route) {
  const base = getJsxBase();
  const path = route.startsWith('/') ? route : `/${route}`;
  if (path === '/') {
    return base;
  }
  return `${base}${path}`;
}

function samePage(url) {
  try {
    const next = new URL(url, window.location.origin);
    return next.pathname === window.location.pathname && next.search === window.location.search;
  } catch {
    return false;
  }
}

function htmlFileFromJsx(pathname, search) {
  const path = stripJsxBase(pathname);
  if (path === '/' || path === '') {
    return 'index.html';
  }
  if (path === '/login') {
    return 'login.html';
  }
  if (path === '/select') {
    return 'profiles.html';
  }
  if (path === '/directory') {
    return 'directory.html';
  }
  if (path === '/org') {
    return 'org.html';
  }
  if (path === '/units') {
    return 'units.html';
  }
  const unitManage = path.match(/^\/units\/([^/]+)\/manage$/);
  if (unitManage) {
    return `unit-manage.html?code=${encodeURIComponent(unitManage[1])}`;
  }
  const unit = path.match(/^\/units\/([^/]+)$/);
  if (unit) {
    return `unit.html?code=${encodeURIComponent(unit[1])}`;
  }
  if (path === '/operations/create') {
    return 'operation-create.html';
  }
  const opEdit = path.match(/^\/operations\/([^/]+)\/edit$/);
  if (opEdit) {
    return `operation-create.html?id=${encodeURIComponent(opEdit[1])}`;
  }
  const op = path.match(/^\/operations\/([^/]+)$/);
  if (op) {
    return `operation.html?id=${encodeURIComponent(op[1])}`;
  }
  if (path === '/operations') {
    return 'operations.html';
  }
  if (path === '/announcements/create') {
    return 'announce-create.html';
  }
  if (path === '/announcements' || path.startsWith('/announcements/')) {
    return 'announcements.html';
  }
  if (path === '/memo' || path === '/documents') {
    return 'memo.html';
  }
  if (path === '/library') {
    return 'documents.html';
  }
  if (path === '/lore') {
    return 'lore.html';
  }
  if (path === '/settings') {
    return 'settings.html';
  }
  if (path === '/admin') {
    return 'admin.html';
  }
  if (path === '/accounts') {
    return 'accounts.html';
  }
  if (path === '/logs') {
    return 'logs.html';
  }
  if (path === '/tickets') {
    return 'tickets.html';
  }
  return 'index.html';
}

function jsxPathFromHtml(pathname, search) {
  const file = (pathname.split('/').pop() || 'index.html').toLowerCase();
  const params = new URLSearchParams(search);
  if (file === 'login.html') {
    return withJsxBase('/login');
  }
  if (file === 'profiles.html') {
    return withJsxBase('/select');
  }
  if (file === 'directory.html') {
    return withJsxBase('/directory');
  }
  if (file === 'org.html') {
    return withJsxBase('/org');
  }
  if (file === 'units.html') {
    return withJsxBase('/units');
  }
  if (file === 'unit.html') {
    const code = params.get('code') || '';
    return withJsxBase(code ? `/units/${encodeURIComponent(code)}` : '/units');
  }
  if (file === 'unit-manage.html') {
    const code = params.get('code') || '';
    return withJsxBase(code ? `/units/${encodeURIComponent(code)}/manage` : '/units');
  }
  if (file === 'operations.html') {
    return withJsxBase('/operations');
  }
  if (file === 'operation.html') {
    const id = params.get('id') || '';
    return withJsxBase(id ? `/operations/${encodeURIComponent(id)}` : '/operations');
  }
  if (file === 'operation-create.html') {
    const id = params.get('id') || '';
    return withJsxBase(id ? `/operations/${encodeURIComponent(id)}/edit` : '/operations/create');
  }
  if (file === 'announcements.html') {
    return withJsxBase('/announcements');
  }
  if (file === 'announce-create.html') {
    return withJsxBase('/announcements/create');
  }
  if (file === 'memo.html') {
    return withJsxBase('/memo');
  }
  if (file === 'documents.html') {
    return withJsxBase('/library');
  }
  if (file === 'lore.html') {
    return withJsxBase('/lore');
  }
  if (file === 'settings.html') {
    return withJsxBase('/settings');
  }
  if (file === 'admin.html') {
    return withJsxBase('/admin');
  }
  if (file === 'accounts.html') {
    return withJsxBase('/accounts');
  }
  if (file === 'logs.html') {
    return withJsxBase('/logs');
  }
  if (file === 'tickets.html') {
    return withJsxBase('/tickets');
  }
  return getJsxBase();
}

export function siteRootUrl() {
  const { origin } = window.location;
  const base = getSiteBasePath();
  return `${origin}${base}/`;
}

export function htmlUrlForCurrentPage() {
  const file = htmlFileFromJsx(window.location.pathname, window.location.search);
  return new URL(file, siteRootUrl()).href;
}

export function jsxUrlForCurrentPage() {
  if (isReactRuntime()) {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
  }
  const path = jsxPathFromHtml(window.location.pathname, window.location.search);
  return `${window.location.origin}${path}`;
}

function goTo(url) {
  if (samePage(url)) {
    return false;
  }
  window.location.replace(url);
  return true;
}

export function applyUiMode(mode) {
  const next = mode === 'jsx' ? 'jsx' : 'html';
  writeUiMode(next);
  if (next === 'jsx') {
    if (!reactUiAvailable()) {
      return { navigated: false, unavailable: true };
    }
    if (!isReactRuntime()) {
      return { navigated: goTo(jsxUrlForCurrentPage()), unavailable: false };
    }
    return { navigated: false, unavailable: false };
  }
  if (isReactRuntime()) {
    return { navigated: goTo(htmlUrlForCurrentPage()), unavailable: false };
  }
  return { navigated: false, unavailable: false };
}

const OPS_EXPORT_HANDOFF_KEY = 'wlr-ops-export-handoff';

export function readOpsExportHandoff() {
  try {
    const raw = window.sessionStorage.getItem(OPS_EXPORT_HANDOFF_KEY);
    if (!raw) {
      return null;
    }
    const job = JSON.parse(raw);
    if (!job?.id || (job.format !== 'jpg' && job.format !== 'pdf')) {
      window.sessionStorage.removeItem(OPS_EXPORT_HANDOFF_KEY);
      return null;
    }
    if (Date.now() - Number(job.startedAt || 0) > 180000) {
      window.sessionStorage.removeItem(OPS_EXPORT_HANDOFF_KEY);
      return null;
    }
    return job;
  } catch {
    return null;
  }
}

export function isOpsExportHandoffActive() {
  const job = readOpsExportHandoff();
  if (!job) {
    return false;
  }
  const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (file !== 'operation.html') {
    return false;
  }
  const id = new URLSearchParams(window.location.search).get('id');
  return !id || id === String(job.id);
}

export function startOpsExportFromJsx({ id, format }) {
  const job = {
    id: String(id || ''),
    format: format === 'jpg' ? 'jpg' : 'pdf',
    returnUrl: `${window.location.origin}${window.location.pathname}${window.location.search}`,
    startedAt: Date.now()
  };
  window.sessionStorage.setItem(OPS_EXPORT_HANDOFF_KEY, JSON.stringify(job));
  const html = new URL(
    `operation.html?id=${encodeURIComponent(job.id)}&handoff=1&export=${encodeURIComponent(job.format)}`,
    siteRootUrl()
  );
  window.location.assign(html.href);
}

export function completeOpsExportHandoff(result = {}) {
  const job = readOpsExportHandoff();
  window.sessionStorage.removeItem(OPS_EXPORT_HANDOFF_KEY);
  if (!job?.returnUrl) {
    return false;
  }
  try {
    const url = new URL(job.returnUrl, window.location.origin);
    if (result.ok) {
      url.searchParams.set('exported', job.format);
      url.searchParams.delete('exportError');
    } else {
      url.searchParams.set('exportError', '1');
      url.searchParams.delete('exported');
    }
    window.location.replace(url.href);
    return true;
  } catch {
    return false;
  }
}

const DOSSIER_EXPORT_HANDOFF_KEY = 'wlr-dossier-export-handoff';

export function readDossierExportHandoff() {
  try {
    const raw = window.sessionStorage.getItem(DOSSIER_EXPORT_HANDOFF_KEY);
    if (!raw) {
      return null;
    }
    const job = JSON.parse(raw);
    if (!job?.id) {
      window.sessionStorage.removeItem(DOSSIER_EXPORT_HANDOFF_KEY);
      return null;
    }
    if (Date.now() - Number(job.startedAt || 0) > 180000) {
      window.sessionStorage.removeItem(DOSSIER_EXPORT_HANDOFF_KEY);
      return null;
    }
    return job;
  } catch {
    return null;
  }
}

export function isDossierExportHandoffActive() {
  const job = readDossierExportHandoff();
  if (!job) {
    return false;
  }
  const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (file !== 'directory.html') {
    return false;
  }
  const id = new URLSearchParams(window.location.search).get('id');
  return !id || id === String(job.id);
}

export function startDossierExportFromJsx({ id }) {
  const here = new URL(window.location.href);
  here.searchParams.set('dossier', String(id || ''));
  const job = {
    id: String(id || ''),
    returnUrl: here.href,
    startedAt: Date.now()
  };
  window.sessionStorage.setItem(DOSSIER_EXPORT_HANDOFF_KEY, JSON.stringify(job));
  const html = new URL(
    `directory.html?id=${encodeURIComponent(job.id)}&handoff=1&export=pdf`,
    siteRootUrl()
  );
  window.location.assign(html.href);
}

export function completeDossierExportHandoff(result = {}) {
  const job = readDossierExportHandoff();
  window.sessionStorage.removeItem(DOSSIER_EXPORT_HANDOFF_KEY);
  if (!job?.returnUrl) {
    return false;
  }
  try {
    const url = new URL(job.returnUrl, window.location.origin);
    if (result.ok) {
      url.searchParams.set('exported', 'pdf');
      url.searchParams.delete('exportError');
    } else {
      url.searchParams.set('exportError', '1');
      url.searchParams.delete('exported');
    }
    window.location.replace(url.href);
    return true;
  } catch {
    return false;
  }
}

export function maybeRedirectForUiMode() {
  if (isOpsExportHandoffActive() || isDossierExportHandoffActive()) {
    return false;
  }
  const mode = readUiMode();
  if (!mode) {
    return false;
  }
  if (mode === 'jsx' && reactUiAvailable() && !isReactRuntime()) {
    return goTo(jsxUrlForCurrentPage());
  }
  if (mode === 'html' && isReactRuntime()) {
    return false;
  }
  return false;
}

export async function persistUiSkin(saveFn, mode) {
  writeUiMode(mode);
  if (!saveFn) {
    return;
  }
  try {
    await saveFn({ ui_skin: mode === 'jsx' ? 'jsx' : 'html' });
  } catch (error) {
    const message = String(error?.message || error || '');
    if (/ui_skin|PGRST204|schema cache|column/i.test(message)) {
      return;
    }
    throw error;
  }
}
