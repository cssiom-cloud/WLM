const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const TOUCH_QUERY = '(max-width: 768px), (hover: none), (pointer: coarse)';

export function prefersReducedMotion() {
  return window.matchMedia(REDUCE_QUERY).matches;
}

function isTouchUi() {
  return window.matchMedia(TOUCH_QUERY).matches;
}

export function mountPremiumBackdrop() {
  if (document.querySelector('.fx-aurora')) {
    return;
  }

  const layer = document.createElement('div');
  layer.className = 'fx-aurora';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <span class="fx-aurora-orb fx-aurora-a"></span>
    <span class="fx-aurora-orb fx-aurora-b"></span>
    <span class="fx-aurora-orb fx-aurora-c"></span>
    <div class="fx-retro-grid"></div>
  `;
  document.body.prepend(layer);
}

export function revealBlurText(element) {
  if (!element) {
    return;
  }

  const source = String(element.textContent || '').replace(/\s+/g, ' ').trim();
  if (!source) {
    return;
  }

  if (prefersReducedMotion()) {
    element.textContent = source;
    delete element.dataset.blurBound;
    return;
  }

  if (element.dataset.blurBound === 'true' && element.querySelector('.blur-word')) {
    return;
  }

  element.dataset.blurBound = 'true';
  element.classList.add('blur-reveal');
  element.innerHTML = source
    .split(' ')
    .map(
      (word, index) =>
        `<span class="blur-word" style="--i:${index}"><span class="blur-word-inner">${word}</span></span>`
    )
    .join(' ');
}

export function staggerIn(root, selector) {
  if (!root) {
    return;
  }

  const items = [...root.querySelectorAll(selector)];
  items.forEach((item, index) => {
    item.style.setProperty('--stagger', String(index));
    item.classList.add('stagger-item');
  });

  if (prefersReducedMotion() || root.classList.contains('is-instant')) {
    root.classList.add('is-staggered');
    return;
  }

  root.classList.remove('is-staggered');
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.add('is-staggered');
    });
  });
}

export function bindSpotlightCards(selector) {
  document.querySelectorAll(selector).forEach(bindSpotlightCard);
}

function bindSpotlightCard(element) {
  if (element.dataset.spotlightBound === 'true') {
    return;
  }
  element.dataset.spotlightBound = 'true';
  element.classList.add('spotlight-card');

  const onMove = (event) => {
    if (isTouchUi() || prefersReducedMotion() || event.pointerType === 'touch') {
      return;
    }
    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    element.style.setProperty('--spot-x', `${x}%`);
    element.style.setProperty('--spot-y', `${y}%`);
  };

  const onLeave = () => {
    element.style.setProperty('--spot-x', '50%');
    element.style.setProperty('--spot-y', '0%');
  };

  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerleave', onLeave);
}
