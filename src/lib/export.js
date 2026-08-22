import { rasterizeLiveMap, renderMapStill } from '../../js/tactical-map.js';
import { captureOpsPrintJpeg, restorePageTheme, snapshotPageTheme } from '../../js/ops-print-sheet.js';

const HTML_TO_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
const PAPER = '#ffffff';
const INK = '#122033';
const MUTED = '#334155';

function paintInk(node, color) {
  if (!(node instanceof Element)) {
    return;
  }
  node.style.setProperty('color', color, 'important');
  node.style.setProperty('-webkit-text-fill-color', color, 'important');
  node.style.setProperty('text-shadow', 'none', 'important');
  node.style.setProperty('filter', 'none', 'important');
  node.style.setProperty('opacity', '1', 'important');
}

function flattenExportClone(clonedDoc, clonedNode) {
  if (!clonedDoc || clonedDoc === document) {
    return;
  }
  const root = clonedNode || clonedDoc.querySelector('.ops-doc, .memo-paper') || clonedDoc.body;
  clonedDoc.documentElement.classList.remove('dark');
  clonedDoc.documentElement.setAttribute('data-theme', 'light');
  clonedDoc.documentElement.style.background = PAPER;
  clonedDoc.documentElement.style.color = INK;
  clonedDoc.body?.classList.add('is-exporting');
  if (clonedDoc.body) {
    clonedDoc.body.style.background = PAPER;
    clonedDoc.body.style.color = INK;
  }
  root.classList.add('is-print-sheet');
  root.style.setProperty('background', PAPER, 'important');
  root.style.setProperty('background-color', PAPER, 'important');
  root.style.setProperty('color', INK, 'important');
  root.style.setProperty('box-sizing', 'border-box', 'important');
  root.style.setProperty('overflow', 'visible', 'important');
  root.style.setProperty('transform', 'none', 'important');
  root.style.setProperty('filter', 'none', 'important');
  root.style.setProperty('max-width', 'none', 'important');

  if (root.classList.contains('memo-paper')) {
    root.style.setProperty('width', '794px', 'important');
    root.style.setProperty('min-height', '1123px', 'important');
    root.style.setProperty('padding', '88px 96px 96px', 'important');
  } else {
    root.style.setProperty('padding', '36px 40px 56px', 'important');
    root.style.setProperty('border', '2px solid #1e293b', 'important');
    root.style.setProperty('background', PAPER, 'important');
  }

  if (root.querySelector('.ops-map-still')) {
    root.querySelectorAll('.tactical-map-host').forEach((node) => node.remove());
  }
  root.querySelectorAll('.tac-zoom-controls, .tac-toolbar, [data-tac-bar], .ops-zoom-hint, .export-hide').forEach((node) => node.remove());
  root.querySelectorAll('.tac-viewport, .tac-stage, .tac-empty, .tac-viewer, .tactical-map-host').forEach((node) => {
    node.style.minHeight = '0';
    node.style.height = 'auto';
    node.style.maxWidth = '100%';
    node.style.width = '100%';
    node.style.boxSizing = 'border-box';
    node.style.overflow = 'visible';
    node.style.background = PAPER;
    node.style.border = '0';
    node.style.borderRadius = '0';
  });
  const stage = root.querySelector('.tac-view-stage, .tac-stage, [data-tac-stage]');
  if (stage) {
    stage.style.transform = 'none';
  }

  const authGrid = root.querySelector('.ops-auth-grid');
  if (authGrid) {
    authGrid.style.display = 'grid';
    authGrid.style.gridTemplateColumns = 'minmax(0, 1fr) 8.6rem';
    authGrid.style.gap = '1.25rem';
    authGrid.style.alignItems = 'end';
    authGrid.style.width = '100%';
    authGrid.style.background = PAPER;
    authGrid.style.color = INK;
    authGrid.style.visibility = 'visible';
    authGrid.style.opacity = '1';
  }
  const auth = root.querySelector('.ops-auth');
  if (auth) {
    auth.style.display = 'block';
    auth.style.background = PAPER;
    auth.style.color = INK;
    auth.style.minHeight = '9rem';
    auth.style.marginTop = '1.5rem';
    auth.style.visibility = 'visible';
    auth.style.opacity = '1';
    auth.style.pageBreakInside = 'avoid';
  }

  root.querySelectorAll('.ops-stamp, .memo-stamp').forEach((stamp) => {
    stamp.style.display = 'flex';
    stamp.style.alignItems = 'center';
    stamp.style.justifyContent = 'center';
    stamp.style.visibility = 'visible';
    stamp.style.opacity = '1';
    stamp.style.position = 'relative';
    stamp.style.transform = 'none';
    stamp.style.borderRadius = '50%';
    stamp.style.width = '8.2rem';
    stamp.style.height = '8.2rem';
    stamp.style.background = PAPER;
    if (stamp.classList.contains('ops-stamp-approved')) {
      stamp.style.color = '#1c6b46';
      stamp.style.border = '3px solid #1c6b46';
    } else {
      stamp.style.color = '#9b1c2c';
      stamp.style.border = '3px solid #9b1c2c';
    }
  });

  root.querySelectorAll('*').forEach((node) => {
    if (node.matches('img, canvas, svg, path, rect, circle, line, polygon')) {
      if (node.classList.contains('ops-doc-logo')) {
        node.style.width = '92px';
        node.style.height = '92px';
        node.style.objectFit = 'contain';
        node.style.borderRadius = '50%';
        node.style.border = '1px solid #cbd5e1';
        node.style.background = PAPER;
        node.style.padding = '3px';
      }
      return;
    }
    if (node.classList.contains('ops-doc-brand')) {
      node.style.display = 'flex';
      node.style.justifyContent = 'center';
      node.style.margin = '0 0 1.2rem';
    }
    if (node.classList.contains('ops-doc-footer')) {
      node.style.display = 'block';
      node.style.margin = '1rem 0 0';
      node.style.paddingTop = '0.7rem';
      node.style.borderTop = '2px solid #334155';
      node.style.textAlign = 'center';
      node.style.fontSize = '0.68rem';
      node.style.letterSpacing = '0.08em';
      node.style.textTransform = 'uppercase';
      paintInk(node, '#64748b');
      return;
    }
    if (node.closest('.tac-frame, .tac-map, .tactical-map-host')) {
      return;
    }
    if (node.closest('.ops-doc-brand')) {
      return;
    }
    if (node.classList.contains('ops-signature') || node.classList.contains('ops-sign-name')) {
      paintInk(node, '#1b3a6b');
      node.style.fontFamily = '"Caveat", "Sriracha", cursive';
      node.style.fontSize = '2.2rem';
      return;
    }
    if (node.closest('.ops-stamp-restricted, .ops-stamp-approved, .ops-stamp, .memo-stamp')) {
      return;
    }
    if (node.matches('.ops-doc-section > h2, .ops-auth > h2')) {
      node.style.setProperty('background', '#1e293b', 'important');
      node.style.setProperty('color', '#ffffff', 'important');
      node.style.setProperty('padding', '10px 14px', 'important');
      node.style.setProperty('margin', '0 0 12px', 'important');
      node.style.setProperty('letter-spacing', '0.1em', 'important');
      node.style.setProperty('text-transform', 'uppercase', 'important');
      node.style.setProperty('font-size', '0.8rem', 'important');
      paintInk(node, '#ffffff');
      return;
    }
    if (node.closest('.ops-doc-head')) {
      if (node.matches('.ops-doc-head')) {
        node.style.setProperty('display', 'grid', 'important');
        node.style.setProperty('grid-template-columns', 'minmax(0, 1.4fr) minmax(180px, 0.8fr)', 'important');
        node.style.setProperty('gap', '1rem', 'important');
        node.style.setProperty('background', '#111827', 'important');
        node.style.setProperty('padding', '18px 22px', 'important');
        node.style.setProperty('margin-bottom', '1.35rem', 'important');
      }
      if (node.classList.contains('ops-doc-meta')) {
        node.style.display = 'grid';
        node.style.gap = '0.25rem';
        node.style.textAlign = 'right';
        node.style.textTransform = 'uppercase';
        node.style.fontSize = '0.72rem';
      }
      paintInk(node, '#ffffff');
      return;
    }
    if (node.matches('table.ops-doc-grid, .ops-doc-grid')) {
      node.style.width = '100%';
      node.style.borderCollapse = 'collapse';
    }
    if (node.matches('th')) {
      node.style.setProperty('background', '#e2e8f0', 'important');
      node.style.setProperty('padding', '12px 14px', 'important');
      node.style.setProperty('border', '1px solid #94a3b8', 'important');
      paintInk(node, MUTED);
      return;
    }
    if (node.matches('td')) {
      node.style.setProperty('padding', '12px 14px', 'important');
      node.style.setProperty('border', '1px solid #94a3b8', 'important');
      paintInk(node, INK);
      return;
    }
    paintInk(node, root.classList.contains('memo-paper') ? '#000000' : INK);
  });
}

