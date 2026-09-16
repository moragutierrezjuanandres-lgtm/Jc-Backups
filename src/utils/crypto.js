import { api } from './api';
// jc-enterprise-portal Cryptography module using Web Crypto API (AES-GCM 256-bit)
const ENCRYPTION_KEY_NAME = 'jc_vault_master_key';

/**
 * Retrieves the base key from localStorage or generates a new one.
 */
async function getOrCreateKey() {
  let keyData = localStorage.getItem(ENCRYPTION_KEY_NAME);
  if (!keyData) {
    // Generate a new 256-bit AES-GCM key
    const cryptoKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // exportable
      ['encrypt', 'decrypt']
    );
    const exported = await window.crypto.subtle.exportKey('raw', cryptoKey);
    const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
    localStorage.setItem(ENCRYPTION_KEY_NAME, base64Key);
    return cryptoKey;
  } else {
    // Import key from base64 string
    const rawKey = new Uint8Array(
      atob(keyData).split('').map(c => c.charCodeAt(0))
    );
    return await window.crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }
}

/**
 * Encrypts a string of text using AES-GCM-256.
 * Returns a JSON string containing the base64-encoded IV and ciphertext.
 */
export async function encryptData(text) {
  if(!text)return '';
  const result=await api('/api/vault/encrypt',{method:'POST',body:{text}});return result.value;
}

export async function decryptData(encryptedJsonString) {
  if (!encryptedJsonString) return '';
  if (typeof encryptedJsonString !== 'string') return String(encryptedJsonString);
  const trimmed = encryptedJsonString.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return encryptedJsonString;
  }
  try {
    const payload = JSON.parse(trimmed);
    if (!payload || typeof payload !== 'object') return encryptedJsonString;

    if (payload.mode === 'server-v1') { const result=await api('/api/vault/decrypt',{method:'POST',body:{value:encryptedJsonString}});return result.value; }
    if (payload.mode === 'fallback' && payload.data) {
      const raw = decodeURIComponent(escape(atob(payload.data)));
      return raw.split('').map((char) => String.fromCharCode(char.charCodeAt(0) ^ 42)).join('');
    }

    if (!window.crypto || !window.crypto.subtle) {
      return encryptedJsonString;
    }

    if (!payload.iv || !payload.data) {
      return encryptedJsonString;
    }

    const { iv: ivBase64, data: cipherBase64 } = payload;
    const key = await getOrCreateKey();
    
    const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(cipherBase64).split('').map(c => c.charCodeAt(0)));
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.warn('Decryption fallback to raw string:', err);
    return encryptedJsonString;
  }
}

