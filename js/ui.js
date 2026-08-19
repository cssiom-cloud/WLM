import { t } from './i18n.js';

export const CREST_SRC = './assets/1.jpg';

let hideTimer = null;
let loadingCount = 0;
let noticeResolver = null;
let choiceObserverBound = false;

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
    if (root.dataset.mode === 'loading') {
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
  if (loadingCount > 0) {
    renderNotice({ mode: 'loading', message: t('notice.loading') });
  } else {
    hideNotice();
  }
  if (resolve) {
    resolve(result);
  }
}

function renderNotice({ mode, message, kind = 'info', options = [], value = '' }) {
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
  actions.hidden = mode !== 'confirm';

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
}

export function hideNotice() {
  clearHideTimer();
  const root = document.querySelector('#wlr-notice');
  if (!root) {
    return;
  }
  if (loadingCount > 0) {
    return;
  }
  root.hidden = true;
  root.dataset.mode = '';
}

export function showLoading(message) {
  loadingCount += 1;
  clearHideTimer();
  renderNotice({ mode: 'loading', message: message || t('notice.loading') });
}

export function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) {
    hideNotice();
  }
}

export async function withOverlay(work, loadingMessage) {
  let shown = false;
  const timer = window.setTimeout(() => {
    shown = true;
    showLoading(loadingMessage || t('notice.loading'));
  }, 280);
  try {
    return await work();
  } finally {
    window.clearTimeout(timer);
    if (shown) {
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

export function watchChoiceSelects() {
  upgradeSelects();
  if (choiceObserverBound || !document.body) {
    return;
  }
  choiceObserverBound = true;
  const observer = new MutationObserver(() => upgradeSelects());
  observer.observe(document.body, { childList: true, subtree: true });
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