function safeFileName(subject, prefix = 'WLR') {
  const base = String(subject || 'document')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${prefix}-${base || 'document'}`;
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
          if (image.complete && image.naturalWidth) {
            resolve();
            return;
          }
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        })
    )
  );
}

async function captureOpsJpeg(liveRoot, extras = {}) {
  return captureOpsPrintJpeg(liveRoot, extras);
}

async function loadExportLibs() {
  const [imageMod, jsPdfMod] = await Promise.all([import(/* @vite-ignore */ HTML_TO_IMAGE_URL), import(/* @vite-ignore */ JSPDF_URL)]);
  const toJpeg = imageMod.toJpeg || imageMod.default?.toJpeg;
  const toCanvas = imageMod.toCanvas || imageMod.default?.toCanvas;
  const getFontEmbedCSS = imageMod.getFontEmbedCSS || imageMod.default?.getFontEmbedCSS;
  const jsPDF =
    jsPdfMod.jsPDF || jsPdfMod.default?.jsPDF || (typeof jsPdfMod.default === 'function' ? jsPdfMod.default : null);
  if ((!toJpeg && !toCanvas) || !jsPDF) {
    throw new Error('Export libraries could not be loaded.');
  }
  return { toJpeg, toCanvas, getFontEmbedCSS, jsPDF };
}

function captureFilter(node) {
  if (!(node instanceof Element)) {
    return true;
  }
  return !(
    node.classList.contains('export-hide') ||
    node.classList.contains('tac-zoom-controls') ||
    node.classList.contains('tac-toolbar') ||
    node.hasAttribute('data-tac-bar') ||
    node.classList.contains('ops-zoom-hint')
  );
}

function constrainMapHosts(root) {
  const restores = [];
  root.querySelectorAll('.tactical-map-host').forEach((host) => {
    const nodes = [host, ...host.querySelectorAll('.tac-viewport, .tac-stage, .tac-viewer, .tac-view-stage, [data-tac-stage]')];
    nodes.forEach((node) => {
      restores.push({
        node,
        minHeight: node.style.minHeight,
        height: node.style.height,
        overflow: node.style.overflow,
        transform: node.style.transform
      });
    });
    const frame = host.querySelector('.tac-frame, img.tac-map');
    const height = Math.min(Math.max(frame?.offsetHeight || 0, 220), 420);
    host.style.minHeight = '0';
    host.style.height = 'auto';
    host.style.overflow = 'visible';
    host.querySelectorAll('.tac-viewport, .tac-stage, .tac-viewer').forEach((node) => {
      node.style.minHeight = '0';
      node.style.height = `${height}px`;
      node.style.overflow = 'hidden';
    });
    host.querySelectorAll('.tac-view-stage, [data-tac-stage]').forEach((node) => {
      node.style.transform = 'none';
    });
  });
  return () => {
    restores.forEach((item) => {
      item.node.style.minHeight = item.minHeight;
      item.node.style.height = item.height;
      item.node.style.overflow = item.overflow;
      item.node.style.transform = item.transform;
    });
  };
}

async function insertMapStill(root, { mapUrl, drawings } = {}) {
  const host = root.querySelector('.tactical-map-host');
  if (!host) {
    return () => {};
  }
  let still = rasterizeLiveMap(host, drawings || []);
  if (!still && mapUrl) {
    still = await renderMapStill(mapUrl, drawings || [], 1200, 720);
  }
  const restores = [];
  if (!still) {
    const canvas = host.querySelector('canvas.tac-canvas');
    const image = host.querySelector('img.tac-map, [data-tac-image]');
    if (canvas) {
      restores.push({ node: canvas, display: canvas.style.display });
      canvas.style.display = 'none';
    }
    [host, ...host.querySelectorAll('.tac-viewport, .tac-stage, .tac-viewer')].forEach((node) => {
      restores.push({
        node,
        minHeight: node.style.minHeight,
        height: node.style.height,
        maxHeight: node.style.maxHeight,
        overflow: node.style.overflow
      });
      node.style.minHeight = '0';
      node.style.height = 'auto';
      node.style.maxHeight = '26rem';
      node.style.overflow = 'hidden';
    });
    if (image) {
      restores.push({ node: image, maxHeight: image.style.maxHeight, width: image.style.width, height: image.style.height });
      image.style.width = '100%';
      image.style.height = 'auto';
      image.style.maxHeight = '26rem';
    }
    return () => {
      restores.forEach((item) => {
        if ('display' in item) {
          item.node.style.display = item.display;
        }
        if ('minHeight' in item) {
          item.node.style.minHeight = item.minHeight;
          item.node.style.height = item.height;
          item.node.style.maxHeight = item.maxHeight;
          item.node.style.overflow = item.overflow;
        }
        if ('width' in item && !('minHeight' in item)) {
          item.node.style.maxHeight = item.maxHeight;
          item.node.style.width = item.width;
          item.node.style.height = item.height;
        }
      });
    };
  }
  const image = document.createElement('img');
  image.className = 'ops-map-still';
  image.alt = '';
  image.src = still;
  image.style.display = 'block';
  image.style.width = '100%';
  image.style.maxHeight = '26rem';
  image.style.height = 'auto';
  image.style.objectFit = 'contain';
  host.insertAdjacentElement('afterend', image);
  host.style.display = 'none';
  await waitForImages(root);
  return () => {
    image.remove();
    host.style.display = '';
  };
}

async function captureJpeg(root, extras = {}) {
  if (root.classList.contains('ops-doc')) {
    return captureOpsJpeg(root, extras);
  }
  const themeSnap = snapshotPageTheme();
  await waitForImages(root);
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }
  document.body.classList.add('is-exporting');
  const wrap = root.closest('.memo-paper-wrap');
  const previousOverflow = wrap?.style.overflow;
  if (wrap) {
    wrap.style.overflow = 'visible';
  }
  const restoreStill = await insertMapStill(root, extras);
  const restoreMaps = root.querySelector('.ops-map-still') ? () => {} : constrainMapHosts(root);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 80));
  try {
    const { toJpeg, toCanvas, getFontEmbedCSS } = await loadExportLibs();
    const isMemo = root.classList.contains('memo-paper');
    const width = isMemo ? 794 : Math.max(root.scrollWidth, root.offsetWidth, 720);
    const height = Math.max(root.scrollHeight, root.offsetHeight, isMemo ? 1123 : 0);
    const options = {
      cacheBust: true,
      pixelRatio: Math.min(2, 1400 / Math.max(1, width)),
      backgroundColor: PAPER,
      width,
      height,
      style: {
        transform: 'none',
        background: PAPER,
        backgroundColor: PAPER,
        color: INK,
        filter: 'none',
        boxSizing: 'border-box',
        overflow: isMemo ? 'hidden' : 'visible',
        width: isMemo ? '794px' : undefined,
        margin: '0'
      },
      filter: captureFilter,
      onclone: flattenExportClone
    };
    if (getFontEmbedCSS) {
      try {
        options.fontEmbedCSS = await getFontEmbedCSS(root);
      } catch {
        /* Live stylesheet fonts are enough if embed fails. */
      }
    }
    if (toJpeg) {
      return toJpeg(root, { ...options, quality: 0.92 });
    }
    const canvas = await toCanvas(root, options);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    restoreMaps();
    restoreStill();
    if (wrap) {
      wrap.style.overflow = previousOverflow || '';
    }
    restorePageTheme(themeSnap);
  }
}

export async function exportNodeAsJpg(root, subject, prefix, extras) {
  const dataUrl = await captureJpeg(root, extras);
  downloadDataUrl(dataUrl, `${safeFileName(subject, prefix)}.jpg`);
}

export async function exportNodeAsPdf(root, subject, prefix, extras) {
  const dataUrl = await captureJpeg(root, extras);
  const { jsPDF } = await loadExportLibs();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve) => {
    image.onload = resolve;
    image.onerror = resolve;
  });
  const ratio = image.height && image.width ? image.height / image.width : pageHeight / pageWidth;
  const drawHeight = pageWidth * ratio;
  if (drawHeight <= pageHeight) {
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, drawHeight);
  } else {
    let remaining = drawHeight;
    let offsetY = 0;
    const sliceHeight = pageHeight;
    while (remaining > 0) {
      if (offsetY > 0) {
        pdf.addPage();
      }
      pdf.addImage(dataUrl, 'JPEG', 0, -offsetY, pageWidth, drawHeight);
      remaining -= sliceHeight;
      offsetY += sliceHeight;
    }
  }
  pdf.save(`${safeFileName(subject, prefix)}.pdf`);
}
