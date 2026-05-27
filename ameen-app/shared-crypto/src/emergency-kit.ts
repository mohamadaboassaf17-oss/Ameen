import { decrypt, encrypt } from './encryption';
import { deriveKey, DEFAULT_ARGON2_PARAMS } from './key-derivation';
import type { Argon2Params } from './key-derivation';

/**
 * Wrapped vault key format stored in the Emergency Kit PDF.
 *
 * The vault's 32-byte AES-256 key is encrypted with a key derived from
 * the backup passphrase using Argon2id → AES-256-GCM wrapping.
 *
 * All byte fields are hex-encoded for safe inclusion in a printed document.
 */
export interface BackupKeyData {
    /** Format version */
    version: 1;
    /** Argon2id salt, hex-encoded */
    salt: string;
    /** AES-256-GCM IV, hex-encoded */
    iv: string;
    /** Encrypted vault key (ciphertext), hex-encoded */
    ciphertext: string;
    /** AES-256-GCM authentication tag, hex-encoded */
    tag: string;
    /** Argon2id parameters used during key derivation */
    argon2Params: Argon2Params;
}

/**
 * Generate a cryptographically secure backup passphrase.
 *
 * Produces 6 groups of 4 uppercase hex digits separated by hyphens,
 * e.g. "A4F7-B29E-C801-DD43-EE92-1BFC".
 *
 * This provides 96 bits of entropy and is designed to be printed
 * on the Emergency Kit and stored safely.
 *
 * Characters `0-9` and `A-F` only — no ambiguous characters.
 *
 * @returns A 29-character passphrase string.
 */
export function generateBackupPassphrase(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const groups: string[] = [];
    for (let i = 0; i < bytes.length; i += 2) {
        const hex =
            bytes[i].toString(16).padStart(2, '0') +
            bytes[i + 1].toString(16).padStart(2, '0');
        groups.push(hex.toUpperCase());
    }
    return groups.join('-');
}

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
 * Wrap the vault's AES-256 key with a backup passphrase for the Emergency Kit.
 *
 * Derives an AES-256 key from the passphrase using Argon2id, then encrypts
 * the vault key with AES-256-GCM. The result (salt, iv, ciphertext, tag,
 * argon2 params) is stored in the Emergency Kit PDF.
 *
 * @param vaultKey   — The 32-byte AES-256 vault key to wrap.
 * @param passphrase — The backup passphrase (from {@link generateBackupPassphrase}
 *                     or user-provided).
 * @returns BackupKeyData ready for inclusion in the Emergency Kit.
 */
export async function wrapVaultKey(
    vaultKey: Uint8Array,
    passphrase: string
): Promise<BackupKeyData> {
    try {
        const { key, salt } = await deriveKey(passphrase);
        const result = await encrypt(vaultKey, key);
        return {
            version: 1,
            salt: uint8ArrayToHex(salt),
            iv: uint8ArrayToHex(result.iv),
            ciphertext: uint8ArrayToHex(result.ciphertext),
            tag: uint8ArrayToHex(result.tag),
            argon2Params: { ...DEFAULT_ARGON2_PARAMS },
        };
    } catch (error) {
        throw new Error(
            `Failed to wrap vault key: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Unwrap the vault's AES-256 key using the backup passphrase.
 *
 * Re-derives the AES-256 key from the passphrase and stored salt/params,
 * then decrypts the wrapped vault key with AES-256-GCM.
 *
 * This is used during Emergency Kit recovery flow.
 *
 * @param data       — The BackupKeyData from the Emergency Kit or stored record.
 * @param passphrase — The backup passphrase entered by the user.
 * @returns The original 32-byte AES-256 vault key.
 */
export async function unwrapVaultKey(
    data: BackupKeyData,
    passphrase: string
): Promise<Uint8Array> {
    try {
        const salt = hexToUint8Array(data.salt);
        const { key } = await deriveKey(passphrase, salt, data.argon2Params);
        const iv = hexToUint8Array(data.iv);
        const ciphertext = hexToUint8Array(data.ciphertext);
        const tag = hexToUint8Array(data.tag);
        return await decrypt(ciphertext, key, iv, tag);
    } catch (error) {
        throw new Error(
            `Failed to unwrap vault key: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Serialize BackupKeyData to a JSON string for storage or embedding.
 */
export function serializeBackupKeyData(data: BackupKeyData): string {
    return JSON.stringify(data);
}

/**
 * Parse a JSON string back into BackupKeyData.
 */
export function deserializeBackupKeyData(json: string): BackupKeyData {
    return JSON.parse(json) as BackupKeyData;
}
