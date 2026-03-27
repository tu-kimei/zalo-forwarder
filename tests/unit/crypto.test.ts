/**
 * Unit tests for src/lib/crypto.ts
 *
 * Tests AES-CBC encrypt/decrypt, getSignKey (MD5), and generateImei.
 *
 * NOTE: No test runner (jest/vitest) is installed in the project.
 * To run these tests, install one first:
 *   npm install -D vitest
 * Then add to package.json scripts:
 *   "test": "vitest run"
 * And run:
 *   npm test
 *
 * Alternatively, with jest:
 *   npm install -D jest ts-jest @types/jest
 *   npx ts-jest config:init
 *   npm test
 */

import crypto from 'crypto';
import {
  encryptAesCbc,
  decryptAesCbc,
  getSignKey,
  generateImei,
} from '../../src/lib/crypto';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a random AES key of given byte length, returned as Base64.
 */
function randomKeyBase64(bytes: 16 | 24 | 32 = 32): string {
  return crypto.randomBytes(bytes).toString('base64');
}

// ─── encryptAesCbc + decryptAesCbc ──────────────────────────────────────────

describe('AES-CBC encrypt/decrypt', () => {
  // --- Round-trip tests ---

  test('encrypt then decrypt should return original (AES-256)', () => {
    const key = randomKeyBase64(32);
    const plaintext = 'Hello, Zalo Forwarder!';

    const encrypted = encryptAesCbc(plaintext, key);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(plaintext);

    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  test('encrypt then decrypt should return original (AES-128)', () => {
    const key = randomKeyBase64(16);
    const plaintext = 'Short key test';

    // encryptAesCbc always uses aes-256-cbc, so for 128-bit key
    // we test decryptAesCbc which auto-detects key length
    const cipher = crypto.createCipheriv(
      'aes-128-cbc',
      Buffer.from(key, 'base64'),
      Buffer.alloc(16, 0),
    );
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]).toString('base64');

    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  test('encrypt then decrypt should return original (AES-192)', () => {
    const key = randomKeyBase64(24);
    const plaintext = 'Medium key test 192';

    const cipher = crypto.createCipheriv(
      'aes-192-cbc',
      Buffer.from(key, 'base64'),
      Buffer.alloc(16, 0),
    );
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]).toString('base64');

    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  test('round-trip with empty string', () => {
    const key = randomKeyBase64(32);
    const plaintext = '';

    const encrypted = encryptAesCbc(plaintext, key);
    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  test('round-trip with unicode / Vietnamese text', () => {
    const key = randomKeyBase64(32);
    const plaintext = 'Xin chào! Đây là tin nhắn tiếng Việt 🇻🇳';

    const encrypted = encryptAesCbc(plaintext, key);
    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  test('round-trip with long text (> 1 AES block)', () => {
    const key = randomKeyBase64(32);
    const plaintext = 'A'.repeat(1000);

    const encrypted = encryptAesCbc(plaintext, key);
    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  // --- Known test vectors ---

  test('known test vector: deterministic encryption with zero IV', () => {
    // Fixed key (32 bytes = AES-256)
    const key = Buffer.alloc(32, 0).toString('base64'); // All-zero key
    const plaintext = 'test';

    const encrypted = encryptAesCbc(plaintext, key);

    // Verify it's valid Base64
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();

    // Decrypt should return original
    const decrypted = decryptAesCbc(encrypted, key);
    expect(decrypted).toBe(plaintext);

    // Same input should always produce same output (deterministic with zero IV)
    const encrypted2 = encryptAesCbc(plaintext, key);
    expect(encrypted2).toBe(encrypted);
  });

  test('known test vector: verify against Node.js crypto directly', () => {
    const keyBytes = crypto.randomBytes(32);
    const key = keyBytes.toString('base64');
    const plaintext = 'verification test';

    // Encrypt with our function
    const encrypted = encryptAesCbc(plaintext, key);

    // Decrypt with raw Node.js crypto
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      keyBytes,
      Buffer.alloc(16, 0),
    );
    const raw = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]);

    expect(raw.toString('utf8')).toBe(plaintext);
  });

  // --- Error handling ---

  test('decrypt with wrong key should return null (after retries)', () => {
    const key1 = randomKeyBase64(32);
    const key2 = randomKeyBase64(32);
    const plaintext = 'secret message';

    const encrypted = encryptAesCbc(plaintext, key1);
    const result = decryptAesCbc(encrypted, key2);

    // Should return null after exhausting retries (3 retries)
    expect(result).toBeNull();
  });

  test('decrypt with invalid Base64 input should return null', () => {
    const key = randomKeyBase64(32);
    const result = decryptAesCbc('not-valid-base64!!!', key);
    expect(result).toBeNull();
  });

  test('decrypt with empty string should return null', () => {
    const key = randomKeyBase64(32);
    const result = decryptAesCbc('', key);
    expect(result).toBeNull();
  });

  test('decrypt handles URI-encoded input', () => {
    const key = randomKeyBase64(32);
    const plaintext = 'URI encoded test';

    const encrypted = encryptAesCbc(plaintext, key);
    // URI-encode the base64 (simulating what Zalo API might send)
    const uriEncoded = encodeURIComponent(encrypted);

    const decrypted = decryptAesCbc(uriEncoded, key);
    expect(decrypted).toBe(plaintext);
  });
});

// ─── getSignKey ─────────────────────────────────────────────────────────────

describe('getSignKey', () => {
  test('should produce MD5 hash of zsecure + data + sorted param values', () => {
    const data = 'getserverinfo';
    const params = {
      imei: 'test-imei-123',
      type: 30,
      client_version: 627,
      computer_name: 'Web',
    };

    const result = getSignKey(data, params);

    // Verify it's a valid 32-char hex MD5
    expect(result).toMatch(/^[a-f0-9]{32}$/);

    // Manually compute expected value
    // Sorted keys: client_version, computer_name, imei, type
    // signedString = "zsecure" + "getserverinfo" + "627" + "Web" + "test-imei-123" + "30"
    const expected = crypto
      .createHash('md5')
      .update('zsecuregetserverinfo627Webtest-imei-12330')
      .digest('hex');

    expect(result).toBe(expected);
  });

  test('should be deterministic', () => {
    const data = 'test';
    const params = { a: '1', b: '2' };

    const r1 = getSignKey(data, params);
    const r2 = getSignKey(data, params);
    expect(r1).toBe(r2);
  });

  test('should handle empty params', () => {
    const result = getSignKey('data', {});

    const expected = crypto
      .createHash('md5')
      .update('zsecuredata')
      .digest('hex');

    expect(result).toBe(expected);
  });

  test('param order should not matter (sorted internally)', () => {
    const params1 = { z: 'last', a: 'first', m: 'middle' };
    const params2 = { a: 'first', m: 'middle', z: 'last' };

    expect(getSignKey('test', params1)).toBe(getSignKey('test', params2));
  });
});

// ─── generateImei ───────────────────────────────────────────────────────────

describe('generateImei', () => {
  test('should return UUID-like string followed by MD5 of userAgent', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const imei = generateImei(ua);

    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-<md5>
    // UUID part (36 chars) + '-' + MD5 hash (32 chars) = 69 chars
    expect(imei).toBeTruthy();
    expect(imei).toContain('-');

    // Last 32 chars (after last '-') should be MD5 of UA
    const parts = imei.split('-');
    const md5Part = parts[parts.length - 1];
    const expectedMd5 = crypto.createHash('md5').update(ua).digest('hex');
    expect(md5Part).toBe(expectedMd5);
  });

  test('should contain "4" in UUID version position', () => {
    const imei = generateImei('test-ua');
    // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-md5
    // The '4' should be at position 14 (0-indexed) in the UUID part
    const uuidPart = imei.substring(0, 36);
    expect(uuidPart[14]).toBe('4');
  });

  test('should produce different IMEIs on each call (random)', () => {
    const ua = 'same-user-agent';
    const imei1 = generateImei(ua);
    const imei2 = generateImei(ua);

    // MD5 suffix should be same (same UA), but UUID part should differ
    // In rare cases they could collide, so we just check they're generally unique
    // We'll check the UUID part (first 36 chars)
    const uuid1 = imei1.substring(0, 36);
    const uuid2 = imei2.substring(0, 36);

    // Extremely unlikely to be equal
    expect(uuid1).not.toBe(uuid2);
  });

  test('same userAgent should produce same MD5 suffix', () => {
    const ua = 'consistent-ua';
    const imei1 = generateImei(ua);
    const imei2 = generateImei(ua);

    const parts1 = imei1.split('-');
    const parts2 = imei2.split('-');

    expect(parts1[parts1.length - 1]).toBe(parts2[parts2.length - 1]);
  });
});
