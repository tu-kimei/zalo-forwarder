import crypto from 'crypto';

const ZERO_IV = Buffer.alloc(16, 0); // 16 bytes of 0x00

/**
 * Encrypt data using AES-CBC with PKCS7 padding.
 * Key is Base64-encoded. IV is all zeros.
 */
export function encryptAesCbc(data: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, ZERO_IV);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  return encrypted.toString('base64');
}

/**
 * Decrypt data using AES-CBC with PKCS7 padding.
 * Key is Base64-encoded. Encoded data is Base64.
 */
export function decryptAesCbc(encodedData: string, keyBase64: string, retryCount = 0): string | null {
  try {
    const decoded = decodeURIComponent(encodedData);
    const key = Buffer.from(keyBase64, 'base64');

    // Determine algorithm based on key length
    let algorithm: string;
    if (key.length === 16) {
      algorithm = 'aes-128-cbc';
    } else if (key.length === 24) {
      algorithm = 'aes-192-cbc';
    } else {
      algorithm = 'aes-256-cbc';
    }

    const decipher = crypto.createDecipheriv(algorithm, key, ZERO_IV);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(decoded, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (e) {
    if (retryCount < 3) {
      return decryptAesCbc(encodedData, keyBase64, retryCount + 1);
    }
    return null;
  }
}

/**
 * Generate a sign key: MD5("zsecure" + data + sorted_values)
 * Matches Python: get_sign_key(data, secret)
 */
export function getSignKey(data: string, params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort();
  let signedString = `zsecure${data}`;
  for (const key of sortedKeys) {
    signedString += String(params[key]);
  }
  return crypto.createHash('md5').update(signedString).digest('hex');
}

/**
 * Generate IMEI: UUID + '-' + MD5(userAgent)
 * UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateImei(userAgent: string): string {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  const now = Date.now();
  let result = '';

  for (const char of template) {
    if (char === 'x' || char === 'y') {
      const rd = (Math.floor(Math.random() * 256) + now) % 16;
      result += rd.toString(16).toLowerCase();
    } else {
      result += char;
    }
  }

  const uaHash = crypto.createHash('md5').update(userAgent).digest('hex');
  return `${result}-${uaHash}`;
}
