import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptString, decryptToString } from '../src/encryption';

function generateKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

describe('encryption', () => {
  describe('generateKey', () => {
    it('returns 32-byte key', () => {
      const key = generateKey();
      expect(key.length).toBe(32);
      expect(key).toBeInstanceOf(Uint8Array);
    });
  });

  describe('encrypt + decrypt', () => {
    it('round-trip with random binary data', async () => {
      const key = generateKey();
      const plaintext = crypto.getRandomValues(new Uint8Array(256));
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, key, iv, tag);
      expect(decrypted).toEqual(plaintext);
    });

    it('round-trip with empty data', async () => {
      const key = generateKey();
      const plaintext = new Uint8Array(0);
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, key, iv, tag);
      expect(decrypted).toEqual(plaintext);
      expect(decrypted.length).toBe(0);
    });

    it('round-trip with single byte', async () => {
      const key = generateKey();
      const plaintext = new Uint8Array([42]);
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, key, iv, tag);
      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('encryptString + decryptToString', () => {
    it('round-trip with string data', async () => {
      const key = generateKey();
      const plaintext = 'Hello, أهلاً بالعالم!';
      const { ciphertext, iv, tag } = await encryptString(plaintext, key);
      const decrypted = await decryptToString(ciphertext, key, iv, tag);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trip with long unicode string', async () => {
      const key = generateKey();
      const plaintext = '🚀'.repeat(1000) + '日本語 текст 🎉';
      const { ciphertext, iv, tag } = await encryptString(plaintext, key);
      const decrypted = await decryptToString(ciphertext, key, iv, tag);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('security properties', () => {
    it('tampered ciphertext fails decryption', async () => {
      const key = generateKey();
      const plaintext = crypto.getRandomValues(new Uint8Array(64));
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);

      const tampered = new Uint8Array(ciphertext);
      tampered[0] = tampered[0] ^ 0xFF;

      await expect(decrypt(tampered, key, iv, tag)).rejects.toThrow();
    });

    it('tampered tag fails decryption', async () => {
      const key = generateKey();
      const plaintext = crypto.getRandomValues(new Uint8Array(64));
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);

      const tamperedTag = new Uint8Array(tag);
      tamperedTag[0] = tamperedTag[0] ^ 0xFF;

      await expect(decrypt(ciphertext, key, iv, tamperedTag)).rejects.toThrow();
    });

    it('wrong key fails decryption', async () => {
      const key = generateKey();
      const wrongKey = generateKey();
      const plaintext = crypto.getRandomValues(new Uint8Array(64));
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);

      await expect(decrypt(ciphertext, wrongKey, iv, tag)).rejects.toThrow();
    });

    it('two encryptions of same data produce different ciphertexts', async () => {
      const key = generateKey();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const result1 = await encrypt(plaintext, key);
      const result2 = await encrypt(plaintext, key);

      expect(result1.ciphertext).not.toEqual(result2.ciphertext);
      expect(result1.iv).not.toEqual(result2.iv);
    });

    it('IV is 12 bytes', async () => {
      const key = generateKey();
      const result = await encrypt(new Uint8Array([1, 2, 3]), key);
      expect(result.iv.length).toBe(12);
    });

    it('tag is 16 bytes', async () => {
      const key = generateKey();
      const result = await encrypt(new Uint8Array([1, 2, 3]), key);
      expect(result.tag.length).toBe(16);
    });
  });
});
