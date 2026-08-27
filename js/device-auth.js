// ────────────────────────────────────────────────────────────
// Device Detection & WebAuthn / Passkey Authentication Engine
// ────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'wlr-device-id';
const PASSKEY_KEY = 'wlr-device-passkey';

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function detectDeviceInfo() {
  const isDesktop = Boolean(window.desktopApp?.isDesktop || /electron/i.test(navigator.userAgent));
  const userAgent = navigator.userAgent || '';
  
  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

  let browser = 'Browser';
  if (isDesktop) {
    browser = 'Desktop App';
  } else if (/edg/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/chrome/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/safari/i.test(userAgent)) {
    browser = 'Safari';
  }

  const deviceId = getOrCreateDeviceId();
  const defaultLabel = `${os} ${isDesktop ? '(Desktop App)' : `(${browser})`}`;

  return {
    deviceId,
    os,
    browser,
    isDesktop,
    defaultLabel,
    screenRes: `${window.screen?.width || 0}x${window.screen?.height || 0}`
  };
}

export async function isPasskeySupported() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

export function getRegisteredPasskey() {
  try {
    const raw = localStorage.getItem(PASSKEY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(b64) {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function registerDevicePasskey(username = 'Personnel', displayName = 'WLR Officer') {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn/Passkey is not supported in this environment');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const createOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'WLR Command Portal',
        id: window.location.hostname
      },
      user: {
        id: userId,
        name: username || 'wlr_user',
        displayName: displayName || 'WLR Personnel'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    }
  };

  const credential = await navigator.credentials.create(createOptions);
  if (!credential) {
    throw new Error('Failed to register device passkey');
  }

  const passkeyRecord = {
    id: credential.id,
    rawId: bufferToBase64(credential.rawId),
    type: credential.type,
    registeredAt: Date.now(),
    deviceInfo: detectDeviceInfo()
  };

  localStorage.setItem(PASSKEY_KEY, JSON.stringify(passkeyRecord));
  return passkeyRecord;
}

export async function verifyDevicePasskey() {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn/Passkey is not supported in this environment');
  }

  const stored = getRegisteredPasskey();
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const getOptions = {
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: stored?.rawId
        ? [
            {
              id: base64ToBuffer(stored.rawId),
              type: 'public-key',
              transports: ['internal']
            }
          ]
        : []
    }
  };

  const assertion = await navigator.credentials.get(getOptions);
  if (!assertion) {
    throw new Error('Passkey verification cancelled or failed');
  }

  return true;
}
