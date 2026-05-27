import { describe, it, expect } from 'vitest';
import {
  generateRecoveryKeyPair,
  importRecoveryPublicKey,
  importRecoveryPrivateKey,
  encryptRecoveryKey,
  decryptRecoveryKey,
  generateVaultKey,
  reEncryptVault,
} from '../src/recovery';

describe('recovery', () => {
  describe('generateVaultKey', () => {
    it('returns 32-byte key', () => {
      const key = generateVaultKey();
      expect(key.length).toBe(32);
      expect(key).toBeInstanceOf(Uint8Array);
    });

    it('two calls produce different keys', () => {
      const k1 = generateVaultKey();
      const k2 = generateVaultKey();
      expect(k1).not.toEqual(k2);
    });
  });

  describe('generateRecoveryKeyPair', () => {
    it('generates valid key pair with base64 exports', async () => {
      const { publicKey, privateKey, publicKeyBase64, privateKeyBase64 } =
        await generateRecoveryKeyPair();

      expect(publicKey).toBeDefined();
      expect(privateKey).toBeDefined();
      expect(typeof publicKeyBase64).toBe('string');
      expect(typeof privateKeyBase64).toBe('string');
      expect(publicKeyBase64.length).toBeGreaterThan(0);
      expect(privateKeyBase64.length).toBeGreaterThan(0);
    }, 30000);

    it('public and private key base64 strings differ', async () => {
      const { publicKeyBase64, privateKeyBase64 } =
        await generateRecoveryKeyPair();
      expect(publicKeyBase64).not.toBe(privateKeyBase64);
    }, 30000);
  });

  describe('encryptRecoveryKey / decryptRecoveryKey', () => {
    it('round-trip with generated key pair', async () => {
      const { publicKey, privateKey } = await generateRecoveryKeyPair();
      const vaultKey = generateVaultKey();

      const encrypted = await encryptRecoveryKey(vaultKey, publicKey);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = await decryptRecoveryKey(encrypted, privateKey);
      expect(decrypted).toEqual(vaultKey);
    }, 30000);

    it('wrong private key fails decryption', async () => {
      const { publicKey } = await generateRecoveryKeyPair();
      const { privateKey: wrongKey } = await generateRecoveryKeyPair();
      const vaultKey = generateVaultKey();

      const encrypted = await encryptRecoveryKey(vaultKey, publicKey);

      await expect(decryptRecoveryKey(encrypted, wrongKey)).rejects.toThrow();
    }, 30000);
  });

  describe('importRecoveryPublicKey', () => {
    it('imports a public key and allows encryption', async () => {
      const { publicKeyBase64 } = await generateRecoveryKeyPair();
      const importedKey = await importRecoveryPublicKey(publicKeyBase64);
      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('public');

      const vaultKey = generateVaultKey();
      const encrypted = await encryptRecoveryKey(vaultKey, importedKey);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('importRecoveryPrivateKey', () => {
    it('imports a private key and allows full round-trip', async () => {
      const { publicKeyBase64, privateKeyBase64 } = await generateRecoveryKeyPair();
      const pubKey = await importRecoveryPublicKey(publicKeyBase64);
      const privKey = await importRecoveryPrivateKey(privateKeyBase64);

      expect(privKey).toBeDefined();
      expect(privKey.type).toBe('private');

      const vaultKey = generateVaultKey();
      const encrypted = await encryptRecoveryKey(vaultKey, pubKey);
      const decrypted = await decryptRecoveryKey(encrypted, privKey);
      expect(decrypted).toEqual(vaultKey);
    }, 30000);
  });

  describe('reEncryptVault', () => {
    it('re-encrypts vault data with new password', async () => {
      const oldKey = generateVaultKey();
      const plaintext = JSON.stringify({
        version: 1,
        vaultId: crypto.randomUUID(),
        items: [
          {
            id: crypto.randomUUID(),
            type: 'password',
            title: 'Test',
            revision: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: { username: 'user', password: 'pass' },
          },
        ],
      });
      const encoded = new TextEncoder().encode(plaintext);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        oldKey,
        'AES-GCM',
        false,
        ['encrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encoded
      );
      const combined = new Uint8Array(encrypted);
      const ciphertext = combined.slice(0, combined.length - 16);
      const tag = combined.slice(combined.length - 16);

      function toHex(b: Uint8Array): string {
        return Array.from(b)
          .map((x) => x.toString(16).padStart(2, '0'))
          .join('');
      }

      const vaultData = {
        salt: toHex(crypto.getRandomValues(new Uint8Array(16))),
        iv: toHex(iv),
        ciphertext: toHex(ciphertext),
        tag: toHex(tag),
      };

      const result = await reEncryptVault(vaultData, oldKey, 'new-password');

      expect(typeof result.newSalt).toBe('string');
      expect(result.newSalt.length).toBeGreaterThan(0);
      expect(typeof result.newIv).toBe('string');
      expect(result.newIv.length).toBeGreaterThan(0);
      expect(typeof result.newCiphertext).toBe('string');
      expect(result.newCiphertext.length).toBeGreaterThan(0);
      expect(typeof result.newTag).toBe('string');
      expect(result.newTag.length).toBeGreaterThan(0);
    }, 30000);
  });
});
