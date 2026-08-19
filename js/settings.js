import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { showStatus } from './ui.js';
import { applyAccent, readStoredAccent } from './theme.js';
import { fetchOwnSettings, saveOwnSettings, writeActivityLog } from './command-services.js';

let currentUser = null;

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function drawColorWheel(canvas) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const inner = outer - 28;
  ctx.clearRect(0, 0, size, size);
  for (let angle = 0; angle < 360; angle += 1) {
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${angle} 100% 50%)`;
    ctx.lineWidth = outer - inner;
    ctx.arc(cx, cy, (outer + inner) / 2, ((angle - 90) * Math.PI) / 180, ((angle - 89) * Math.PI) / 180);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated') || '#fff';
  ctx.arc(cx, cy, inner - 8, 0, Math.PI * 2);
  ctx.fill();
}

function bindColorWheel(canvas, hexInput, preview, onPick) {
  drawColorWheel(canvas);
  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (event.clientX - rect.left) * scale - canvas.width / 2;
    const y = (event.clientY - rect.top) * scale - canvas.height / 2;
    const distance = Math.hypot(x, y);
    const outer = canvas.width / 2 - 6;
    const inner = outer - 28;
    if (distance < inner - 4 || distance > outer + 4) {
      return;
    }
    let hue = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (hue < 0) {
      hue += 360;
    }
    const hex = hslToHex(hue, 100, 50);
    hexInput.value = hex;
    preview.style.background = hex;
    onPick(hex);
  };

  let dragging = false;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
    pick(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragging) {
      pick(event);
    }
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
}

bootCommandShell('settings');

requireAuthenticatedPersonnel()
  .then(async (result) => {
    if (!result) {
      return;
    }
    currentUser = result.personnel;
    const settings = await fetchOwnSettings(currentUser.id);
    const accent = settings.theme_accent || readStoredAccent() || (document.documentElement.getAttribute('data-theme') === 'dark' ? '#8A90FF' : '#1E4E8C');
    document.querySelector('#bio-public').checked = settings.bio_public !== false;
    document.querySelector('#accent-hex').value = accent;
    document.querySelector('#accent-preview').style.background = accent;
    if (settings.theme_accent) {
      applyAccent(settings.theme_accent);
    }
    bindColorWheel(
      document.querySelector('#color-wheel'),
      document.querySelector('#accent-hex'),
      document.querySelector('#accent-preview'),
      (hex) => applyAccent(hex)
    );
    initAos();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#add-theme').addEventListener('click', () => {
  document.querySelector('#theme-picker').hidden = !document.querySelector('#theme-picker').hidden;
});

document.querySelector('#accent-hex').addEventListener('input', (event) => {
  const hex = event.target.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    document.querySelector('#accent-preview').style.background = hex;
    applyAccent(hex);
  }
});

document.querySelector('#save-theme').addEventListener('click', async () => {
  if (!currentUser) {
    return;
  }
  const hex = document.querySelector('#accent-hex').value.trim();
  try {
    applyAccent(hex);
    await saveOwnSettings(currentUser.id, { theme_accent: hex });
    await writeActivityLog({
      userId: currentUser.id,
      roleSnapshot: currentUser.role,
      actionType: 'theme_update',
      details: `Updated theme accent to ${hex}`
    });
    showStatus('Theme saved.');
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelector('#bio-public').addEventListener('change', async (event) => {
  if (!currentUser) {
    return;
  }
  const bioPublic = event.target.checked;
  try {
    await saveOwnSettings(currentUser.id, { bio_public: bioPublic });
    await writeActivityLog({
      userId: currentUser.id,
      roleSnapshot: currentUser.role,
      actionType: 'privacy_update',
      details: bioPublic ? 'Biography set to public' : 'Biography set to private'
    });
    showStatus('Privacy setting saved.');
  } catch (error) {
    showStatus(error.message, true);
  }
});
