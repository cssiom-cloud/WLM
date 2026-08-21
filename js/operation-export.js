import { hideLoading, showLoading, showToast } from './ui.js';
import { t } from './i18n.js';
import { renderMapStill } from './tactical-map.js';

// html2canvas + jspdf are loaded on demand from CDN (no React/npm bundle).
const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';

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

function pageBackground() {
  return getComputedStyle(document.body).backgroundColor || '#ffffff';
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

async function loadExportLibs() {
  const [html2canvasMod, jsPdfMod] = await Promise.all([import(HTML2CANVAS_URL), import(JSPDF_URL)]);
  const html2canvas = html2canvasMod.default || html2canvasMod.html2canvas;
  const jsPDF =
    jsPdfMod.jsPDF || jsPdfMod.default?.jsPDF || (typeof jsPdfMod.default === 'function' ? jsPdfMod.default : null);
  if (!html2canvas || !jsPDF) {
    throw new Error('Export libraries could not be loaded.');
  }
  return { html2canvas, jsPDF };
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
    slice.getContext('2d').drawImage(shot, 0, y, shot.width, sliceH, 0, 0, shot.width, sliceH);
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, sliceH * ratio);
    y += sliceH;
  }
  pdf.save(filename);
}

export async function handleExportPDF({ title, mapUrl, drawings, format = 'pdf' } = {}) {
  const root = dossierRoot();
  if (!root) {
    throw new Error('Operation dossier was not found.');
  }
  const exportButtons = [...document.querySelectorAll('[data-export]')];
  exportButtons.forEach((button) => {
    button.disabled = true;
  });
  showLoading(t('ops.export.generating'), 120000);
  document.body.classList.add('is-exporting');
  let prep = null;
  try {
    prep = await prepareExportView(root, mapUrl, drawings);
    await waitForImages(root);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { html2canvas, jsPDF } = await loadExportLibs();
    const shot = await html2canvas(root, {
      scale: Math.min(2, 1600 / Math.max(1, root.offsetWidth)),
      useCORS: true,
      backgroundColor: pageBackground(),
      logging: false,
      imageTimeout: 15000,
      ignoreElements: (node) =>
        node.id === 'wlr-notice' ||
        node.classList?.contains('ops-chrome') ||
        node.classList?.contains('tac-zoom-controls') ||
        node.classList?.contains('ops-zoom-hint')
    });
    const name = safeFileName(title);
    if (format === 'jpg') {
      downloadDataUrl(shot.toDataURL('image/jpeg', 0.92), `${name}.jpg`);
    } else {
      writePdf(jsPDF, shot, `${name}.pdf`);
    }
    showToast(t('ops.export.ready'), 'success');
  } catch (error) {
    showToast(error.message || t('ops.export.failed'), 'error', 5000);
  } finally {
    restoreExportView(prep);
    document.body.classList.remove('is-exporting');
    exportButtons.forEach((button) => {
      button.disabled = false;
    });
    hideLoading();
  }
}
