import { rasterizeLiveMap, renderMapStill } from './tactical-map.js';

const HTML_TO_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
const PAPER = '#ffffff';
const INK = '#122033';
const MUTED = '#334155';
const NAVY = '#111827';
const BAR = '#1e293b';

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

async function makeMapStill(root, extras = {}) {
  const host = root.querySelector('.tactical-map-host');
  const liveImage = host?.querySelector('img.tac-map, [data-tac-image]');
  const mapUrl = extras.mapUrl || liveImage?.currentSrc || liveImage?.src || '';
  const drawings = extras.drawings || [];
  let still = rasterizeLiveMap(host, drawings);
  if (!still && mapUrl) {
    still = await renderMapStill(mapUrl, drawings, 1100, 620);
  }
  return { still, mapUrl };
}

function textOf(root, selector) {
  return root.querySelector(selector)?.textContent?.trim() || '';
}

function makeStampDataUrl(label, color) {
  const size = 240;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 20px Prompt, Inter, sans-serif';
  const words = String(label || 'RESTRICTED').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 150 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) {
    lines.push(line);
  }
  const start = size / 2 - ((lines.length - 1) * 22) / 2;
  lines.forEach((item, index) => {
    ctx.fillText(item, size / 2, start + index * 22);
  });
  return canvas.toDataURL('image/png');
}

function applyInline(node, css) {
  node.style.cssText = css;
  return node;
}

