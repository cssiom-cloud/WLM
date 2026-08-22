import { bootCommandShell } from './shell.js';
import { isLocalTestMode } from './config.js';
import { t } from './i18n.js';
import {
  clearAuthRedirectParams,
  readAuthRedirectError,
  readSession,
  routeAfterAuth,
  signInWithDiscord,
  signInWithEmail,
  signUpWithEmail
} from './session.js';
import { LOCAL_TEST_ACCOUNTS, resetLocalStation } from './local-station.js';
import { showStatus } from './ui.js';
import { revealBlurText } from './motion.js';

const MORPH_MS = 550;
const SCAN_MS = 2000;
const SUCCESS_HOLD_MS = 280;

const MORPH_BOX = {
  scanning: { width: '5rem', height: '5rem', borderRadius: '50%', padding: '0px' },
  success: { width: 'min(20rem, calc(100vw - 2rem))', height: '4rem', borderRadius: '9999px', padding: '0px 1.5rem' },
  idle: { width: 'min(24rem, 100%)', height: '24rem', borderRadius: '16px', padding: '2rem' }
};

let mode = 'signin';
let authBusy = false;

function authCard() {
  return document.querySelector('#auth-card');
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function setAuthState(next) {
  const card = authCard();
  const idle = document.querySelector('#auth-idle');
  const scanning = document.querySelector('#auth-scanning');
  const success = document.querySelector('#auth-success');
  if (!card) {
    return;
  }

  card.dataset.authState = next;
  if (idle) {
    idle.setAttribute('aria-hidden', next === 'idle' ? 'false' : 'true');
  }
  if (scanning) {
    scanning.setAttribute('aria-hidden', next === 'scanning' ? 'false' : 'true');
  }
  if (success) {
    success.setAttribute('aria-hidden', next === 'success' ? 'false' : 'true');
  }
}

function clearCardBox(card) {
  card.style.width = '';
  card.style.height = '';
  card.style.minHeight = '';
  card.style.borderRadius = '';
  card.style.padding = '';
}

function applyBox(card, box) {
  card.style.width = box.width;
  card.style.height = box.height;
  card.style.minHeight = '0';
  card.style.borderRadius = box.borderRadius;
  card.style.padding = box.padding;
}

function captureCardBox(card) {
  const rect = card.getBoundingClientRect();
  const computed = window.getComputedStyle(card);
  return {
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: computed.borderRadius,
    padding: computed.padding
  };
}

async function morphTo(state) {
  const card = authCard();
  if (!card) {
    return;
  }

  if (prefersReducedMotion()) {
    setAuthState(state);
    if (state === 'idle') {
      clearCardBox(card);
    } else {
      applyBox(card, MORPH_BOX[state]);
    }
    return;
  }

  const from = captureCardBox(card);
  applyBox(card, from);
  await nextFrame();

  setAuthState(state);
  applyBox(card, MORPH_BOX[state]);
  if (state === 'idle') {
    card.style.minHeight = '24rem';
  }

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      card.removeEventListener('transitionend', onEnd);
      window.clearTimeout(failSafe);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === card && (event.propertyName === 'width' || event.propertyName === 'height')) {
        done();
      }
    };
    const failSafe = window.setTimeout(done, MORPH_MS + 80);
    card.addEventListener('transitionend', onEnd);
  });

  if (state === 'idle') {
    clearCardBox(card);
  }
}

async function playClearanceSeal() {
  await morphTo('scanning');
  await sleep(prefersReducedMotion() ? 0 : SCAN_MS);
  await morphTo('success');
  await sleep(prefersReducedMotion() ? 0 : SUCCESS_HOLD_MS);
}

async function restoreAuthForm() {
  await morphTo('idle');
  setBusy(false);
}

function setBusy(busy) {
  const submit = document.querySelector('#auth-submit');
  const discord = document.querySelector('#auth-discord');
  const toggle = document.querySelector('#auth-toggle');
  const email = document.querySelector('#auth-email');
  const password = document.querySelector('#auth-password');
  if (submit) {
    submit.disabled = busy;
  }
  if (discord) {
    discord.disabled = busy;
  }
  if (toggle) {
    toggle.disabled = busy;
  }
  if (email) {
    email.disabled = busy;
  }
  if (password) {
    password.disabled = busy;
  }
}

