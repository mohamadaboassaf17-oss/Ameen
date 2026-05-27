import { describe, it, expect } from 'vitest';
import { deriveKey, DEFAULT_ARGON2_PARAMS } from '../src/key-derivation';

describe('key-derivation', () => {
  const password = 'correct-horse-battery-staple';
  const otherPassword = 'incorrect-donkey-battery-nail';

  describe('deriveKey', () => {
    it('returns 32-byte output key', async () => {
      const { key, salt } = await deriveKey(password);
      expect(key.length).toBe(32);
      expect(key).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('same password+salt produces same key', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const result1 = await deriveKey(password, salt);
      const result2 = await deriveKey(password, salt);
      expect(result1.key).toEqual(result2.key);
    });

    it('different password produces different key', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const result1 = await deriveKey(password, salt);
      const result2 = await deriveKey(otherPassword, salt);
      expect(result1.key).not.toEqual(result2.key);
    });

    it('different salt produces different key with same password', async () => {
      const result1 = await deriveKey(password);
      const result2 = await deriveKey(password);
      expect(result1.key).not.toEqual(result2.key);
      expect(result1.salt).not.toEqual(result2.salt);
    });

    it('supports custom argon2 params', async () => {
      const result = await deriveKey(password, undefined, {
        iterations: 2,
        memory: 32 * 1024,
        parallelism: 2,
      });
      expect(result.key.length).toBe(32);
    });

    it('returns salt when called without explicit salt', async () => {
      const result = await deriveKey(password);
      expect(result.salt).toBeInstanceOf(Uint8Array);
      expect(result.salt.length).toBe(16);
    });

    it('uses provided salt when given', async () => {
      const salt = new Uint8Array(16).fill(0xAB);
      const result = await deriveKey(password, salt);
      expect(result.salt).toEqual(salt);
    });

    it('default params match expected values', () => {
      expect(DEFAULT_ARGON2_PARAMS.iterations).toBe(3);
      expect(DEFAULT_ARGON2_PARAMS.memory).toBe(64 * 1024);
      expect(DEFAULT_ARGON2_PARAMS.parallelism).toBe(4);
      expect(DEFAULT_ARGON2_PARAMS.outputLength).toBe(32);
    });
  });
});
