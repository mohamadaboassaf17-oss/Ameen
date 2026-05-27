import { describe, it, expect } from 'vitest';
import {
  serializeVault,
  deserializeVault,
  encryptVault,
  decryptVault,
  incrementRevision,
} from '../src/vault-format';
import type { VaultData, VaultItem } from '../src/vault-format';

function makeKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function makeVaultData(): VaultData {
  return {
    version: 1,
    vaultId: crypto.randomUUID(),
    items: [
      {
        id: crypto.randomUUID(),
        type: 'password',
        title: 'Test Entry',
        revision: 1,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        data: { username: 'user', password: 'pass', url: 'https://example.com' },
      },
    ],
  };
}

describe('vault-format', () => {
  describe('serializeVault / deserializeVault', () => {
    it('round-trip', () => {
      const vault = makeVaultData();
      const bytes = serializeVault(vault);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);

      const restored = deserializeVault(bytes);
      expect(restored).toEqual(vault);
    });
  });

  describe('encryptVault / decryptVault', () => {
    it('round-trip', async () => {
      const key = makeKey();
      const vault = makeVaultData();
      const { encrypted, iv, tag } = await encryptVault(vault, key);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(tag).toBeInstanceOf(Uint8Array);

      const decrypted = await decryptVault(encrypted, key, iv, tag);
      expect(decrypted).toEqual(vault);
    });

    it('wrong key fails', async () => {
      const key = makeKey();
      const wrongKey = makeKey();
      const vault = makeVaultData();
      const { encrypted, iv, tag } = await encryptVault(vault, key);

      await expect(decryptVault(encrypted, wrongKey, iv, tag)).rejects.toThrow();
    });
  });

  describe('incrementRevision', () => {
    it('increments revision by 1', () => {
      const item: VaultItem = {
        id: 'test-1',
        type: 'password',
        title: 'Test',
        revision: 3,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        data: {},
      };
      const updated = incrementRevision(item);
      expect(updated.revision).toBe(4);
      expect(updated.updatedAt).toBeGreaterThan(1700000000000);
    });

    it('does not mutate original item', () => {
      const item: VaultItem = {
        id: 'test-1',
        type: 'password',
        title: 'Test',
        revision: 3,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        data: {},
      };
      const updated = incrementRevision(item);
      expect(item.revision).toBe(3);
      expect(updated).not.toBe(item);
    });
  });
});
