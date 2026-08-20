import { t } from './i18n.js';

export const CREST_SRC = './assets/1.jpg';

let hideTimer = null;
let safetyTimer = null;
let noticeResolver = null;
let loadingArmedAt = 0;
let overlayGeneration = 0;

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return 'OC';
  }
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function noticeRoot() {
  let root = document.querySelector('#wlr-notice');
  if (root) {
    return root;
  }
  root = document.createElement('div');
  root.id = 'wlr-notice';
  root.className = 'wlr-notice';
  root.hidden = true;
  root.innerHTML = `
    <div class="wlr-notice-card" role="dialog" aria-modal="true" aria-labelledby="wlr-notice-status">
      <img class="wlr-notice-crest" src="${CREST_SRC}" alt="WHITE LION REGIMENT">
      <p id="wlr-notice-status" class="wlr-notice-status"></p>
      <div class="wlr-notice-choices" hidden></div>
      <div class="wlr-notice-actions" hidden></div>
    </div>
  `;
  root.addEventListener('click', (event) => {
    if (event.target !== root) {
      return;
    }
    const mode = root.dataset.mode;
    if (mode === 'loading' && Date.now() - loadingArmedAt < 1200) {
      return;
    }
    if (mode === 'loading') {
      hideLoading();
      return;
    }
    settleNotice(undefined);
  });
  document.body.appendChild(root);
  return root;
}

function clearHideTimer() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function settleNotice(result) {
  const resolve = noticeResolver;
  noticeResolver = null;
  hideNotice();
  if (resolve) {
    resolve(result);
  }
}

