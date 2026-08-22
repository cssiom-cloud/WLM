import { t } from './i18n.js';
import { escapeHtml } from './ui.js';

// Vanilla canvas overlay. Deep drawing is handled here instead of
// react-konva / fabric.js. Viewer pan/zoom is native (react-zoom-pan-pinch equivalent).

const TOOLS = [
  { id: 'pen', icon: '✎' },
  { id: 'arrow', icon: '↗' },
  { id: 'dot', icon: '●' },
  { id: 'ring', icon: '○' },
  { id: 'rect', icon: '▢' },
  { id: 'text', icon: 'T' }
];

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

function uid() {
  return window.crypto.randomUUID();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function drawMarkings(ctx, drawings, width, height, preview) {
  const items = preview ? drawings.concat(preview) : drawings;
  items.forEach((item) => paintMark(ctx, item, width, height));
}

function paintMark(ctx, item, width, height) {
  if (!item) {
    return;
  }
  const stroke = Number(item.stroke) || 3;
  ctx.save();
  ctx.strokeStyle = item.color || '#1e4e8c';
  ctx.fillStyle = item.color || '#1e4e8c';
  ctx.lineWidth = stroke;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.font = `600 ${Math.max(12, stroke * 4 + 8)}px Prompt, Inter, sans-serif`;

  if (item.type === 'arrow') {
    const x1 = item.x1 * width;
    const y1 = item.y1 * height;
    const x2 = item.x2 * width;
    const y2 = item.y2 * height;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 10 + stroke * 2;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - 0.42), y2 - head * Math.sin(angle - 0.42));
    ctx.lineTo(x2 - head * Math.cos(angle + 0.42), y2 - head * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
  } else if (item.type === 'dot' || item.type === 'ring') {
    const x = item.x * width;
    const y = item.y * height;
    const radius = 5 + stroke * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (item.type === 'dot') {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  } else if (item.type === 'rect') {
    const x = Math.min(item.x, item.x + item.w) * width;
    const y = Math.min(item.y, item.y + item.h) * height;
    const w = Math.abs(item.w) * width;
    const h = Math.abs(item.h) * height;
    ctx.strokeRect(x, y, w, h);
  } else if (item.type === 'text' && item.text) {
    ctx.fillText(item.text, item.x * width, item.y * height);
  } else if (item.type === 'pen' && Array.isArray(item.points) && item.points.length) {
    ctx.beginPath();
    item.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }
  ctx.restore();
}

function fitExportSize(naturalWidth, naturalHeight, maxWidth = 1200, maxHeight = 720) {
  const scale = Math.min(1, maxWidth / Math.max(1, naturalWidth), maxHeight / Math.max(1, naturalHeight));
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale))
  };
}

function stillFromImage(image, drawings = [], maxWidth = 1200, maxHeight = 720) {
  const { width, height } = fitExportSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxWidth, maxHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  drawMarkings(ctx, drawings, width, height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(url, cors = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (cors) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Map image could not be loaded for export.'));
    image.src = url;
  });
}

export function rasterizeLiveMap(host, drawings = []) {
  const image = host?.querySelector('img.tac-map, [data-tac-image]');
  const overlay = host?.querySelector('canvas.tac-canvas');
  if (!image?.naturalWidth) {
    return '';
  }
  const { width, height } = fitExportSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  try {
    ctx.drawImage(image, 0, 0, width, height);
    if (overlay?.width && overlay.height) {
      ctx.drawImage(overlay, 0, 0, width, height);
    } else {
      drawMarkings(ctx, drawings, width, height);
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return '';
  }
}

export async function renderMapStill(mapUrl, drawings = [], maxWidth = 1200, maxHeight = 720) {
  if (!mapUrl) {
    return '';
  }
  try {
    const response = await fetch(mapUrl);
    if (response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = await loadImage(objectUrl, false);
        return stillFromImage(image, drawings, maxWidth, maxHeight);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  } catch {
    /* Fall through to a CORS image load. */
  }
  try {
    const image = await loadImage(mapUrl, true);
    return stillFromImage(image, drawings, maxWidth, maxHeight);
  } catch {
    return '';
  }
}

function pointFromEvent(canvas, event, cssWidth, cssHeight) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / cssWidth, 0, 1),
    y: clamp((event.clientY - rect.top) / cssHeight, 0, 1)
  };
}