function buildOpsPrintSheet(liveRoot, still, mapUrl) {
  const sheet = document.createElement('div');
  sheet.setAttribute('data-ops-print', '1');
  applyInline(
    sheet,
    `box-sizing:border-box;width:794px;background:${PAPER};color:${INK};padding:36px 40px 48px;border:2px solid ${BAR};font-family:Prompt, Inter, sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;`
  );

  const css = document.createElement('style');
  css.textContent = `
    [data-ops-print] * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    [data-ops-print] table { border-collapse: collapse; }
  `;
  sheet.appendChild(css);

  const logoSrc = liveRoot.querySelector('.ops-doc-logo')?.getAttribute('src') || '';
  if (logoSrc) {
    const brand = applyInline(document.createElement('div'), 'text-align:center;margin:0 0 16px;');
    const logo = document.createElement('img');
    logo.src = logoSrc;
    logo.alt = '';
    logo.width = 92;
    logo.height = 92;
    applyInline(
      logo,
      'width:92px;height:92px;border:1px solid #cbd5e1;border-radius:50%;background:#ffffff;padding:3px;object-fit:contain;'
    );
    brand.appendChild(logo);
    sheet.appendChild(brand);
  }

  const head = applyInline(
    document.createElement('table'),
    `width:100%;border-collapse:collapse;background:${NAVY};color:#ffffff;margin:0 0 18px;`
  );
  const headRow = document.createElement('tr');
  const headLeft = applyInline(
    document.createElement('td'),
    'padding:18px 22px;color:#ffffff;vertical-align:middle;background:#111827;'
  );
  const command = applyInline(
    document.createElement('div'),
    'color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.16em;font-family:Prompt, Inter, sans-serif;'
  );
  command.textContent = textOf(liveRoot, '.ops-doc-command') || 'W.L.R COMMAND';
  const banner = applyInline(
    document.createElement('div'),
    'color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-top:4px;font-family:Prompt, Inter, sans-serif;'
  );
  banner.textContent = textOf(liveRoot, '.ops-doc-banner');
  headLeft.append(command, banner);
  const headRight = applyInline(
    document.createElement('td'),
    'padding:18px 22px;color:#ffffff;text-align:right;vertical-align:middle;width:240px;background:#111827;'
  );
  liveRoot.querySelectorAll('.ops-doc-meta > div').forEach((row) => {
    const line = applyInline(
      document.createElement('div'),
      'color:#ffffff;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;margin:2px 0;font-family:Prompt, Inter, sans-serif;'
    );
    const dt = row.querySelector('dt')?.textContent?.trim() || '';
    const dd = row.querySelector('dd')?.textContent?.trim() || '';
    line.textContent = dt && dd ? `${dt}: ${dd}` : `${dt}${dd}`;
    headRight.appendChild(line);
  });
  headRow.append(headLeft, headRight);
  head.appendChild(headRow);
  sheet.appendChild(head);

  function addSection(title, bodyNode) {
    const block = applyInline(document.createElement('div'), 'margin:0 0 18px;');
    const heading = applyInline(
      document.createElement('div'),
      `background:${BAR};color:#ffffff;padding:10px 14px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 10px;font-family:Prompt, Inter, sans-serif;`
    );
    heading.textContent = title;
    block.append(heading, bodyNode);
    sheet.appendChild(block);
  }

  const overview = liveRoot.querySelector('.ops-doc-grid');
  if (overview) {
    const table = overview.cloneNode(true);
    table.querySelectorAll('img').forEach((image) => image.remove());
    applyInline(table, `width:100%;border-collapse:collapse;color:${INK};background:${PAPER};`);
    table.querySelectorAll('th, td').forEach((cell) => {
      const isHead = cell.tagName === 'TH';
      applyInline(
        cell,
        `border:1px solid #94a3b8;padding:12px 14px;text-align:left;color:${isHead ? MUTED : INK};background:${isHead ? '#e2e8f0' : PAPER};font-size:${isHead ? '11px' : '14px'};font-weight:${isHead ? '800' : '400'};letter-spacing:${isHead ? '0.08em' : '0'};text-transform:${isHead ? 'uppercase' : 'none'};font-family:Prompt, Inter, sans-serif;`
      );
      cell.textContent = cell.textContent.trim();
    });
    addSection(textOf(liveRoot, '.ops-doc-section > h2') || 'I. Operation Overview', table);
  }

  const briefingTitle = [...liveRoot.querySelectorAll('.ops-doc-section > h2')].map((node) => node.textContent.trim());
  const briefing = liveRoot.querySelector('.ops-doc-box');
  if (briefing) {
    const box = applyInline(
      document.createElement('div'),
      `color:${INK};font-size:14px;line-height:1.75;white-space:pre-wrap;font-family:Prompt, Inter, sans-serif;`
    );
    box.textContent = briefing.textContent || '';
    addSection(briefingTitle[1] || 'II. Tactical Briefing', box);
  }

  const mapTitle = briefingTitle[2] || 'III. Tactical Map';
  const mapBox = applyInline(document.createElement('div'), `background:${PAPER};`);
  const source = still || mapUrl;
  if (source) {
    const image = document.createElement('img');
    image.className = 'ops-map-still';
    image.alt = 'Tactical map';
    image.src = source;
    mapBox.appendChild(image);
  } else {
    const empty = applyInline(document.createElement('div'), `color:${MUTED};font-size:14px;`);
    empty.textContent = textOf(liveRoot, '.ops-doc-map p') || 'No map';
    mapBox.appendChild(empty);
  }
  addSection(mapTitle, mapBox);

  const aarTitle = briefingTitle[3] || 'IV. After-Action Report';
  const aarPrint = liveRoot.querySelector('.ops-aar-print');
  const aarBox = applyInline(
    document.createElement('div'),
    `color:${INK};font-size:14px;line-height:1.6;font-family:Prompt, Inter, sans-serif;`
  );
  if (aarPrint) {
    aarPrint.querySelectorAll('.ops-aar-card').forEach((card) => {
      const item = applyInline(document.createElement('div'), 'margin:0 0 10px;');
      const name = applyInline(document.createElement('div'), 'font-weight:700;margin:0 0 4px;');
      name.textContent = card.querySelector('strong')?.textContent || '';
      const body = applyInline(document.createElement('div'), 'white-space:pre-wrap;');
      body.textContent = card.querySelector('p')?.textContent || '';
      item.append(name, body);
      aarBox.appendChild(item);
    });
    if (!aarBox.childNodes.length) {
      aarBox.textContent = aarPrint.textContent.trim();
    }
  }
  addSection(aarTitle, aarBox);

  const authTitle = textOf(liveRoot, '.ops-auth > h2') || briefingTitle[4] || 'V. Authorization & Signoff';
  const signedName = textOf(liveRoot, '.ops-signature') || '';
  const unsigned = !signedName;
  const displayName =
    signedName || textOf(liveRoot, '.ops-unsigned') || textOf(liveRoot, '.is-unsigned') || '................................';
  const role = textOf(liveRoot, '.ops-auth-role');
  const kicker = textOf(liveRoot, '.ops-auth-kicker');
  const stampLabel =
    textOf(liveRoot, '.ops-stamp-copy') || liveRoot.querySelector('.ops-stamp')?.textContent?.trim() || 'RESTRICTED DOCUMENT';
  const approved = liveRoot.querySelector('.ops-stamp-approved');
  const stampColor = approved ? '#1c6b46' : '#9b1c2c';

  const authTable = applyInline(
    document.createElement('table'),
    `width:100%;border-collapse:collapse;background:${PAPER};`
  );
  const authRow = document.createElement('tr');
  const signCell = applyInline(
    document.createElement('td'),
    'width:70%;text-align:center;vertical-align:bottom;padding:12px 16px 0;background:#ffffff;'
  );
  const kickerEl = applyInline(
    document.createElement('div'),
    `color:${MUTED};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;`
  );
  kickerEl.textContent = kicker;
  const signEl = applyInline(
    document.createElement('div'),
    unsigned
      ? `color:${MUTED};font-size:18px;margin:18px 0 8px;`
      : 'color:#1b3a6b;font-family:Caveat, Sriracha, cursive;font-size:36px;font-weight:600;margin:8px 0;'
  );
  signEl.textContent = displayName;
  const nameEl = applyInline(document.createElement('div'), `color:${INK};font-size:14px;`);
  nameEl.textContent = `(${signedName || '....................'})`;
  const roleEl = applyInline(
    document.createElement('div'),
    `color:${MUTED};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;border-top:1px solid #94a3b8;margin-top:8px;padding-top:8px;`
  );
  roleEl.textContent = role;
  signCell.append(kickerEl, signEl, nameEl, roleEl);

  const stampCell = applyInline(
    document.createElement('td'),
    'width:30%;text-align:center;vertical-align:middle;padding:8px;background:#ffffff;'
  );
  const stampImg = document.createElement('img');
  stampImg.alt = stampLabel;
  stampImg.width = 118;
  stampImg.height = 118;
  stampImg.src = makeStampDataUrl(stampLabel, stampColor);
  applyInline(stampImg, 'width:118px;height:118px;');
  stampCell.appendChild(stampImg);
  authRow.append(signCell, stampCell);
  authTable.appendChild(authRow);
  addSection(authTitle, authTable);

  const footer = applyInline(
    document.createElement('div'),
    `margin-top:16px;padding-top:10px;border-top:2px solid #334155;text-align:center;color:#64748b;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-family:Prompt, Inter, sans-serif;`
  );
  footer.textContent = textOf(liveRoot, '.ops-doc-footer');
  sheet.appendChild(footer);
  return sheet;
}

