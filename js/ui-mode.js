const UI_MODE_KEY = 'wlr-command-ui';
export const JSX_BASE = '/app';

export function readUiMode() {
  const value = window.localStorage.getItem(UI_MODE_KEY);
  if (value === 'jsx' || value === 'html') {
    return value;
  }
  return null;
}

export function writeUiMode(mode) {
  window.localStorage.setItem(UI_MODE_KEY, mode === 'jsx' ? 'jsx' : 'html');
}

export function isReactRuntime() {
  const path = window.location.pathname;
  return path === JSX_BASE || path.startsWith(`${JSX_BASE}/`);
}

export function reactUiAvailable() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function stripJsxBase(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === JSX_BASE) {
    return '/';
  }
  if (path.startsWith(`${JSX_BASE}/`)) {
    return path.slice(JSX_BASE.length) || '/';
  }
  return path || '/';
}

function withJsxBase(route) {
  const path = route.startsWith('/') ? route : `/${route}`;
  if (path === '/') {
    return JSX_BASE;
  }
  return `${JSX_BASE}${path}`;
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
  return JSX_BASE;
}

export function siteRootUrl() {
  const { origin, pathname } = window.location;
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    return `${origin}/`;
  }
  if (pathname.endsWith('/app')) {
    return `${origin}${pathname.slice(0, -3)}`;
  }
  const appAt = pathname.indexOf('/app/');
  if (appAt !== -1) {
    return `${origin}${pathname.slice(0, appAt)}/`;
  }
  const lastSlash = pathname.lastIndexOf('/');
  return `${origin}${pathname.slice(0, lastSlash + 1)}`;
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

export function maybeRedirectForUiMode() {
  if (isOpsExportHandoffActive()) {
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