function fitCanvas(canvas, frame) {
  const width = Math.max(1, frame.clientWidth);
  const height = Math.max(1, frame.clientHeight);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function toolbarMarkup(active, color, stroke) {
  return `
    <div class="tac-toolbar" role="toolbar" aria-label="${escapeHtml(t('ops.tools'))}">
      ${TOOLS.map(
        (tool) => `
          <button class="tac-tool${tool.id === active ? ' is-active' : ''}" type="button" data-tac-tool="${tool.id}" title="${escapeHtml(t(`ops.tool.${tool.id}`))}">
            <span aria-hidden="true">${tool.icon}</span>
            <span class="tac-tool-label">${escapeHtml(t(`ops.tool.${tool.id}`))}</span>
          </button>
        `
      ).join('')}
      <label class="tac-tool tac-tool-field">
        <span class="tac-tool-label">${escapeHtml(t('ops.tool.color'))}</span>
        <input data-tac-color type="color" value="${escapeHtml(color)}">
      </label>
      <label class="tac-tool tac-tool-field">
        <span class="tac-tool-label">${escapeHtml(t('ops.tool.stroke'))}</span>
        <input data-tac-stroke type="range" min="1" max="12" value="${stroke}">
      </label>
      <button class="tac-tool" type="button" data-tac-undo>${escapeHtml(t('ops.tool.undo'))}</button>
      <button class="tac-tool" type="button" data-tac-clear>${escapeHtml(t('ops.tool.clear'))}</button>
    </div>
  `;
}

export function mountMapEditor(root, options = {}) {
  const state = {
    drawings: Array.isArray(options.drawings) ? [...options.drawings] : [],
    mapUrl: options.mapUrl || '',
    tool: 'arrow',
    color: options.color || '#1e4e8c',
    stroke: Number(options.stroke) || 3,
    preview: null,
    drag: null,
    toolsOpen: true,
    fullscreen: false
  };

  root.innerHTML = `
    <div class="tac-editor">
      <div class="tac-chrome">
        <button class="tac-tool" type="button" data-tac-tools-toggle></button>
        <button class="tac-tool" type="button" data-tac-fullscreen></button>
      </div>
      <div data-tac-bar></div>
      <div class="tac-stage">
        <div class="tac-frame" data-tac-frame hidden>
          <img class="tac-map" data-tac-image alt="${escapeHtml(t('ops.map'))}">
          <canvas class="tac-canvas" data-tac-canvas></canvas>
          <input class="tac-text-input" data-tac-text type="text" maxlength="80" hidden>
        </div>
        <p class="tac-empty" data-tac-empty>${escapeHtml(t('ops.map.empty'))}</p>
      </div>
      <label class="tac-upload">
        <span data-tac-upload-label>${escapeHtml(t('ops.map.upload'))}</span>
        <input data-tac-file type="file" accept="image/*">
      </label>
    </div>
  `;

  const bar = root.querySelector('[data-tac-bar]');
  const toolsToggle = root.querySelector('[data-tac-tools-toggle]');
  const fullscreenButton = root.querySelector('[data-tac-fullscreen]');
  const frame = root.querySelector('[data-tac-frame]');
  const image = root.querySelector('[data-tac-image]');
  const canvas = root.querySelector('[data-tac-canvas]');
  const empty = root.querySelector('[data-tac-empty]');
  const fileInput = root.querySelector('[data-tac-file]');
  const textInput = root.querySelector('[data-tac-text]');
  let cssSize = { width: 1, height: 1 };
  let objectUrl = '';
  let fsShell = null;
  document.documentElement.classList.remove('overlay-lock');

  function portalEditor(on) {
    if (on) {
      const editor = root.querySelector('.tac-editor');
      if (!editor || fsShell) {
        return;
      }
      fsShell = document.createElement('div');
      fsShell.className = 'tac-fullscreen-shell';
      document.body.appendChild(fsShell);
      fsShell.appendChild(editor);
      document.body.style.overflow = 'hidden';
      return;
    }
    if (!fsShell) {
      return;
    }
    const editor = fsShell.querySelector('.tac-editor');
    if (editor) {
      root.appendChild(editor);
    }
    fsShell.remove();
    fsShell = null;
    document.body.style.overflow = '';
  }

  function applyFullscreen(on) {
    root.classList.toggle('tac-is-fullscreen', on);
    if (on) {
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (typeof req === 'function') {
        Promise.resolve(req.call(root))
          .then(() => window.setTimeout(paint, 80))
          .catch(() => {
            portalEditor(true);
            window.setTimeout(paint, 80);
          });
        return;
      }
      portalEditor(true);
      return;
    }
    portalEditor(false);
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if ((document.fullscreenElement || document.webkitFullscreenElement) && typeof exit === 'function') {
      Promise.resolve(exit.call(document)).catch(() => {});
    }
  }

  function renderChrome() {
    toolsToggle.textContent = state.toolsOpen ? t('ops.tools.hide') : t('ops.tools.show');
    fullscreenButton.textContent = state.fullscreen ? t('ops.map.exitFullscreen') : t('ops.map.fullscreen');
    bar.hidden = !state.toolsOpen;
  }

  function renderBar() {
    bar.innerHTML = toolbarMarkup(state.tool, state.color, state.stroke);
    renderChrome();
  }

  function paint() {
    if (frame.hidden) {
      return;
    }
    const fitted = fitCanvas(canvas, frame);
    cssSize = { width: fitted.width, height: fitted.height };
    fitted.ctx.clearRect(0, 0, fitted.width, fitted.height);
    drawMarkings(fitted.ctx, state.drawings, fitted.width, fitted.height, state.preview);
  }

  function syncMap() {
    const hasMap = Boolean(state.mapUrl);
    frame.hidden = !hasMap;
    empty.hidden = hasMap;
    if (hasMap && image.getAttribute('src') !== state.mapUrl) {
      image.src = state.mapUrl;
    }
    if (!hasMap) {
      image.removeAttribute('src');
    }
    paint();
  }

  function commit(item) {
    state.drawings.push(item);
    state.preview = null;
    paint();
    options.onChange?.(state.drawings);
  }

  renderBar();
  syncMap();

  const observer = new ResizeObserver(() => paint());
  observer.observe(frame);
  image.addEventListener('load', paint);

  toolsToggle.addEventListener('click', () => {
    state.toolsOpen = !state.toolsOpen;
    renderChrome();
  });
  fullscreenButton.addEventListener('click', () => {
    state.fullscreen = !state.fullscreen;
    renderChrome();
    applyFullscreen(state.fullscreen);
    window.setTimeout(paint, 80);
  });
  function handleKey(event) {
    if (event.key === 'Escape' && state.fullscreen) {
      state.fullscreen = false;
      renderChrome();
      applyFullscreen(false);
      window.setTimeout(paint, 80);
    }
  }
  function onFullscreenChange() {
    const native = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!native && state.fullscreen && !fsShell) {
      state.fullscreen = false;
      renderChrome();
      document.body.style.overflow = '';
      window.setTimeout(paint, 80);
    }
  }
  window.addEventListener('keydown', handleKey);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  bar.addEventListener('click', (event) => {
    const toolButton = event.target.closest('[data-tac-tool]');
    if (toolButton) {
      state.tool = toolButton.getAttribute('data-tac-tool');
      renderBar();
      return;
    }
    if (event.target.closest('[data-tac-undo]')) {
      state.drawings.pop();
      paint();
      options.onChange?.(state.drawings);
      return;
    }
    if (event.target.closest('[data-tac-clear]')) {
      state.drawings = [];
      paint();
      options.onChange?.(state.drawings);
    }
  });
  bar.addEventListener('input', (event) => {
    if (event.target.matches('[data-tac-color]')) {
      state.color = event.target.value;
    }
    if (event.target.matches('[data-tac-stroke]')) {
      state.stroke = Number(event.target.value) || 3;
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrl = URL.createObjectURL(file);
    state.mapUrl = objectUrl;
    syncMap();
    options.onMapFile?.(file, objectUrl);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.mapUrl) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(canvas, event, cssSize.width, cssSize.height);
    if (state.tool === 'dot' || state.tool === 'ring') {
      commit({
        id: uid(),
        type: state.tool,
        x: point.x,
        y: point.y,
        color: state.color,
        stroke: state.stroke
      });
      return;
    }
    if (state.tool === 'text') {
      textInput.hidden = false;
      textInput.style.left = `${event.offsetX}px`;
      textInput.style.top = `${event.offsetY}px`;
      textInput.value = '';
      textInput.dataset.x = String(point.x);
      textInput.dataset.y = String(point.y);
      textInput.focus();
      return;
    }
    if (state.tool === 'pen') {
      state.drag = { type: 'pen', points: [point] };
      state.preview = { type: 'pen', points: [point], color: state.color, stroke: state.stroke };
      paint();
      return;
    }
    state.drag = { start: point, type: state.tool };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.drag) {
      return;
    }
    const point = pointFromEvent(canvas, event, cssSize.width, cssSize.height);
    if (state.drag.type === 'pen') {
      state.drag.points.push(point);
      state.preview = {
        type: 'pen',
        points: state.drag.points,
        color: state.color,
        stroke: state.stroke
      };
    } else if (state.drag.type === 'arrow') {
      state.preview = {
        type: 'arrow',
        x1: state.drag.start.x,
        y1: state.drag.start.y,
        x2: point.x,
        y2: point.y,
        color: state.color,
        stroke: state.stroke
      };
    } else if (state.drag.type === 'rect') {
      state.preview = {
        type: 'rect',
        x: state.drag.start.x,
        y: state.drag.start.y,
        w: point.x - state.drag.start.x,
        h: point.y - state.drag.start.y,
        color: state.color,
        stroke: state.stroke
      };
    }
    paint();
  });

  function endDrag(event) {
    if (!state.drag) {
      return;
    }
    const point = pointFromEvent(canvas, event, cssSize.width, cssSize.height);
    const drag = state.drag;
    state.drag = null;
    if (drag.type === 'pen') {
      const points = [...(drag.points || []), point];
      if (points.length > 1) {
        commit({
          id: uid(),
          type: 'pen',
          points,
          color: state.color,
          stroke: state.stroke
        });
      } else {
        state.preview = null;
        paint();
      }
      return;
    }
    const start = drag.start;
    const type = drag.type;
    if (type === 'arrow') {
      commit({
        id: uid(),
        type: 'arrow',
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: point.y,
        color: state.color,
        stroke: state.stroke
      });
    } else if (type === 'rect') {
      commit({
        id: uid(),
        type: 'rect',
        x: start.x,
        y: start.y,
        w: point.x - start.x,
        h: point.y - start.y,
        color: state.color,
        stroke: state.stroke
      });
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    state.drag = null;
    state.preview = null;
    paint();
  });

  textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = textInput.value.trim();
      if (value) {
        commit({
          id: uid(),
          type: 'text',
          x: Number(textInput.dataset.x),
          y: Number(textInput.dataset.y),
          text: value,
          color: state.color,
          stroke: state.stroke
        });
      }
      textInput.hidden = true;
    }
    if (event.key === 'Escape') {
      textInput.hidden = true;
    }
  });
  textInput.addEventListener('blur', () => {
    textInput.hidden = true;
  });

  return {
    getDrawings() {
      return state.drawings.slice();
    },
    setDrawings(next) {
      state.drawings = Array.isArray(next) ? [...next] : [];
      paint();
    },
    setMapUrl(url) {
      state.mapUrl = url || '';
      syncMap();
    },
    syncLabels() {
      const scope = fsShell || root;
      const label = scope.querySelector('[data-tac-upload-label]');
      if (label) {
        label.textContent = t('ops.map.upload');
      }
      empty.textContent = t('ops.map.empty');
      renderBar();
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      state.fullscreen = false;
      applyFullscreen(false);
      document.documentElement.classList.remove('overlay-lock');
      document.body.style.overflow = '';
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  };
}

