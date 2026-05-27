import { describe, it, expect } from 'vitest';
import {
  encryptBackup,
  decryptBackup,
  serializeBackup,
  deserializeBackup,
  validateBackupManifest,
} from '../src/backup-format';
import type { BackupManifest, VaultData, VaultItem } from '../src/backup-format';

function makeKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function makeVault(): VaultData {
  return {
    version: 1,
    vaultId: crypto.randomUUID(),
    items: [
      {
        id: crypto.randomUUID(),
        type: 'password',
        title: 'test-entry',
        revision: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: { username: 'user@example.com', password: 's3cret!' },
      },
    ],
  };
}

describe('backup-format', () => {
  describe('serializeBackup / deserializeBackup', () => {
    it('round-trip', () => {
      const manifest: BackupManifest = {
        version: 1,
        profileName: 'Test Profile',
        vaultId: 'abc-123',
        createdAt: 1700000000000,
        iv: 'aabbccdd',
        ciphertext: 'deadbeef',
        tag: '0123456789abcdef',
      };
      const json = serializeBackup(manifest);
      const parsed = deserializeBackup(json);
      expect(parsed).toEqual(manifest);
    });
  });

  describe('encryptBackup / decryptBackup', () => {
    it('round-trip', async () => {
      const key = makeKey();
      const vault = makeVault();
      const manifest = await encryptBackup(vault, key, 'My Profile');
      expect(manifest.version).toBe(1);
      expect(manifest.profileName).toBe('My Profile');
      expect(manifest.vaultId).toBe(vault.vaultId);
      expect(typeof manifest.iv).toBe('string');
      expect(typeof manifest.ciphertext).toBe('string');
      expect(typeof manifest.tag).toBe('string');
      expect(manifest.createdAt).toBeGreaterThan(0);

      const decrypted = await decryptBackup(manifest, key);
      expect(decrypted.items).toEqual(vault.items);
      expect(decrypted.vaultId).toBe(vault.vaultId);
    });

    it('wrong key fails decryption', async () => {
      const key = makeKey();
      const wrongKey = makeKey();
      const vault = makeVault();
      const manifest = await encryptBackup(vault, key, 'My Profile');

      await expect(decryptBackup(manifest, wrongKey)).rejects.toThrow();
    });

    it('wrong version fails decryption', async () => {
      const key = makeKey();
      const manifest: BackupManifest = {
        version: 99 as any,
        profileName: 'Test',
        vaultId: 'abc',
        createdAt: Date.now(),
        iv: 'aa',
        ciphertext: 'bb',
        tag: 'cc',
      };

      await expect(decryptBackup(manifest, key)).rejects.toThrow();
    });
  });

  describe('validateBackupManifest', () => {
    it('returns true for valid manifest', () => {
      const manifest: BackupManifest = {
        version: 1,
        profileName: 'Test',
        vaultId: 'abc-123',
        createdAt: 1700000000000,
        iv: 'aabbccdd',
        ciphertext: 'deadbeef',
        tag: '0123456789abcdef',
      };
      expect(validateBackupManifest(manifest)).toBe(true);
    });

    it('returns false for null', () => {
      expect(validateBackupManifest(null)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(validateBackupManifest('not an object')).toBe(false);
    });

    it('returns false when missing profileName', () => {
      const bad = {
        version: 1,
        vaultId: 'abc-123',
        createdAt: 1700000000000,
        iv: 'aabbccdd',
        ciphertext: 'deadbeef',
        tag: '0123456789abcdef',
      };
      expect(validateBackupManifest(bad)).toBe(false);
    });

    it('returns false when missing vaultId', () => {
      const bad = {
        version: 1,
        profileName: 'Test',
        createdAt: 1700000000000,
        iv: 'aabbccdd',
        ciphertext: 'deadbeef',
        tag: '0123456789abcdef',
      };
      expect(validateBackupManifest(bad)).toBe(false);
    });

    it('returns false when missing createdAt', () => {
      const bad = {
        version: 1,
        profileName: 'Test',
        vaultId: 'abc-123',
        iv: 'aabbccdd',
        ciphertext: 'deadbeef',
        tag: '0123456789abcdef',
      };
      expect(validateBackupManifest(bad)).toBe(false);
    });

    it('returns false when version is wrong', () => {
      const bad = {
        version: 2,
        profileName: 'Test',
        vaultId: 'abc-123',
        createdAt: 1700000000000,
        iv: 'aabbccdd',
        ciphertext: 'deadbeef',
        tag: '0123456789abcdef',
      };
      expect(validateBackupManifest(bad)).toBe(false);
    });
  });
});
