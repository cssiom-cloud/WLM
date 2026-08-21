import { hideLoading, showLoading, showToast } from './ui.js';
import { t } from './i18n.js';

const HTML_TO_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
const PAPER = '#ffffff';

function paperRoot() {
  return document.querySelector('#memo-paper');
}

function safeFileName(subject) {
  const base = String(subject || 'memorandum')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `WLR-Memo-${base || 'document'}`;
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

async function waitForExportLayout() {
  try {
    if (document.fonts?.load) {
      await Promise.all([document.fonts.load('400 16px Sarabun'), document.fonts.load('700 16px Sarabun'), document.fonts.ready]);
    }
  } catch {
    /* Capture even if Sarabun is still warming up. */
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function loadExportLibs() {
  const [imageMod, jsPdfMod] = await Promise.all([import(HTML_TO_IMAGE_URL), import(JSPDF_URL)]);
  const toCanvas = imageMod.toCanvas || imageMod.default?.toCanvas;
  const toJpeg = imageMod.toJpeg || imageMod.default?.toJpeg;
  const getFontEmbedCSS = imageMod.getFontEmbedCSS || imageMod.default?.getFontEmbedCSS;
  const jsPDF =
    jsPdfMod.jsPDF || jsPdfMod.default?.jsPDF || (typeof jsPdfMod.default === 'function' ? jsPdfMod.default : null);
  if ((!toCanvas && !toJpeg) || !jsPDF) {
    throw new Error('Export libraries could not be loaded.');
  }
  return { toCanvas, toJpeg, getFontEmbedCSS, jsPDF };
}

function captureFilter(node) {
  if (!(node instanceof Element)) {
    return true;
  }
  return !node.classList.contains('memo-chrome');
}

function writePdf(jsPDF, shot, filename) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = pageWidth / shot.width;
  const pageHeightPx = pageHeight / ratio;
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
    pdf.addImage(slice.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageWidth, sliceH * ratio);
    y += sliceH;
  }
  pdf.save(filename);
}

async function capturePaper(root, libs) {
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: PAPER,
    quality: 0.94,
    filter: captureFilter,
    skipAutoScale: true,
    style: {
      backgroundColor: PAPER,
      backgroundImage: 'none',
      transform: 'none',
      width: '210mm',
      minHeight: '297mm'
    }
  };
  if (libs.getFontEmbedCSS) {
    try {
      options.fontEmbedCSS = await libs.getFontEmbedCSS(root);
    } catch {
      /* Live stylesheet fonts are enough if embed fails. */
    }
  }
  if (libs.toCanvas) {
    try {
      return await libs.toCanvas(root, options);
    } catch {
      /* Fall through to JPEG capture. */
    }
  }
  if (!libs.toJpeg) {
    throw new Error(t('memo.export.failed'));
  }
  const dataUrl = await libs.toJpeg(root, options);
  const image = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = () => reject(new Error(t('memo.export.failed')));
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

async function runExport({ subject, format }) {
  const root = paperRoot();
  if (!root) {
    throw new Error('Memorandum paper was not found.');
  }
  showLoading(t('memo.export.generating'), 120000);
  document.body.classList.add('is-exporting');
  try {
    await waitForExportLayout();
    await waitForImages(root);
    const libs = await loadExportLibs();
    const shot = await capturePaper(root, libs);
    const name = safeFileName(subject);
    if (format === 'jpg') {
      downloadDataUrl(shot.toDataURL('image/jpeg', 0.94), `${name}.jpg`);
    } else {
      writePdf(libs.jsPDF, shot, `${name}.pdf`);
    }
    showToast(t('memo.export.ready'), 'success');
  } catch (error) {
    showToast(error.message || t('memo.export.failed'), 'error', 5000);
  } finally {
    document.body.classList.remove('is-exporting');
    hideLoading();
  }
}

export async function handleMemoPDF(options = {}) {
  return runExport({ ...options, format: 'pdf' });
}

export async function handleMemoJPG(options = {}) {
  return runExport({ ...options, format: 'jpg' });
}
