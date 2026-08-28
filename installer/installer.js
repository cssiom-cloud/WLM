// ────────────────────────────────────────────────────────────
// WLR Custom Setup Wizard Orchestrator
// ────────────────────────────────────────────────────────────

import { applyTranslations, getLang, setLang, t } from '../js/i18n.js';
import { isPasskeySupported, registerDevicePasskey } from '../js/device-auth.js';

let currentStep = 1;
const TOTAL_STEPS = 6;

// ── Atmospheric Rain & Glass Shards Engine ─────────────────
function initAtmosphere() {
  const rainCanvas = document.getElementById('rain-canvas');
  const glassCanvas = document.getElementById('glass-canvas');
  if (!rainCanvas || !glassCanvas) return;

  const ctxRain = rainCanvas.getContext('2d');
  const ctxGlass = glassCanvas.getContext('2d');

  function resize() {
    rainCanvas.width = window.innerWidth;
    rainCanvas.height = window.innerHeight;
    glassCanvas.width = window.innerWidth;
    glassCanvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Rain Drops
  const drops = Array.from({ length: 45 }, () => ({
    x: Math.random() * rainCanvas.width,
    y: Math.random() * rainCanvas.height,
    length: 12 + Math.random() * 18,
    speed: 4 + Math.random() * 6,
    opacity: 0.15 + Math.random() * 0.25
  }));

  // Glass Shards
  const shards = Array.from({ length: 15 }, () => ({
    x: Math.random() * glassCanvas.width,
    y: Math.random() * glassCanvas.height,
    size: 6 + Math.random() * 12,
    speedY: 0.8 + Math.random() * 1.5,
    speedX: (Math.random() - 0.5) * 0.6,
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 2,
    opacity: 0.12 + Math.random() * 0.25
  }));

  function animate() {
    ctxRain.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    ctxGlass.clearRect(0, 0, glassCanvas.width, glassCanvas.height);

    // Draw rain
    ctxRain.strokeStyle = 'rgba(165, 180, 252, 0.4)';
    ctxRain.lineWidth = 1.2;
    for (const d of drops) {
      ctxRain.beginPath();
      ctxRain.moveTo(d.x, d.y);
      ctxRain.lineTo(d.x, d.y + d.length);
      ctxRain.stroke();
      d.y += d.speed;
      if (d.y > rainCanvas.height) {
        d.y = -d.length;
        d.x = Math.random() * rainCanvas.width;
      }
    }

    // Draw glass shards
    for (const s of shards) {
      ctxGlass.save();
      ctxGlass.translate(s.x, s.y);
      ctxGlass.rotate((s.rot * Math.PI) / 180);
      ctxGlass.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
      ctxGlass.strokeStyle = `rgba(99, 102, 241, ${s.opacity * 0.6})`;
      ctxGlass.lineWidth = 1;
      ctxGlass.beginPath();
      ctxGlass.moveTo(-s.size, -s.size);
      ctxGlass.lineTo(s.size * 0.8, -s.size * 0.4);
      ctxGlass.lineTo(s.size * 0.3, s.size);
      ctxGlass.closePath();
      ctxGlass.fill();
      ctxGlass.stroke();
      ctxGlass.restore();

      s.y += s.speedY;
      s.x += s.speedX;
      s.rot += s.rotSpeed;
      if (s.y > glassCanvas.height + 20) {
        s.y = -20;
        s.x = Math.random() * glassCanvas.width;
      }
    }

    requestAnimationFrame(animate);
  }
  animate();
}

// ── UI Step Navigation ─────────────────────────────────────
function updateStepUI() {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const pane = document.getElementById(`step-${i}`);
    if (pane) {
      pane.classList.toggle('active', i === currentStep);
    }
  }

  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const btnLaunch = document.getElementById('btn-launch');
  const stepDots = document.querySelectorAll('.step-dot');

  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentStep - 1);
  });

  if (currentStep === 1) {
    btnBack.style.display = 'none';
    btnNext.style.display = 'inline-flex';
    btnLaunch.style.display = 'none';
    btnNext.textContent = t('installer.next');
  } else if (currentStep === 4) {
    btnBack.style.display = 'inline-flex';
    btnNext.style.display = 'inline-flex';
    btnLaunch.style.display = 'none';
    btnNext.textContent = t('installer.installNow');
  } else if (currentStep === 5) {
    btnBack.style.display = 'none';
    btnNext.style.display = 'none';
    btnLaunch.style.display = 'none';
    startInstallationProcess();
  } else if (currentStep === 6) {
    btnBack.style.display = 'none';
    btnNext.style.display = 'none';
    btnLaunch.style.display = 'inline-flex';
  } else {
    btnBack.style.display = 'inline-flex';
    btnNext.style.display = 'inline-flex';
    btnLaunch.style.display = 'none';
    btnNext.textContent = t('installer.next');
  }
}

