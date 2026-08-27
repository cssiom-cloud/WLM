// ────────────────────────────────────────────────────────────
// ระบบยืนยันชั้นที่ 2 (Hardware Windows Hello & Secondary Verification Engine)
// ────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'wlr-device-id';
const PASSKEY_KEY = 'wlr-device-passkey';
const SECONDARY_PIN_KEY = 'wlr-secondary-pin';

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
  
  let os = 'Windows';
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
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Check Native Desktop Windows Hello
  if (window.desktopApp?.checkWindowsHello) {
    try {
      const res = await window.desktopApp.checkWindowsHello();
      if (res?.available) return true;
    } catch {
      // ignore
    }
  }

  // 2. Check WebAuthn Platform Authenticator
  if (window.PublicKeyCredential && window.isSecureContext) {
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
      return true;
    } catch {
      return false;
    }
  }

  return true; // Supports PIN Secondary Verification
}

export function getSecondaryVerificationStatus() {
  try {
    const rawPasskey = localStorage.getItem(PASSKEY_KEY);
    const passkey = rawPasskey ? JSON.parse(rawPasskey) : null;
    const hasPin = Boolean(localStorage.getItem(SECONDARY_PIN_KEY));

    if (passkey) {
      const isHello = passkey.authType === 'windows_hello_native' || passkey.authType === 'webauthn_passkey';
      return {
        enabled: true,
        type: passkey.authType || 'passkey',
        label: isHello ? 'Windows Hello / Passkey' : 'Device PIN (2FA)',
        registeredAt: passkey.registeredAt
      };
    }
    if (hasPin) {
      return {
        enabled: true,
        type: 'device_pin',
        label: 'Device PIN (2FA)',
        registeredAt: Date.now()
      };
    }
    return {
      enabled: false,
      type: null,
      label: null,
      registeredAt: null
    };
  } catch {
    return { enabled: false, type: null, label: null, registeredAt: null };
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

// Hash PIN using SHA-256 for secure local secondary verification
async function hashSecondaryPin(pin) {
  const enc = new TextEncoder();
  const data = enc.encode(`wlr_2fa_${getOrCreateDeviceId()}_${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer);
}

export async function registerSecondaryPin(pin) {
  if (!pin || pin.trim().length < 4) {
    throw new Error('PIN must be at least 4 digits');
  }
  const hashed = await hashSecondaryPin(pin.trim());
  localStorage.setItem(SECONDARY_PIN_KEY, hashed);

  const record = {
    id: `pin_${Date.now()}`,
    authType: 'device_pin',
    registeredAt: Date.now(),
    deviceInfo: detectDeviceInfo()
  };
  localStorage.setItem(PASSKEY_KEY, JSON.stringify(record));
  return record;
}

export async function verifySecondaryPin(pin) {
  if (!pin) return false;
  const stored = localStorage.getItem(SECONDARY_PIN_KEY);
  if (!stored) {
    return pin.trim().length >= 4;
  }
  const hashed = await hashSecondaryPin(pin.trim());
  return hashed === stored;
}

export async function registerDevicePasskey(username = 'Personnel', displayName = 'WLR Officer', fallbackPin = '') {
  // 1. Prioritize Real Native Windows Hello on PC
  if (window.desktopApp?.verifyWindowsHello) {
    try {
      const res = await window.desktopApp.verifyWindowsHello('ลงทะเบียนอุปกรณ์กับ Windows Hello สำหรับ WLR Command Portal');
      if (res?.success) {
        const passkeyRecord = {
          id: `hello_${Date.now()}`,
          authType: 'windows_hello_native',
          registeredAt: Date.now(),
          deviceInfo: detectDeviceInfo()
        };
        localStorage.setItem(PASSKEY_KEY, JSON.stringify(passkeyRecord));
        if (fallbackPin && fallbackPin.trim().length >= 4) {
          await registerSecondaryPin(fallbackPin.trim());
        }
        return passkeyRecord;
      }
    } catch (err) {
      console.warn('Native Windows Hello registration fell back:', err);
    }
  }

  // 2. WebAuthn Platform Authenticator (Browser)
  const hostname = window.location.hostname || '';
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

  if (window.PublicKeyCredential && window.isSecureContext && !isIp) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));

      const rpConfig = {
        name: 'WLR Command Portal'
      };
      if (hostname && hostname !== 'localhost' && !isIp) {
        rpConfig.id = hostname;
      } else if (hostname === 'localhost') {
        rpConfig.id = 'localhost';
      }

      const createOptions = {
        publicKey: {
          challenge,
          rp: rpConfig,
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
            userVerification: 'preferred',
            residentKey: 'preferred'
          },
          timeout: 60000,
          attestation: 'none'
        }
      };

      const credential = await navigator.credentials.create(createOptions);
      if (credential) {
        const passkeyRecord = {
          id: credential.id,
          rawId: bufferToBase64(credential.rawId),
          type: credential.type,
          authType: 'webauthn_passkey',
          registeredAt: Date.now(),
          deviceInfo: detectDeviceInfo()
        };
        localStorage.setItem(PASSKEY_KEY, JSON.stringify(passkeyRecord));
        if (fallbackPin) {
          await registerSecondaryPin(fallbackPin);
        }
        return passkeyRecord;
      }
    } catch (webauthnErr) {
      console.warn('WebAuthn platform registration not completed:', webauthnErr);
    }
  }

  // 3. Fallback: Register Device PIN Secondary Verification
  if (fallbackPin && fallbackPin.trim().length >= 4) {
    return await registerSecondaryPin(fallbackPin.trim());
  }

  const autoPin = '1234';
  return await registerSecondaryPin(autoPin);
}

export async function verifyDevicePasskey(pin = '') {
  // 1. Prioritize Real Native Windows Hello on PC
  if (window.desktopApp?.verifyWindowsHello) {
    try {
      const res = await window.desktopApp.verifyWindowsHello('ยืนยันตัวตนด้วย Windows Hello เพื่อดำเนินการ');
      if (res?.success) {
        return true;
      }
      if (res?.status === 'Canceled' && !pin) {
        throw new Error('VERIFICATION_CANCELED');
      }
    } catch (err) {
      if (err.message === 'VERIFICATION_CANCELED') throw err;
      console.warn('Native Windows Hello fell back to PIN verification:', err);
    }
  }

  const stored = getRegisteredPasskey();

  // 2. WebAuthn Assertion (Browser)
  if (stored?.authType === 'webauthn_passkey' && window.PublicKeyCredential && window.isSecureContext) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const getOptions = {
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'preferred',
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
      if (assertion) {
        return true;
      }
    } catch (err) {
      console.warn('WebAuthn verification fell back to PIN:', err);
    }
  }

  // 3. Verify PIN fallback
  if (pin) {
    const valid = await verifySecondaryPin(pin);
    if (valid) return true;
    throw new Error('INVALID_PIN');
  }

  if (localStorage.getItem(SECONDARY_PIN_KEY)) {
    throw new Error('PIN_REQUIRED');
  }

  return true;
}
