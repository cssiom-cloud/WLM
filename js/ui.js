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

export function showStatus(message, isError = false) {
  const banner = document.querySelector('#status-banner');
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.classList.add('is-visible');
  banner.classList.toggle('is-error', Boolean(isError));
}

export function clearStatus() {
  const banner = document.querySelector('#status-banner');
  if (!banner) {
    return;
  }
  banner.textContent = '';
  banner.classList.remove('is-visible', 'is-error');
}

export function showToast(message, type = 'info', durationMs = 3200) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = `toast${type === 'success' ? ' is-success' : type === 'error' ? ' is-error' : ''}`;
  toast.textContent = message;
  stack.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 350);
  }, durationMs);
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
