import { t } from './i18n.js';
import { escapeHtml } from './ui.js';

const ASPECTS = [
  { id: 'free', ratio: 0 },
  { id: '1:1', ratio: 1 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '16:9', ratio: 16 / 9 }
];

const OUTPUT_SIZES = [320, 512, 768, 1024, 1600];

let host = null;
let canvas = null;
let image = null;
let objectUrl = null;
let aspectId = '1:1';
let zoom = 1;
let panX = 0;
let panY = 0;
let radius = 16;
let outputSize = 768;
let filename = 'image.jpg';
let resolver = null;
const pointers = new Map();
let pinchDistance = 0;

function currentAspect() {
  return ASPECTS.find((item) => item.id === aspectId) || ASPECTS[1];
}

function revokeObjectUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function coverScale(width, height) {
  if (!image) {
    return 1;
  }
  return Math.max(width / image.naturalWidth, height / image.naturalHeight);
}

function viewSize() {
  const ratio = currentAspect().ratio;
  const cssWidth = canvas.clientWidth || 320;
  const cssHeight = ratio ? cssWidth / ratio : canvas.clientHeight || Math.round(cssWidth * 0.62);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return {
    cssWidth,
    cssHeight,
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr))
  };
}

function draw() {
  if (!canvas || !image) {
    return;
  }
  const view = viewSize();
  canvas.width = view.width;
  canvas.height = view.height;
  canvas.style.borderRadius = `${radius}px`;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14161c';
  ctx.fillRect(0, 0, view.width, view.height);
  const scale = coverScale(view.width, view.height) * zoom;
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const dx = (view.width - dw) / 2 + panX;
  const dy = (view.height - dh) / 2 + panY;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, dx, dy, dw, dh);
}

function roundRectPath(ctx, width, height, corner) {
  const r = Math.max(0, Math.min(corner, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(width, 0, width, height, r);
  ctx.arcTo(width, height, 0, height, r);
  ctx.arcTo(0, height, 0, 0, r);
  ctx.arcTo(0, 0, width, 0, r);
  ctx.closePath();
}

function exportBlob() {
  if (!image) {
    throw new Error(t('img.choose'));
  }
  const ratio = currentAspect().ratio;
  const outW = outputSize;
  const outH = Math.max(1, Math.round(ratio ? outW / ratio : outW * (viewSize().height / viewSize().width)));
  const view = viewSize();
  const scale = coverScale(view.width, view.height) * zoom;
  const sx = outW / view.width;
  const dx = ((view.width - image.naturalWidth * scale) / 2 + panX) * sx;
  const dy = ((view.height - image.naturalHeight * scale) / 2 + panY) * sx;
  const dw = image.naturalWidth * scale * sx;
  const dh = image.naturalHeight * scale * sx;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  const bakeRadius = Math.round((radius / 50) * (Math.min(outW, outH) / 2));
  if (bakeRadius > 2) {
    roundRectPath(ctx, outW, outH, bakeRadius);
    ctx.clip();
  }
  ctx.fillStyle = '#14161c';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, dx, dy, dw, dh);
  const typed = bakeRadius > 2 ? 'image/png' : 'image/jpeg';
  const exportName = bakeRadius > 2 ? filename.replace(/\.\w+$/, '.png') : filename;
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(t('img.choose')));
          return;
        }
        resolve(new File([blob], exportName, { type: typed, lastModified: Date.now() }));
      },
      typed,
      0.92
    );
  });
}

async function loadFromSource(src) {
  revokeObjectUrl();
  let url = src;
  if (src instanceof File) {
    objectUrl = URL.createObjectURL(src);
    url = objectUrl;
    filename = src.name || filename;
  } else if (typeof src === 'string' && !src.startsWith('data:') && !src.startsWith('blob:')) {
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (!response.ok) {
        throw new Error('fetch failed');
      }
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      url = objectUrl;
    } catch {
      url = src;
    }
  }
  const loaded = await new Promise((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error(t('img.loadFailed')));
    next.crossOrigin = 'anonymous';
    next.src = url;
  });
  image = loaded;
  zoom = 1;
  panX = 0;
  panY = 0;
  draw();
}

