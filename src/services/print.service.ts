import crypto from 'crypto';
import fs from 'fs';

let defaultPrivateKey: string | null = null;
let defaultCertificate: string | null = null;

function loadConfiguredKeyOrCert(envVal?: string, envPathVal?: string): string | null {
  if (envVal && envVal.trim()) {
    return envVal.trim();
  }
  if (envPathVal && envPathVal.trim()) {
    try {
      if (fs.existsSync(envPathVal.trim())) {
        return fs.readFileSync(envPathVal.trim(), 'utf8').trim();
      }
    } catch (err) {
      console.error(`[PrintService] Failed to read key/cert file from path "${envPathVal}":`, err);
    }
  }
  return null;
}

function ensureDefaultKeyPair() {
  if (defaultPrivateKey && defaultCertificate) return;

  // Try loading from environment variables or secret files first
  const customPrivateKey = loadConfiguredKeyOrCert(process.env.QZ_PRIVATE_KEY, process.env.QZ_PRIVATE_KEY_PATH);
  const customCertificate = loadConfiguredKeyOrCert(process.env.QZ_CERTIFICATE, process.env.QZ_CERTIFICATE_PATH);

  if (customPrivateKey && customCertificate) {
    defaultPrivateKey = customPrivateKey;
    defaultCertificate = customCertificate;
    return;
  }

  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    defaultPrivateKey = customPrivateKey || privateKey;
    const cleanPublic = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');

    defaultCertificate = customCertificate || `-----BEGIN CERTIFICATE-----\n${cleanPublic.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
  } catch (err) {
    console.warn('[PrintService] Failed to generate default RSA key pair:', err);
  }
}

/**
 * Get QZ Tray public digital certificate.
 */
export async function getQzCertificate(customCert?: string | null): Promise<string> {
  if (customCert && customCert.trim()) {
    return customCert.trim();
  }
  ensureDefaultKeyPair();
  return defaultCertificate || '';
}

/**
 * Sign QZ Tray request payload string using RSA SHA-512.
 */
export async function signQzRequest(toSign: string, customPrivateKey?: string | null): Promise<string> {
  ensureDefaultKeyPair();
  const keyToUse = (customPrivateKey && customPrivateKey.trim()) ? customPrivateKey.trim() : defaultPrivateKey;
  if (!keyToUse) {
    throw new Error('RSA Private Key not configured');
  }

  const signer = crypto.createSign('SHA512');
  signer.update(toSign);
  signer.end();
  return signer.sign(keyToUse, 'base64');
}

