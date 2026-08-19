import { bootCommandShell, initAos } from './shell.js';
import { isLocalTestMode } from './config.js';
import { readSession, signInWithEmail, signUpWithEmail } from './session.js';
import { LOCAL_TEST_ACCOUNTS, resetLocalStation } from './local-station.js';
import { showStatus } from './ui.js';

let mode = 'signin';

function syncAuthMode() {
  const submit = document.querySelector('#auth-submit');
  const toggle = document.querySelector('#auth-toggle');
  const title = document.querySelector('#auth-title');
  const hint = document.querySelector('#signup-email-hint');
  if (mode === 'signup') {
    title.textContent = 'Create account';
    submit.textContent = 'Sign Up';
    toggle.textContent = 'Already registered? Sign In';
    if (hint) {
      hint.hidden = false;
    }
  } else {
    title.textContent = 'Sign In';
    submit.textContent = 'Sign In';
    toggle.textContent = 'Create an account';
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
initAos();
renderLocalTestNotes();

readSession()
  .then((session) => {
    if (session) {
      window.location.replace('./index.html');
    }
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#auth-toggle').addEventListener('click', () => {
  mode = mode === 'signin' ? 'signup' : 'signin';
  syncAuthMode();
});

document.querySelector('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#auth-submit');
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;

  if (submit.disabled) {
    return;
  }
  submit.disabled = true;

  try {
    if (mode === 'signup') {
      const result = await signUpWithEmail(email, password);
      if (result.session) {
        window.location.replace('./index.html');
        return;
      }
      showStatus('Account created. Sign In with the same email and password.');
      mode = 'signin';
      syncAuthMode();
      return;
    }

    await signInWithEmail(email, password);
    window.location.replace('./index.html');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    submit.disabled = false;
  }
});
