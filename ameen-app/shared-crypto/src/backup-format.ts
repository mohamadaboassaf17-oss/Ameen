import { decrypt, encrypt } from './encryption';
import { deserializeVault, serializeVault } from './vault-format';
import type { VaultData } from './vault-format';

/**
 * Container metadata for an encrypted vault backup file (.ameen-backup).
 *
 * The ciphertext is the full VaultData (all items), serialized as JSON,
 * then encrypted with AES-256-GCM using the vault's master key.
 *
 * The file itself is a plain JSON document containing this manifest —
 * only the ciphertext field holds encrypted data. This allows the file
 * to be inspected for metadata (profile name, date) without decryption.
 */
export interface BackupManifest {
  /** Format version — currently always 1 */
  version: 1;
  /** Display name of the profile this backup belongs to */
  profileName: string;
  /** The vault's unique identifier */
  vaultId: string;
  /** Unix timestamp (ms) when the backup was created */
  createdAt: number;
  /** AES-256-GCM initialization vector, hex-encoded */
  iv: string;
  /** AES-256-GCM ciphertext, hex-encoded */
  ciphertext: string;
  /** AES-256-GCM authentication tag, hex-encoded */
  tag: string;
}

const BACKUP_VERSION = 1;

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt a full vault and wrap it in a BackupManifest.
 *
 * The vault is serialized to JSON and encrypted with the provided AES-256 key.
 * The resulting manifest is suitable for writing to a .ameen-backup file.
 *
 * @param vault   — The full vault data to back up.
 * @param key     — The vault's 32-byte AES-256 master key.
 * @param profileName — Human-readable profile name stored in plaintext metadata.
 * @returns A complete BackupManifest ready for JSON serialization.
 */
export async function encryptBackup(
  vault: VaultData,
  key: Uint8Array,
  profileName: string
): Promise<BackupManifest> {
  try {
    const serialized = serializeVault(vault);
    const result = await encrypt(serialized, key);
    return {
      version: BACKUP_VERSION,
      profileName,
      vaultId: vault.vaultId,
      createdAt: Date.now(),
      iv: uint8ArrayToHex(result.iv),
      ciphertext: uint8ArrayToHex(result.ciphertext),
      tag: uint8ArrayToHex(result.tag),
    };
  } catch (error) {
    throw new Error(
      `Backup encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt a BackupManifest back into a VaultData object.
 *
 * Validates the version field, then decrypts the ciphertext using the
 * provided AES-256 key and hex-decoded IV/tag.
 *
 * @param manifest — The backup manifest (parsed from .ameen-backup JSON).
 * @param key      — The vault's 32-byte AES-256 master key.
 * @returns The original VaultData.
 * @throws If the version is unsupported or decryption fails.
 */
export async function decryptBackup(
  manifest: BackupManifest,
  key: Uint8Array
): Promise<VaultData> {
  try {
    if (manifest.version !== BACKUP_VERSION) {
      throw new Error(
        `Unsupported backup version: ${manifest.version}. ` +
        `This application supports version ${BACKUP_VERSION}.`
      );
    }
    const iv = hexToUint8Array(manifest.iv);
    const ciphertext = hexToUint8Array(manifest.ciphertext);
    const tag = hexToUint8Array(manifest.tag);
    const decrypted = await decrypt(ciphertext, key, iv, tag);
    return deserializeVault(decrypted);
  } catch (error) {
    throw new Error(
      `Backup decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Serialize a BackupManifest to a JSON string for writing to disk.
 */
export function serializeBackup(manifest: BackupManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Parse a JSON string into a BackupManifest.
 *
 * This does NOT validate the manifest structure — use
 * {@link validateBackupManifest} for runtime type checking.
 */
export function deserializeBackup(json: string): BackupManifest {
  return JSON.parse(json) as BackupManifest;
}

/**
 * Runtime type guard: checks whether an unknown value conforms to BackupManifest.
 *
 * Use this after deserializing a file to confirm it is a valid .ameen-backup
 * before attempting decryption.
 */
export function validateBackupManifest(
  manifest: unknown
): manifest is BackupManifest {
  if (typeof manifest !== 'object' || manifest === null) return false;
  const m = manifest as Record<string, unknown>;
  return (
    m.version === BACKUP_VERSION &&
    typeof m.profileName === 'string' &&
    typeof m.vaultId === 'string' &&
    typeof m.createdAt === 'number' &&
    typeof m.iv === 'string' &&
    typeof m.ciphertext === 'string' &&
    typeof m.tag === 'string'
  );
}