async function fitPrintImage(image, maxWidth, maxHeight) {
  if (!image) {
    return;
  }
  await new Promise((resolve) => {
    if (image.complete && image.naturalWidth) {
      resolve();
      return;
    }
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });
  const naturalWidth = image.naturalWidth || maxWidth;
  const naturalHeight = image.naturalHeight || maxHeight;
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  image.style.cssText = `display:block;width:${width}px;height:${height}px;max-width:${width}px;max-height:${height}px;object-fit:contain;background:#ffffff;margin:8px 0 0;border:1px solid #94a3b8;`;
}

export function snapshotPageTheme() {
  return {
    htmlClass: document.documentElement.className,
    theme: document.documentElement.getAttribute('data-theme'),
    htmlStyle: document.documentElement.getAttribute('style'),
    bodyClass: document.body.className,
    bodyStyle: document.body.getAttribute('style')
  };
}

export function restorePageTheme(snap) {
  if (!snap) {
    return;
  }
  document.documentElement.className = snap.htmlClass;
  if (snap.theme == null) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', snap.theme);
  }
  if (snap.htmlStyle == null) {
    document.documentElement.removeAttribute('style');
  } else {
    document.documentElement.setAttribute('style', snap.htmlStyle);
  }
  document.body.className = snap.bodyClass;
  if (snap.bodyStyle == null) {
    document.body.removeAttribute('style');
  } else {
    document.body.setAttribute('style', snap.bodyStyle);
  }
}

async function loadHtmlToImage() {
  const imageMod = await import(/* @vite-ignore */ HTML_TO_IMAGE_URL);
  const toJpeg = imageMod.toJpeg || imageMod.default?.toJpeg;
  const toCanvas = imageMod.toCanvas || imageMod.default?.toCanvas;
  const getFontEmbedCSS = imageMod.getFontEmbedCSS || imageMod.default?.getFontEmbedCSS;
  if (!toJpeg && !toCanvas) {
    throw new Error('Export libraries could not be loaded.');
  }
  return { toJpeg, toCanvas, getFontEmbedCSS };
}

export async function captureOpsPrintJpeg(liveRoot, extras = {}) {
  const themeSnap = snapshotPageTheme();
  const { still, mapUrl } = await makeMapStill(liveRoot, extras);
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;z-index:0;pointer-events:none;';
  const sheet = buildOpsPrintSheet(liveRoot, still, mapUrl);
  holder.appendChild(sheet);
  document.body.appendChild(holder);
  try {
    await fitPrintImage(sheet.querySelector('.ops-map-still'), 714, 380);
    await waitForImages(sheet);
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => {});
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 80));
    const { toJpeg, toCanvas, getFontEmbedCSS } = await loadHtmlToImage();
    const width = 794;
    const height = Math.max(sheet.scrollHeight, sheet.offsetHeight) + 16;
    const options = {
      cacheBust: false,
      pixelRatio: 2,
      backgroundColor: PAPER,
      width,
      height,
      skipAutoScale: true,
      style: {
        position: 'static',
        left: '0',
        top: '0',
        transform: 'none',
        background: PAPER,
        backgroundColor: PAPER,
        color: INK,
        width: '794px',
        overflow: 'visible',
        margin: '0',
        fontFamily: 'Prompt, Inter, sans-serif'
      }
    };
    if (getFontEmbedCSS) {
      try {
        options.fontEmbedCSS = await getFontEmbedCSS(sheet);
      } catch {
        /* Live stylesheet fonts are enough if embed fails. */
      }
    }
    if (toJpeg) {
      return toJpeg(sheet, { ...options, quality: 0.92 });
    }
    const canvas = await toCanvas(sheet, options);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    holder.remove();
    restorePageTheme(themeSnap);
  }
}