function closeEditor(result) {
  if (!host) {
    return;
  }
  host.hidden = true;
  host.classList.remove('is-open');
  pointers.clear();
  const resolve = resolver;
  resolver = null;
  if (resolve) {
    resolve(result || null);
  }
}

function renderChrome() {
  if (!host) {
    return;
  }
  host.querySelector('[data-img-title]').textContent = t('img.title');
  host.querySelector('[data-img-choose]').textContent = t('img.choose');
  host.querySelector('[data-img-apply]').textContent = t('img.apply');
  host.querySelector('[data-img-cancel]').textContent = t('common.cancel');
  host.querySelector('[data-img-zoom-label]').textContent = t('img.zoom');
  host.querySelector('[data-img-size-label]').textContent = t('img.size');
  host.querySelector('[data-img-radius-label]').textContent = t('img.radius');
  host.querySelector('[data-img-aspect-label]').textContent = t('img.aspect');
  host.querySelector('#image-editor-aspects').innerHTML = ASPECTS.map(
    (item) =>
      `<button class="btn btn-inline${item.id === aspectId ? ' btn-primary' : ''}" type="button" data-aspect="${item.id}">${escapeHtml(
        t(`img.aspect.${item.id}`)
      )}</button>`
  ).join('');
}

export function assignFileToInput(input, file) {
  if (!input || !file) {
    return;
  }
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function ensureImageEditor() {
  if (host) {
    return host;
  }
  host = document.createElement('div');
  host.id = 'image-editor-modal';
  host.className = 'modal-backdrop image-editor-modal';
  host.hidden = true;
  host.innerHTML = `
    <div class="modal-card image-editor-card" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
      <div class="toolbar-row">
        <h2 id="image-editor-title" data-img-title>Crop image</h2>
        <button class="btn" type="button" data-img-cancel>Cancel</button>
      </div>
      <div class="image-editor-stage">
        <canvas id="image-editor-canvas"></canvas>
      </div>
      <p class="editor-label" data-img-aspect-label>Frame</p>
      <div id="image-editor-aspects" class="image-editor-aspects"></div>
      <div class="image-editor-sliders">
        <label><span data-img-zoom-label>Zoom</span>
          <input id="image-editor-zoom" type="range" min="100" max="400" value="100">
        </label>
        <label><span data-img-radius-label>Corner radius</span>
          <input id="image-editor-radius" type="range" min="0" max="50" value="16">
        </label>
        <label><span data-img-size-label>Export size</span>
          <select id="image-editor-size" class="select-field">
            ${OUTPUT_SIZES.map((size) => `<option value="${size}">${size}px</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="btn-row image-editor-actions">
        <button class="btn" type="button" data-img-choose>Choose image</button>
        <button class="btn btn-primary" type="button" data-img-apply>Apply crop</button>
      </div>
      <input id="image-editor-file" type="file" accept="image/*">
    </div>
  `;
  document.body.appendChild(host);
  canvas = host.querySelector('#image-editor-canvas');
  const fileInput = host.querySelector('#image-editor-file');
  const stage = host.querySelector('.image-editor-stage');

  host.addEventListener('click', (event) => {
    if (event.target === host || event.target.closest('[data-img-cancel]')) {
      closeEditor(null);
    }
  });
  host.querySelector('[data-img-choose]').addEventListener('click', () => fileInput.click());
  host.querySelector('[data-img-apply]').addEventListener('click', async () => {
    try {
      const file = await exportBlob();
      closeEditor({ file, radius, aspect: aspectId, size: outputSize });
    } catch (error) {
      closeEditor(null);
      console.warn(error);
    }
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) {
      await loadFromSource(file);
    }
  });
  host.querySelector('#image-editor-aspects').addEventListener('click', (event) => {
    const button = event.target.closest('[data-aspect]');
    if (!button) {
      return;
    }
    aspectId = button.getAttribute('data-aspect');
    panX = 0;
    panY = 0;
    renderChrome();
    syncStageAspect();
    draw();
  });
  host.querySelector('#image-editor-zoom').addEventListener('input', (event) => {
    zoom = Number(event.target.value) / 100;
    draw();
  });
  host.querySelector('#image-editor-radius').addEventListener('input', (event) => {
    radius = Number(event.target.value);
    draw();
  });
  host.querySelector('#image-editor-size').addEventListener('change', (event) => {
    outputSize = Number(event.target.value) || 768;
  });

  const mark = (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  stage.addEventListener('pointerdown', (event) => {
    stage.setPointerCapture(event.pointerId);
    mark(event);
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });
  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    event.preventDefault();
    const prev = pointers.get(event.pointerId);
    mark(event);
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const nextDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDistance) {
        zoom = Math.min(4, Math.max(1, zoom * (nextDistance / pinchDistance)));
        host.querySelector('#image-editor-zoom').value = String(Math.round(zoom * 100));
      }
      pinchDistance = nextDistance;
    } else {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      panX += (event.clientX - prev.x) * dpr;
      panY += (event.clientY - prev.y) * dpr;
    }
    draw();
  });
  const clearPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchDistance = 0;
    }
  };
  stage.addEventListener('pointerup', clearPointer);
  stage.addEventListener('pointercancel', clearPointer);
  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoom = Math.min(4, Math.max(1, zoom * (event.deltaY > 0 ? 0.94 : 1.06)));
      host.querySelector('#image-editor-zoom').value = String(Math.round(zoom * 100));
      draw();
    },
    { passive: false }
  );
  window.addEventListener('resize', () => {
    if (!host.hidden) {
      syncStageAspect();
      draw();
    }
  });
  return host;
}

function syncStageAspect() {
  const stage = host.querySelector('.image-editor-stage');
  const ratio = currentAspect().ratio;
  stage.style.aspectRatio = ratio ? String(ratio) : '16 / 10';
}

export async function openImageEditor(options = {}) {
  ensureImageEditor();
  aspectId = options.aspect || '1:1';
  radius = Number.isFinite(options.radius) ? options.radius : 8;
  outputSize = options.size || (aspectId === '16:9' ? 1024 : 768);
  filename = options.filename || 'image.jpg';
  zoom = 1;
  panX = 0;
  panY = 0;
  host.hidden = false;
  host.classList.add('is-open');
  host.querySelector('#image-editor-zoom').value = '100';
  host.querySelector('#image-editor-radius').value = String(radius);
  host.querySelector('#image-editor-size').value = String(outputSize);
  renderChrome();
  syncStageAspect();
  if (options.source) {
    try {
      await loadFromSource(options.source);
    } catch (error) {
      console.warn(error);
    }
  } else {
    image = null;
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 180;
    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, 320, 180);
  }
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

async function handleTrigger(trigger) {
  const input = trigger.getAttribute('data-target')
    ? document.querySelector(trigger.getAttribute('data-target'))
    : null;
  const preview = trigger.getAttribute('data-preview')
    ? document.querySelector(trigger.getAttribute('data-preview'))
    : null;
  const existing = trigger.getAttribute('data-src') || preview?.getAttribute('src') || input?.files?.[0] || '';
  const result = await openImageEditor({
    source: existing || null,
    aspect: trigger.getAttribute('data-aspect') || '1:1',
    filename: trigger.getAttribute('data-filename') || 'image.jpg',
    size: Number(trigger.getAttribute('data-size')) || undefined
  });
  if (!result?.file) {
    return null;
  }
  if (input) {
    assignFileToInput(input, result.file);
  }
  if (preview) {
    preview.src = URL.createObjectURL(result.file);
    preview.hidden = false;
    preview.style.borderRadius = `${result.radius}px`;
  }
  trigger.dispatchEvent(
    new CustomEvent('wlr-image-cropped', {
      bubbles: true,
      detail: result
    })
  );
  return result;
}

export function bindImageEditorHost() {
  ensureImageEditor();
  if (window.__wlrImageEditorBound) {
    return;
  }
  window.__wlrImageEditorBound = true;
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-image-edit]');
    if (!trigger) {
      return;
    }
    event.preventDefault();
    handleTrigger(trigger).catch((error) => console.warn(error));
  });
  window.addEventListener('wlr-lang-changed', () => {
    if (host && !host.hidden) {
      renderChrome();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && host && !host.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeEditor(null);
    }
  });
}