export function mountMapViewer(root, { mapUrl, drawings = [] } = {}) {
  root.innerHTML = `
    <div class="tac-viewer">
      <div class="tac-viewport" data-tac-viewport>
        <div class="tac-view-stage" data-tac-stage>
          ${
            mapUrl
              ? `<div class="tac-frame">
                  <img class="tac-map" data-tac-image src="${escapeHtml(mapUrl)}" alt="${escapeHtml(t('ops.map'))}">
                  <canvas class="tac-canvas" data-tac-canvas></canvas>
                </div>`
              : `<p class="tac-empty">${escapeHtml(t('ops.noMap'))}</p>`
          }
        </div>
      </div>
      <div class="tac-zoom-controls" role="toolbar" aria-label="${escapeHtml(t('ops.zoomHint'))}">
        <button class="btn" type="button" data-tac-zoom-out title="${escapeHtml(t('org.zoomOut'))}">−</button>
        <button class="btn" type="button" data-tac-reset>${escapeHtml(t('org.reset'))}</button>
        <button class="btn" type="button" data-tac-zoom-in title="${escapeHtml(t('org.zoomIn'))}">+</button>
      </div>
    </div>
  `;

  const viewport = root.querySelector('[data-tac-viewport]');
  const stage = root.querySelector('[data-tac-stage]');
  const frame = root.querySelector('.tac-frame');
  const image = root.querySelector('[data-tac-image]');
  const canvas = root.querySelector('[data-tac-canvas]');
  let scale = 1;
  let panX = 0;
  let panY = 0;

  function applyTransform() {
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function paint() {
    if (!frame || !canvas) {
      return;
    }
    const fitted = fitCanvas(canvas, frame);
    fitted.ctx.clearRect(0, 0, fitted.width, fitted.height);
    drawMarkings(fitted.ctx, drawings, fitted.width, fitted.height);
  }

  if (frame) {
    const observer = new ResizeObserver(() => paint());
    observer.observe(frame);
    if (image?.complete) {
      paint();
    }
    image?.addEventListener('load', paint);
  }

  const pointers = new Map();
  let pinch = 0;
  let dragging = false;
  let originX = 0;
  let originY = 0;
  let startX = 0;
  let startY = 0;

  viewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) {
      return;
    }
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragging = true;
      originX = event.clientX;
      originY = event.clientY;
      startX = panX;
      startY = panY;
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinch) {
      const pts = [...pointers.values()];
      const next = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      scale = clamp(scale * (next / pinch), MIN_SCALE, MAX_SCALE);
      pinch = next;
      applyTransform();
      return;
    }
    if (dragging) {
      panX = startX + (event.clientX - originX);
      panY = startY + (event.clientY - originY);
      applyTransform();
    }
  });
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinch = 0;
    }
    if (pointers.size === 0) {
      dragging = false;
    }
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      scale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      applyTransform();
    },
    { passive: false }
  );

  root.querySelector('[data-tac-zoom-in]')?.addEventListener('click', () => {
    scale = clamp(scale * 1.2, MIN_SCALE, MAX_SCALE);
    applyTransform();
  });
  root.querySelector('[data-tac-zoom-out]')?.addEventListener('click', () => {
    scale = clamp(scale * 0.85, MIN_SCALE, MAX_SCALE);
    applyTransform();
  });
  root.querySelector('[data-tac-reset]')?.addEventListener('click', () => {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  });

  return {
    paint,
    resetView() {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    }
  };
}
