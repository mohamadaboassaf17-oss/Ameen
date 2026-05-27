import { describe, it, expect } from 'vitest';
import {
  generateBackupPassphrase,
  wrapVaultKey,
  unwrapVaultKey,
  serializeBackupKeyData,
  deserializeBackupKeyData,
} from '../src/emergency-kit';

describe('emergency-kit', () => {
  describe('generateBackupPassphrase', () => {
    it('returns 6 groups of 4 uppercase hex digits', () => {
      const passphrase = generateBackupPassphrase();
      const groups = passphrase.split('-');
      expect(groups.length).toBe(6);
      for (const group of groups) {
        expect(group.length).toBe(4);
        expect(/^[0-9A-F]{4}$/.test(group)).toBe(true);
      }
    });

    it('passphrase has 29 characters total', () => {
      const passphrase = generateBackupPassphrase();
      expect(passphrase.length).toBe(29);
    });

    it('uses only uppercase hex chars and hyphens', () => {
      const passphrase = generateBackupPassphrase();
      expect(/^[0-9A-F\-]+$/.test(passphrase)).toBe(true);
    });

    it('two calls produce different passphrases', () => {
      const p1 = generateBackupPassphrase();
      const p2 = generateBackupPassphrase();
      expect(p1).not.toBe(p2);
    });
  });

  describe('wrapVaultKey / unwrapVaultKey', () => {
    it('round-trip', async () => {
      const vaultKey = crypto.getRandomValues(new Uint8Array(32));
      const passphrase = generateBackupPassphrase();

      const wrapped = await wrapVaultKey(vaultKey, passphrase);
      expect(wrapped.version).toBe(1);
      expect(typeof wrapped.salt).toBe('string');
      expect(typeof wrapped.iv).toBe('string');
      expect(typeof wrapped.ciphertext).toBe('string');
      expect(typeof wrapped.tag).toBe('string');

      const unwrapped = await unwrapVaultKey(wrapped, passphrase);
      expect(unwrapped).toEqual(vaultKey);
    });

    it('wrong passphrase fails unwrap', async () => {
      const vaultKey = crypto.getRandomValues(new Uint8Array(32));
      const passphrase = generateBackupPassphrase();
      const wrongPassphrase = generateBackupPassphrase();

      const wrapped = await wrapVaultKey(vaultKey, passphrase);

      await expect(unwrapVaultKey(wrapped, wrongPassphrase)).rejects.toThrow();
    });

    it('tampered ciphertext fails unwrap', async () => {
      const vaultKey = crypto.getRandomValues(new Uint8Array(32));
      const passphrase = generateBackupPassphrase();

      const wrapped = await wrapVaultKey(vaultKey, passphrase);
      const tampered = {
        ...wrapped,
        ciphertext: '00'.repeat(wrapped.ciphertext.length / 2),
      };

      await expect(unwrapVaultKey(tampered, passphrase)).rejects.toThrow();
    });
  });

  describe('serializeBackupKeyData / deserializeBackupKeyData', () => {
    it('round-trip', () => {
      const data = {
        version: 1 as const,
        salt: 'aabbccdd',
        iv: 'eeff0011',
        ciphertext: 'deadbeef',
        tag: '12345678',
        argon2Params: {
          iterations: 3,
          memory: 65536,
          parallelism: 4,
          outputLength: 32,
        },
      };
      const json = serializeBackupKeyData(data);
      const parsed = deserializeBackupKeyData(json);
      expect(parsed).toEqual(data);
    });
  });
});