// ── Windows Hello & Hardware Verification ──────────────────
async function initHardwareCheck() {
  const statusLabel = document.getElementById('hello-status-label');
  const testBtn = document.getElementById('test-hello-btn');

  const supported = await isPasskeySupported();
  if (statusLabel) {
    statusLabel.textContent = supported
      ? 'Windows Hello biometric sensor & PIN active on this hardware'
      : 'Using Device PIN secondary authentication';
  }

  testBtn?.addEventListener('click', async () => {
    try {
      testBtn.disabled = true;
      testBtn.textContent = 'Verifying...';
      const pin = document.getElementById('installer-pin-input')?.value || '1234';
      await registerDevicePasskey('Officer', 'WLR Operator', pin);
      if (statusLabel) {
        statusLabel.textContent = t('installer.helloTestedOk');
        statusLabel.style.color = 'var(--success)';
      }
      testBtn.textContent = 'Verified';
      testBtn.className = 'btn btn-ghost';
      testBtn.style.color = 'var(--success)';
    } catch (err) {
      if (statusLabel) statusLabel.textContent = err.message;
      testBtn.textContent = 'Retry Test';
      testBtn.disabled = false;
    }
  });
}

// ── Installation Process Simulation & Native Execution ─────
async function startInstallationProcess() {
  const progressBar = document.getElementById('install-progress-bar');
  const statusLabel = document.getElementById('install-status-label');
  const percentLabel = document.getElementById('install-percent-label');

  const steps = [
    { pct: 15, text: 'Creating application directories...' },
    { pct: 35, text: 'Deploying core binaries & assets...' },
    { pct: 60, text: 'Configuring encrypted session vault (%APPDATA%)...' },
    { pct: 85, text: 'Creating desktop and start menu shortcuts...' },
    { pct: 100, text: 'Finalizing installation...' }
  ];

  // Request Electron to create shortcuts if available
  const makeDesktop = document.getElementById('chk-desktop')?.checked !== false;
  const makeStart = document.getElementById('chk-startmenu')?.checked !== false;
  const autoStart = document.getElementById('chk-autostart')?.checked === true;

  for (const s of steps) {
    if (statusLabel) statusLabel.textContent = s.text;
    if (percentLabel) percentLabel.textContent = `${s.pct}%`;
    if (progressBar) progressBar.style.width = `${s.pct}%`;
    await new Promise((r) => setTimeout(r, 450));
  }

  // If running in Desktop installer process, trigger native shortcuts
  if (window.desktopApp?.createShortcuts) {
    try {
      await window.desktopApp.createShortcuts({ makeDesktop, makeStart, autoStart });
    } catch (e) {
      console.warn('Shortcut creation error:', e);
    }
  }

  currentStep = 6;
  updateStepUI();
}

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initAtmosphere();
  applyTranslations();
  initHardwareCheck();

  if (window.desktopApp?.getInstallPath) {
    try {
      const dest = await window.desktopApp.getInstallPath();
      const input = document.getElementById('dest-path-input');
      if (input && dest) input.value = dest;
    } catch {
      // ignore
    }
  }

  const langBtn = document.getElementById('lang-btn');
  const langLabel = document.getElementById('lang-label');
  if (langBtn && langLabel) {
    langLabel.textContent = getLang() === 'th' ? 'EN' : 'TH';
    langBtn.addEventListener('click', () => {
      const next = getLang() === 'th' ? 'en' : 'th';
      setLang(next);
      langLabel.textContent = next === 'th' ? 'EN' : 'TH';
      applyTranslations();
      updateStepUI();
    });
  }

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      updateStepUI();
    }
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateStepUI();
    }
  });

  document.getElementById('btn-launch')?.addEventListener('click', () => {
    if (window.desktopApp?.launchMainApp) {
      window.desktopApp.launchMainApp();
    } else {
      window.location.href = '../login.html';
    }
  });

  updateStepUI();
});
