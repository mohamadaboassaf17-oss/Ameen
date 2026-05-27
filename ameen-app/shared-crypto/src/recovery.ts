import { decrypt, encrypt } from './encryption';
import { deriveKey } from './key-derivation';

const RSA_ALGORITHM: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};

const RSA_GEN_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const RSA_ENCRYPT_PARAMS: RsaOaepParams = {
  name: 'RSA-OAEP',
};

function asBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}

const VAULT_KEY_LENGTH = 32;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
 * Generate an RSA-OAEP key pair for parental recovery.
 *
 * The parent holds the private key; the public key is used to encrypt
 * a child's vault AES key so the parent can recover access later.
 * Uses RSA-OAEP with SHA-256 hash and 4096-bit modulus.
 * Keys are also exported as base64 SPKI (public) and PKCS8 (private)
 * strings suitable for persistent storage.
 *
 * @returns CryptoKey pair and their base64-encoded exports.
 */
export async function generateRecoveryKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase64: string;
  privateKeyBase64: string;
}> {
  try {
    const keyPair = await crypto.subtle.generateKey(RSA_GEN_PARAMS, true, [
      'encrypt',
      'decrypt',
    ]);

    const publicKey = keyPair.publicKey;
    const privateKey = keyPair.privateKey;

    const rawPublic = await crypto.subtle.exportKey('spki', publicKey);
    const rawPrivate = await crypto.subtle.exportKey('pkcs8', privateKey);

    const publicKeyBase64 = uint8ArrayToBase64(new Uint8Array(rawPublic));
    const privateKeyBase64 = uint8ArrayToBase64(new Uint8Array(rawPrivate));

    return { publicKey, privateKey, publicKeyBase64, privateKeyBase64 };
  } catch (error) {
    throw new Error(
      `Failed to generate recovery key pair: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Import a parental recovery public key from a base64-encoded SPKI string.
 *
 * Used when setting up parental recovery for a new child profile:
 * the child's vault AES key is encrypted with this public key.
 *
 * @param publicKeyBase64 - The base64 SPKI-encoded public key.
 * @returns A CryptoKey suitable for use with {@link encryptRecoveryKey}.
 */
export async function importRecoveryPublicKey(
  publicKeyBase64: string
): Promise<CryptoKey> {
  try {
    const keyData = base64ToUint8Array(publicKeyBase64);
    return await crypto.subtle.importKey(
      'spki',
      asBuffer(keyData),
      RSA_ALGORITHM,
      true,
      ['encrypt']
    );
  } catch (error) {
    throw new Error(
      `Failed to import recovery public key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Import a parental recovery private key from a base64-encoded PKCS8 string.
 *
 * Used by the parent during a child's password reset to decrypt the
 * recovery key and regain access to the child's vault.
 *
 * @param privateKeyBase64 - The base64 PKCS8-encoded private key.
 * @returns A CryptoKey suitable for use with {@link decryptRecoveryKey}.
 */
export async function importRecoveryPrivateKey(
  privateKeyBase64: string
): Promise<CryptoKey> {
  try {
    const keyData = base64ToUint8Array(privateKeyBase64);
    return await crypto.subtle.importKey(
      'pkcs8',
      asBuffer(keyData),
      RSA_ALGORITHM,
      true,
      ['decrypt']
    );
  } catch (error) {
    throw new Error(
      `Failed to import recovery private key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Encrypt a child's vault AES key with the parent's RSA-OAEP public key.
 *
 * This produces a recovery key that only the parent can decrypt with
 * their private key. The result is stored in the profile index as a
 * base64 string so the parent can initiate a password reset later.
 *
 * @param vaultKey - The child's 32-byte AES-256 vault key.
 * @param parentPublicKey - The parent's imported RSA public key.
 * @returns Base64-encoded ciphertext of the encrypted vault key.
 */
export async function encryptRecoveryKey(
  vaultKey: Uint8Array,
  parentPublicKey: CryptoKey
): Promise<string> {
  try {
    const encrypted = await crypto.subtle.encrypt(
      RSA_ENCRYPT_PARAMS,
      parentPublicKey,
      asBuffer(vaultKey)
    );
    return uint8ArrayToBase64(new Uint8Array(encrypted));
  } catch (error) {
    throw new Error(
      `Failed to encrypt recovery key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt a child's encrypted recovery key with the parent's RSA-OAEP private key.
 *
 * This recovers the child's original AES-256 vault key, allowing the
 * parent to decrypt the vault and reset the child's password.
 *
 * @param encryptedKeyBase64 - The base64-encoded encrypted recovery key
 *   retrieved from the child's profile entry.
 * @param parentPrivateKey - The parent's imported RSA private key.
 * @returns The original 32-byte AES-256 vault key.
 */
export async function decryptRecoveryKey(
  encryptedKeyBase64: string,
  parentPrivateKey: CryptoKey
): Promise<Uint8Array> {
  try {
    const encryptedData = base64ToUint8Array(encryptedKeyBase64);
    const decrypted = await crypto.subtle.decrypt(
      RSA_ENCRYPT_PARAMS,
      parentPrivateKey,
      asBuffer(encryptedData)
    );
    return new Uint8Array(decrypted);
  } catch (error) {
    throw new Error(
      `Failed to decrypt recovery key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate a cryptographically secure random AES-256 key for a new vault.
 *
 * Uses {@link crypto.getRandomValues} to produce 32 bytes of
 * high-entropy randomness suitable as an AES-256 key.
 *
 * @returns A 32-byte Uint8Array.
 */
export function generateVaultKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(VAULT_KEY_LENGTH));
}

/**
 * Re-encrypt a vault with a new key derived from a new password.
 *
 * Used during parental password reset to move the child to a fresh
 * master password while keeping the vault contents intact:
 *
 * 1. Decrypts the existing vault ciphertext with `oldKey`.
 * 2. Derives a new AES key from `newPassword` using Argon2id.
 * 3. Encrypts the decrypted vault data with the new key.
 *
 * After this operation the caller should also update the recovery key
 * via {@link encryptRecoveryKey} so that future recovery is possible
 * with the new vault key.
 *
 * @param vaultData - The encrypted vault snapshot with hex-encoded fields.
 * @param oldKey - The existing AES-256 vault key (recovered via
 *   {@link decryptRecoveryKey}).
 * @param newPassword - The child's new master password.
 * @returns The new encrypted vault data with hex-encoded values.
 */
export async function reEncryptVault(
  vaultData: { salt: string; iv: string; ciphertext: string; tag?: string },
  oldKey: Uint8Array,
  newPassword: string
): Promise<{
  newSalt: string;
  newIv: string;
  newCiphertext: string;
  newTag: string;
}> {
  try {
    const tag = vaultData.tag ?? '';
    const ivBytes = hexToUint8Array(vaultData.iv);
    const ciphertextBytes = hexToUint8Array(vaultData.ciphertext);
    const tagBytes = hexToUint8Array(tag);

    const decryptedData = await decrypt(
      ciphertextBytes,
      oldKey,
      ivBytes,
      tagBytes
    );

    const { key: newKey, salt: newSalt } = await deriveKey(newPassword);

    const encrypted = await encrypt(decryptedData, newKey);

    return {
      newSalt: uint8ArrayToHex(newSalt),
      newIv: uint8ArrayToHex(encrypted.iv),
      newCiphertext: uint8ArrayToHex(encrypted.ciphertext),
      newTag: uint8ArrayToHex(encrypted.tag),
    };
  } catch (error) {
    throw new Error(
      `Failed to re-encrypt vault: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
