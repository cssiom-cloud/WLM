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

export function showLoading(message, holdMs = 8000) {
  clearHideTimer();
  loadingArmedAt = Date.now();
  renderNotice({ mode: 'loading', message: message || t('notice.loading') });
  if (safetyTimer) {
    window.clearTimeout(safetyTimer);
  }
  const hold = Number(holdMs);
  if (!Number.isFinite(hold) || hold <= 0) {
    return;
  }
  safetyTimer = window.setTimeout(() => {
    const root = document.querySelector('#wlr-notice');
    if (root?.dataset.mode === 'loading') {
      hideNotice();
    }
  }, hold);
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

let openChoiceMenu = null;
let choiceKeyHandler = null;

function closeChoiceMenu() {
  if (choiceKeyHandler) {
    window.removeEventListener('keydown', choiceKeyHandler);
    choiceKeyHandler = null;
  }
  openChoiceMenu?.remove();
  openChoiceMenu = null;
}

function openSelectMenu(select, trigger) {
  closeChoiceMenu();
  const rect = trigger.getBoundingClientRect();
  const options = [...select.options];
  const menuHeight = Math.min(320, options.length * 42 + 12);
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow < menuHeight && rect.top > menuHeight ? rect.top - menuHeight - 6 : rect.bottom + 6;
  const wrap = document.createElement('div');
  const backdrop = document.createElement('div');
  backdrop.className = 'cmd-select-backdrop';
  const menu = document.createElement('ul');
  menu.className = 'cmd-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.style.top = `${top}px`;
  menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8))}px`;
  menu.style.width = `${Math.max(rect.width, 160)}px`;
  options.forEach((option) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cmd-select-option${option.value === select.value ? ' is-active' : ''}`;
    button.setAttribute('role', 'option');
    button.dataset.value = option.value;
    button.textContent = String(option.textContent || '').trim() || (option.value ? option.value : '—');
    item.appendChild(button);
    menu.appendChild(item);
  });
  backdrop.addEventListener('click', closeChoiceMenu);
  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) {
      return;
    }
    select.value = button.dataset.value;
    trigger.textContent = selectedLabel(select) || t('notice.choose');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeChoiceMenu();
  });
  wrap.append(backdrop, menu);
  document.body.appendChild(wrap);
  openChoiceMenu = wrap;
  choiceKeyHandler = (event) => {
    if (event.key === 'Escape') {
      closeChoiceMenu();
    }
  };
  window.addEventListener('keydown', choiceKeyHandler);
}

function wrapSelect(select) {
  if (select.classList.contains('sr-only') || select.closest('.cmd-select')) {
    return;
  }
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
  trigger.className = 'choice-trigger cmd-select-trigger';
  trigger.disabled = select.disabled;
  trigger.textContent = selectedLabel(select) || t('notice.choose');
  select.insertAdjacentElement('beforebegin', trigger);
  trigger.addEventListener('click', () => {
    if (select.disabled) {
      return;
    }
    openSelectMenu(select, trigger);
  });
}

export function upgradeSelects(root = document) {
  root.querySelectorAll('select').forEach(wrapSelect);
  upgradeCheckboxes(root);
}

export function upgradeCheckboxes(root = document) {
  root.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.classList.add('cmd-native-check');
  });
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
