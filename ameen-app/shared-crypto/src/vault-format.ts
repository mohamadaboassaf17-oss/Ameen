import { decrypt, encrypt } from './encryption';

export interface VaultItem {
  id: string;
  type: 'password' | 'note' | 'card';
  title: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  data: Record<string, string>;
  isConflict?: boolean;
  conflictDate?: number;
  conflictOriginalId?: string;
}

export function incrementRevision(item: VaultItem): VaultItem {
  return {
    ...item,
    revision: item.revision + 1,
    updatedAt: Date.now(),
  };
}

export interface VaultData {
  version: 1;
  vaultId: string;
  items: VaultItem[];
}

export function serializeVault(data: VaultData): Uint8Array {
  const json = JSON.stringify(data);
  return new TextEncoder().encode(json);
}

export function deserializeVault(bytes: Uint8Array): VaultData {
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as VaultData;
}

export async function encryptVault(
  vault: VaultData,
  key: Uint8Array
): Promise<{ encrypted: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  const serialized = serializeVault(vault);
  const result = await encrypt(serialized, key);
  return { encrypted: result.ciphertext, iv: result.iv, tag: result.tag };
}

export async function decryptVault(
  encrypted: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array
): Promise<VaultData> {
  const decrypted = await decrypt(encrypted, key, iv, tag);
  return deserializeVault(decrypted);
}