function renderNotice({ mode, message, kind = 'info', options = [], value = '' }) {
  if (mode !== 'loading' && safetyTimer) {
    window.clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  const root = noticeRoot();
  const status = root.querySelector('#wlr-notice-status');
  const choices = root.querySelector('.wlr-notice-choices');
  const actions = root.querySelector('.wlr-notice-actions');
  root.hidden = false;
  root.dataset.mode = mode;
  root.classList.toggle('is-loading', mode === 'loading');
  root.classList.toggle('is-error', kind === 'error');
  root.classList.toggle('is-success', kind === 'success');
  status.textContent = message || '';
  choices.hidden = mode !== 'choice';
  actions.hidden = mode !== 'confirm' && mode !== 'loading';

  if (mode === 'choice') {
    choices.innerHTML = options
      .map((option) => {
        const selected = String(option.value) === String(value) ? ' is-selected' : '';
        return `<button class="wlr-notice-choice${selected}" type="button" data-value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`;
      })
      .join('');
    choices.querySelectorAll('[data-value]').forEach((button) => {
      button.addEventListener('click', () => settleNotice(button.getAttribute('data-value')));
    });
  }

  if (mode === 'confirm') {
    actions.innerHTML = `
      <button class="btn btn-primary" type="button" data-notice-ok>${escapeHtml(t('notice.ok'))}</button>
      <button class="btn" type="button" data-notice-cancel>${escapeHtml(t('common.cancel'))}</button>
    `;
    actions.querySelector('[data-notice-ok]').addEventListener('click', () => settleNotice(true));
    actions.querySelector('[data-notice-cancel]').addEventListener('click', () => settleNotice(false));
  }

  if (mode === 'loading') {
    actions.innerHTML = `<button class="btn" type="button" data-notice-dismiss>${escapeHtml(t('notice.dismiss'))}</button>`;
    actions.querySelector('[data-notice-dismiss]').addEventListener('click', () => hideLoading());
  }
}

export function hideNotice() {
  clearHideTimer();
  if (safetyTimer) {
    window.clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  const root = document.querySelector('#wlr-notice');
  if (!root) {
    return;
  }
  root.hidden = true;
  root.dataset.mode = '';
  root.classList.remove('is-loading', 'is-error', 'is-success');
}

export function showLoading(message) {
  clearHideTimer();
  loadingArmedAt = Date.now();
  renderNotice({ mode: 'loading', message: message || t('notice.loading') });
  if (safetyTimer) {
    window.clearTimeout(safetyTimer);
  }
  safetyTimer = window.setTimeout(() => {
    const root = document.querySelector('#wlr-notice');
    if (root?.dataset.mode === 'loading') {
      hideNotice();
    }
  }, 8000);
}

export function hideLoading() {
  const root = document.querySelector('#wlr-notice');
  if (!root || root.dataset.mode !== 'loading') {
    return;
  }
  hideNotice();
}

export async function withOverlay(work, loadingMessage) {
  const generation = ++overlayGeneration;
  let shown = false;
  let finished = false;
  const timer = window.setTimeout(() => {
    if (finished || generation !== overlayGeneration) {
      return;
    }
    shown = true;
    showLoading(loadingMessage || t('notice.loading'));
  }, 400);
  try {
    return await work();
  } finally {
    finished = true;
    window.clearTimeout(timer);
    if (shown && generation === overlayGeneration) {
      hideLoading();
    }
  }
}

export function showStatus(message, isError = false) {
  clearHideTimer();
  renderNotice({
    mode: 'status',
    message,
    kind: isError ? 'error' : 'success'
  });
  hideTimer = window.setTimeout(() => hideNotice(), isError ? 5200 : 2800);
}

export function clearStatus() {
  hideNotice();
}

export function showToast(message, type = 'info', durationMs = 3200) {
  clearHideTimer();
  renderNotice({
    mode: 'status',
    message,
    kind: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'
  });
  hideTimer = window.setTimeout(() => hideNotice(), durationMs);
}

export function confirmNotice(message) {
  clearHideTimer();
  return new Promise((resolve) => {
    noticeResolver = resolve;
    renderNotice({ mode: 'confirm', message });
  });
}

export function chooseNotice({ title, options, value = '' }) {
  clearHideTimer();
  return new Promise((resolve) => {
    noticeResolver = resolve;
    renderNotice({
      mode: 'choice',
      message: title || t('notice.choose'),
      options,
      value
    });
  });
}

function selectedLabel(select) {
  const option = select.selectedOptions[0];
  return option ? option.textContent : '';
}

function wrapSelect(select) {
  if (select.dataset.choiceUpgraded === 'true') {
    const trigger = select.previousElementSibling;
    if (trigger?.classList.contains('choice-trigger')) {
      trigger.textContent = selectedLabel(select) || t('notice.choose');
    }
    return;
  }
  select.dataset.choiceUpgraded = 'true';
  select.classList.add('is-native-hidden');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'choice-trigger';
  trigger.textContent = selectedLabel(select) || t('notice.choose');
  select.insertAdjacentElement('beforebegin', trigger);
  trigger.addEventListener('click', async () => {
    const options = [...select.options].map((option) => ({
      value: option.value,
      label: String(option.textContent || '').trim() || (option.value ? option.value : '—')
    }));
    const picked = await chooseNotice({
      title: t('notice.choose'),
      options,
      value: select.value
    });
    if (picked === undefined) {
      return;
    }
    select.value = picked;
    trigger.textContent = selectedLabel(select) || t('notice.choose');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export function upgradeSelects(root = document) {
  root.querySelectorAll('select.select-field').forEach(wrapSelect);
}

export function installCrestIcon() {
  if (document.querySelector('link[rel="icon"]')) {
    return;
  }
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.href = CREST_SRC;
  document.head.appendChild(icon);
}

export function optionMarkup(values, selectedValue = '') {
  return ['<option value=""></option>']
    .concat(
      values.map((value) => {
        const selected = value === selectedValue ? ' selected' : '';
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(value)}</option>`;
      })
    )
    .join('');
}

export const PENCIL_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
`;

export const PLUS_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 5h2v14h-2zM5 11h14v2H5z"/>
  </svg>
`;

export const BANNER_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
  </svg>
`;