function syncAuthMode() {
  const submit = document.querySelector('#auth-submit');
  const toggle = document.querySelector('#auth-toggle');
  const title = document.querySelector('#auth-title');
  const hint = document.querySelector('#signup-email-hint');
  if (mode === 'signup') {
    title.textContent = t('auth.signupTitle');
    submit.textContent = t('auth.signupSubmit');
    toggle.textContent = t('auth.switchSignin');
    if (hint) {
      hint.hidden = false;
    }
  } else {
    title.textContent = t('auth.signinTitle');
    submit.textContent = t('auth.signinSubmit');
    toggle.textContent = t('auth.switchSignup');
    if (hint) {
      hint.hidden = true;
    }
  }
}

function renderLocalTestNotes() {
  const notes = document.querySelector('#local-test-notes');
  if (!notes || !isLocalTestMode()) {
    return;
  }

  notes.hidden = false;
  notes.innerHTML = `
    <p class="page-kicker">Local test accounts</p>
    <button class="btn" type="button" data-fill-email="admin@local.test" data-fill-password="admin">
      Admin: admin@local.test / admin
    </button>
    <button class="btn" type="button" data-fill-email="officer@local.test" data-fill-password="officer">
      Officer: officer@local.test / officer
    </button>
    <button class="btn" type="button" id="reset-local-station">Reset local test data</button>
  `;

  notes.querySelectorAll('[data-fill-email]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelector('#auth-email').value = button.getAttribute('data-fill-email');
      document.querySelector('#auth-password').value = button.getAttribute('data-fill-password');
    });
  });

  notes.querySelector('#reset-local-station').addEventListener('click', () => {
    resetLocalStation();
    showStatus('Local test data was reset.');
    document.querySelector('#auth-email').value = LOCAL_TEST_ACCOUNTS[0].email;
    document.querySelector('#auth-password').value = LOCAL_TEST_ACCOUNTS[0].password;
  });
}

bootCommandShell('');
syncAuthMode();
revealBlurText(document.querySelector('#auth-title'));
renderLocalTestNotes();

const redirectError = readAuthRedirectError();
readSession()
  .then(async (session) => {
    clearAuthRedirectParams();
    if (redirectError) {
      showStatus(redirectError, true);
      return;
    }
    if (session) {
      await routeAfterAuth();
    }
  })
  .catch((error) => {
    clearAuthRedirectParams();
    showStatus(error.message || t('auth.discordError'), true);
  });

document.querySelector('#auth-toggle').addEventListener('click', () => {
  if (authBusy) {
    return;
  }
  mode = mode === 'signin' ? 'signup' : 'signin';
  syncAuthMode();
  revealBlurText(document.querySelector('#auth-title'));
});

window.addEventListener('wlr-lang-changed', () => {
  syncAuthMode();
  if (authCard()?.dataset.authState === 'idle') {
    revealBlurText(document.querySelector('#auth-title'));
  }
});

document.querySelector('#auth-discord').addEventListener('click', async () => {
  if (authBusy) {
    return;
  }
  authBusy = true;
  setBusy(true);

  try {
    await playClearanceSeal();
    await signInWithDiscord();
  } catch (error) {
    await restoreAuthForm();
    showStatus(error.message || t('auth.discordError'), true);
  } finally {
    authBusy = false;
    if (authCard()?.dataset.authState === 'idle') {
      setBusy(false);
    }
  }
});

document.querySelector('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (authBusy) {
    return;
  }

  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  authBusy = true;
  setBusy(true);

  try {
    await playClearanceSeal();

    if (mode === 'signup') {
      const result = await signUpWithEmail(email, password);
      if (result.session) {
        await routeAfterAuth();
        return;
      }
      await restoreAuthForm();
      showStatus(t('auth.created'));
      mode = 'signin';
      syncAuthMode();
      return;
    }

    await signInWithEmail(email, password);
    await routeAfterAuth();
  } catch (error) {
    await restoreAuthForm();
    showStatus(error.message, true);
  } finally {
    authBusy = false;
    if (authCard()?.dataset.authState === 'idle') {
      setBusy(false);
    }
  }
});
