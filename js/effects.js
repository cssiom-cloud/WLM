const CELL = 52;
const MOBILE_QUERY = '(max-width: 768px), (hover: none), (pointer: coarse)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

let gridStarted = false;
let tiltRecords = [];

function isTouchUi() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCE_QUERY).matches;
}

function accentRgb() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '138, 144, 255' : '30, 78, 140';
}

function initInteractiveGrid() {
  if (gridStarted) {
    return;
  }
  gridStarted = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-grid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const intensity = new Map();
  const mouse = { x: -9999, y: -9999 };
  let scrollY = window.scrollY;
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellOrigin(axis, offset) {
    return Math.floor((axis + offset) / CELL) * CELL - offset;
  }

  function paint() {
    const rgb = accentRgb();
    const isHome = document.body.dataset.page === 'home';
    const isDirectory = document.body.dataset.page === 'directory';
    const lineAlpha = isHome || isDirectory ? 0.08 : 0.045;
    const offsetY = (scrollY * 0.1) % CELL;
    const offsetX = (scrollY * 0.03) % CELL;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${rgb}, ${lineAlpha})`;
    ctx.beginPath();
    for (let x = -offsetX; x <= width + CELL; x += CELL) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = -offsetY; y <= height + CELL; y += CELL) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();

    if (!prefersReducedMotion() && !isTouchUi()) {
      const hoverX = cellOrigin(mouse.x, offsetX);
      const hoverY = cellOrigin(mouse.y, offsetY);
      const hoverKey = `${hoverX},${hoverY}`;
      if (mouse.x >= 0) {
        intensity.set(hoverKey, 1);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            if (dx === 0 && dy === 0) {
              continue;
            }
            const key = `${hoverX + dx * CELL},${hoverY + dy * CELL}`;
            intensity.set(key, Math.max(intensity.get(key) || 0, 0.28));
          }
        }
      }

      intensity.forEach((value, key) => {
        const next = value * 0.86;
        if (next < 0.02) {
          intensity.delete(key);
          return;
        }
        intensity.set(key, next);
        const [cx, cy] = key.split(',').map(Number);
        ctx.fillStyle = `rgba(${rgb}, ${0.16 * next})`;
        ctx.strokeStyle = `rgba(${rgb}, ${0.5 * next})`;
        ctx.lineWidth = 1 + next * 1.6;
        ctx.fillRect(cx, cy, CELL, CELL);
        ctx.strokeRect(cx + 0.5, cy + 0.5, CELL - 1, CELL - 1);
      });
    }

    if (prefersReducedMotion()) {
      canvas.style.transform = '';
    } else {
      canvas.style.transform = `translate3d(0, ${scrollY * -0.08}px, 0)`;
    }
    window.requestAnimationFrame(paint);
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') {
        return;
      }
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    'pointerleave',
    () => {
      mouse.x = -9999;
      mouse.y = -9999;
    },
    { passive: true }
  );

  window.addEventListener(
    'scroll',
    () => {
      scrollY = window.scrollY || 0;
    },
    { passive: true }
  );

  window.addEventListener('resize', resize, { passive: true });
  resize();
  paint();
}

function initParallax() {
  const shell = document.querySelector('.page-shell');
  if (!shell || prefersReducedMotion()) {
    return;
  }

  const apply = () => {
    if (isTouchUi()) {
      shell.style.transform = '';
      return;
    }
    const shift = Math.min(window.scrollY, 480) * 0.035;
    shell.style.transform = `translate3d(0, ${shift * -1}px, 0)`;
  };

  window.addEventListener('scroll', apply, { passive: true });
  apply();
}

function clearTilt(element) {
  element.style.transform = '';
}

function attachTilt(element) {
  if (element.dataset.tiltBound === 'true') {
    return;
  }
  element.dataset.tiltBound = 'true';
  element.classList.add('tilt-enabled');

  const onMove = (event) => {
    if (isTouchUi() || prefersReducedMotion()) {
      clearTilt(element);
      return;
    }
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateY = px * 8;
    const rotateX = py * -8;
    element.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(6px)`;
  };

  const onLeave = () => {
    element.style.transition = `transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)`;
    clearTilt(element);
  };

  const onEnter = () => {
    element.style.transition = `transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)`;
  };

  element.addEventListener('pointerenter', onEnter);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerleave', onLeave);
  tiltRecords.push({ element, onMove, onLeave, onEnter });
}

export function bindTiltTargets(selector) {
  if (isTouchUi() || prefersReducedMotion()) {
    document.querySelectorAll(selector).forEach((element) => {
      clearTilt(element);
    });
    return;
  }
  document.querySelectorAll(selector).forEach(attachTilt);
}

export function initVisualEffects() {
  initInteractiveGrid();
  initParallax();
  import('./motion.js').then((motion) => motion.mountPremiumBackdrop()).catch(() => {});
  window.addEventListener(
    'resize',
    () => {
      if (isTouchUi()) {
        document.querySelectorAll('.tilt-enabled').forEach(clearTilt);
      }
    },
    { passive: true }
  );
}
