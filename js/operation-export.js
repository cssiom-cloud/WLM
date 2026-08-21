import { hideLoading, showLoading, showToast } from './ui.js';
import { t } from './i18n.js';
import { renderMapStill } from './tactical-map.js';

// html-to-image avoids html2canvas crashing on CSS color() / color-mix().
// jspdf places the captured image onto A4 pages.
const HTML_TO_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
const PAPER = '#f4f6f8';

function dossierRoot() {
  return document.querySelector('#op-dossier');
}

function safeFileName(title) {
  const base = String(title || 'operation')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `WLR-Operation-${base || 'dossier'}`;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function waitForImages(root) {
  const images = [...root.querySelectorAll('img')];
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        })
    )
  );
}

function setExportBusy(busy, format) {
  document.querySelectorAll('[data-export]').forEach((button) => {
    button.disabled = busy;
    const label = button.querySelector('.ops-export-label');
    const spin = button.querySelector('.ops-export-spin');
    const key = button.getAttribute('data-export') === 'jpg' ? 'ops.export.jpg' : 'ops.export.pdf';
    if (label) {
      label.textContent = busy && button.getAttribute('data-export') === format ? t('ops.export.generating') : t(key);
    }
    if (spin) {
      spin.hidden = !(busy && button.getAttribute('data-export') === format);
    }
  });
}

async function loadExportLibs() {
  const [imageMod, jsPdfMod] = await Promise.all([import(HTML_TO_IMAGE_URL), import(JSPDF_URL)]);
  const toCanvas = imageMod.toCanvas || imageMod.default?.toCanvas;
  const toJpeg = imageMod.toJpeg || imageMod.default?.toJpeg;
  const jsPDF =
    jsPdfMod.jsPDF || jsPdfMod.default?.jsPDF || (typeof jsPdfMod.default === 'function' ? jsPdfMod.default : null);
  if ((!toCanvas && !toJpeg) || !jsPDF) {
    throw new Error('Export libraries could not be loaded.');
  }
  return { toCanvas, toJpeg, jsPDF };
}

async function prepareExportView(root, mapUrl, drawings) {
  const viewer = root.querySelector('#map-viewer');
  const stage = viewer?.querySelector('[data-tac-stage]');
  const frame = viewer?.querySelector('.tac-frame');
  if (stage) {
    stage.style.transform = 'none';
  }
  let still = null;
  if (frame && mapUrl) {
    try {
      const dataUrl = await renderMapStill(mapUrl, drawings);
      still = document.createElement('img');
      still.className = 'tac-export-still';
      still.alt = '';
      still.crossOrigin = 'anonymous';
      still.src = dataUrl;
      frame.classList.add('is-export-still');
      frame.appendChild(still);
    } catch {
      still = null;
    }
  }
  return { stage, still, frame };
}

function restoreExportView(prep) {
  prep?.still?.remove();
  prep?.frame?.classList.remove('is-export-still');
}

function captureFilter(node) {
  if (!(node instanceof Element)) {
    return true;
  }
  return !(
    node.id === 'wlr-notice' ||
    node.classList.contains('ops-chrome') ||
    node.classList.contains('tac-zoom-controls') ||
    node.classList.contains('ops-zoom-hint') ||
    node.classList.contains('ops-export') ||
    node.classList.contains('ops-export-spin')
  );
}

function writePdf(jsPDF, shot, filename) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageWidth - margin * 2;
  const usableH = pageHeight - margin * 2;
  const ratio = usableW / shot.width;
  const pageHeightPx = usableH / ratio;
  let y = 0;
  let first = true;
  while (y < shot.height) {
    if (!first) {
      pdf.addPage();
    }
    first = false;
    const sliceH = Math.min(pageHeightPx, shot.height - y);
    const slice = document.createElement('canvas');
    slice.width = shot.width;
    slice.height = Math.max(1, Math.round(sliceH));
    const ctx = slice.getContext('2d');
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(shot, 0, y, shot.width, sliceH, 0, 0, shot.width, sliceH);
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, sliceH * ratio);
    y += sliceH;
  }
  pdf.save(filename);
}

async function captureDossier(root, libs) {
  const options = {
    cacheBust: true,
    pixelRatio: Math.min(2, 1600 / Math.max(1, root.offsetWidth)),
    backgroundColor: PAPER,
    quality: 0.92,
    filter: captureFilter,
    skipAutoScale: true,
    style: {
      backgroundColor: PAPER,
      backgroundImage: 'none'
    }
  };
  if (libs.toCanvas) {
    try {
      return await libs.toCanvas(root, options);
    } catch {
      /* Fall through to JPEG capture if canvas export fails. */
    }
  }
  if (!libs.toJpeg) {
    throw new Error(t('ops.export.failed'));
  }
  const dataUrl = await libs.toJpeg(root, options);
  const image = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = () => reject(new Error(t('ops.export.failed')));
    node.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return canvas;
}

async function runExport({ title, mapUrl, drawings, format }) {
  const root = dossierRoot();
  if (!root) {
    throw new Error('Operation dossier was not found.');
  }
  setExportBusy(true, format);
  showLoading(t('ops.export.generating'), 120000);
  document.body.classList.add('is-exporting');
  let prep = null;
  try {
    prep = await prepareExportView(root, mapUrl, drawings);
    await waitForImages(root);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const libs = await loadExportLibs();
    const shot = await captureDossier(root, libs);
    const name = safeFileName(title);
    if (format === 'jpg') {
      downloadDataUrl(shot.toDataURL('image/jpeg', 0.92), `${name}.jpg`);
    } else {
      writePdf(libs.jsPDF, shot, `${name}.pdf`);
    }
    showToast(t('ops.export.ready'), 'success');
  } catch (error) {
    showToast(error.message || t('ops.export.failed'), 'error', 5000);
  } finally {
    restoreExportView(prep);
    document.body.classList.remove('is-exporting');
    setExportBusy(false, format);
    hideLoading();
  }
}

export async function handleExportJPG(options = {}) {
  return runExport({ ...options, format: 'jpg' });
}

export async function handleExportPDF(options = {}) {
  return runExport({ ...options, format: 'pdf' });
}
