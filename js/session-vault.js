// ────────────────────────────────────────────────────────────
// Session Vault: Password-based PBKDF2 + AES-GCM 256-bit Encryption
// ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wlr-session-vault';

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

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSessionData(sessionPayload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const encoded = enc.encode(JSON.stringify(sessionPayload));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    cipherText: bufferToBase64(cipherBuffer)
  };
}

export async function decryptSessionData(encryptedRecord, password) {
  const salt = base64ToBuffer(encryptedRecord.salt);
  const iv = base64ToBuffer(encryptedRecord.iv);
  const cipherBuffer = base64ToBuffer(encryptedRecord.cipherText);

  const key = await deriveKey(password, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    cipherBuffer
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
}

export function readSessionVault() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionVault(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

import { detectDeviceInfo, verifyDevicePasskey } from './device-auth.js';

export async function saveSessionToVault({ label, password, authMethod = 'pin', session, activePersonnel }) {
  if (!password || password.trim().length < 4) {
    throw new Error('PIN / Password must be at least 4 characters');
  }

  const deviceInfo = detectDeviceInfo();
  const sessionLabel = (label && label.trim()) ? label.trim() : deviceInfo.defaultLabel;

  const payload = {
    user_id: session?.user?.id || '',
    email: session?.user?.email || '',
    access_token: session?.access_token || '',
    refresh_token: session?.refresh_token || '',
    active_personnel_id: activePersonnel?.id || '',
    active_personnel_name: activePersonnel?.callsign || activePersonnel?.first_name || '',
    device_id: deviceInfo.deviceId,
    saved_at: Date.now()
  };

  const encrypted = await encryptSessionData(payload, password);

  const id = `vault_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    id,
    label: sessionLabel,
    user_email: payload.email,
    personnel_name: payload.active_personnel_name,
    auth_method: authMethod, // 'passkey' | 'pin'
    device_info: deviceInfo,
    saved_at: payload.saved_at,
    salt: encrypted.salt,
    iv: encrypted.iv,
    cipherText: encrypted.cipherText
  };

  const existing = readSessionVault();
  const updated = [record, ...existing.filter((item) => item.id !== id)];
  writeSessionVault(updated);
  return record;
}

export async function deleteSessionFromVault(sessionId, authOptions = {}) {
  const existing = readSessionVault();
  const target = existing.find((item) => item.id === sessionId);
  if (!target) {
    throw new Error('Session not found');
  }

  const { password, usePasskey } = typeof authOptions === 'string' ? { password: authOptions } : authOptions;

  if (usePasskey) {
    // Verify via Device Passkey / Windows Hello
    try {
      await verifyDevicePasskey();
    } catch (err) {
      throw new Error('PASSKEY_FAILED');
    }
  } else {
    // Attempt decryption to verify password/PIN
    if (!password) {
      throw new Error('PIN_REQUIRED');
    }
    try {
      await decryptSessionData(target, password);
    } catch {
      throw new Error('INVALID_PASSWORD');
    }
  }

  // If verified, remove record
  const next = existing.filter((item) => item.id !== sessionId);
  writeSessionVault(next);
  return true;
}
