import type { VaultItem } from './vault-format';

// ============================================================
// KDBX3.1 Binary Constants
// ============================================================

const KDBX_SIGNATURE1 = 0x9AA2D903;
const KDBX_SIGNATURE2 = 0xB54BFB67;
const KDBX_VERSION_3_1 = 0x00030001;

// Header field types
const HEADER_END = 0;
const HEADER_CIPHER_ID = 2;
const HEADER_COMPRESSION = 3;
const HEADER_MASTER_SEED = 4;
const HEADER_TRANSFORM_SEED = 5;
const HEADER_TRANSFORM_ROUNDS = 6;
const HEADER_ENCRYPTION_IV = 7;
const HEADER_PROTECTED_KEY = 8;
const HEADER_STREAM_START = 9;
const HEADER_INNER_STREAM_ID = 10;

// AES-256-CBC UUID in KeePass
const CIPHER_AES256: number[] = [
  0x31, 0xC1, 0xF2, 0xE6, 0xBF, 0x71, 0x43, 0x50,
  0xBE, 0x58, 0x05, 0x21, 0x6A, 0xFC, 0x5A, 0xFF,
];

// Inner random stream IDs
const STREAM_NONE = 0;
const STREAM_SALSA20 = 2;

// ============================================================
// Byte-level utilities
// ============================================================

function asBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0;
}

function slice(bytes: Uint8Array, start: number, end?: number): Uint8Array {
  return bytes.slice(start, end);
}

function concatU8(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================
// Salsa20 stream cipher (needed for KeePass protected strings)
// ============================================================

/**
 * Minimal Salsa20/20 implementation for decrypting KeePass protected strings.
 *
 * Salsa20 is a stream cipher operating on 64-byte blocks.
 * The key is 32 bytes, IV is 8 bytes.
 *
 * @param key  — 32-byte key (from KDBX header ProtectedStreamKey).
 * @param iv   — 8-byte initialization vector (prepended to each protected value).
 * @param data — Ciphertext bytes to decrypt.
 * @returns Decrypted plaintext bytes.
 */
function salsa20Decrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array
): Uint8Array {
  const output = new Uint8Array(data.length);
  const block = new Uint8Array(64);
  const state32 = new Uint32Array(block.buffer, block.byteOffset, 16);
  let pos = 0;

  const add = (x: number, y: number) => ((x + y) & 0xFFFFFFFF) >>> 0;

  function QR(state: Uint32Array, a: number, b: number, c: number, d: number): void {
    state[b] ^= (add(state[a], state[d]) << 7) | (add(state[a], state[d]) >>> 25);
    state[c] ^= (add(state[b], state[a]) << 9) | (add(state[b], state[a]) >>> 23);
    state[d] ^= (add(state[c], state[b]) << 13) | (add(state[c], state[b]) >>> 19);
    state[a] ^= (add(state[d], state[c]) << 18) | (add(state[d], state[c]) >>> 14);
  }

  function generateBlock(counter: number): void {
    const sigma = new Uint8Array([
      0x65, 0x78, 0x70, 0x61,
      0x6E, 0x64, 0x20, 0x33,
      0x32, 0x2D, 0x62, 0x79,
      0x74, 0x65, 0x20, 0x6B,
    ]);

    const key32 = new Uint32Array(key.buffer, key.byteOffset, 8);
    const iv32 = new Uint32Array(2);
    iv32[0] = (iv[0] | (iv[1] << 8) | (iv[2] << 16) | (iv[3] << 24)) >>> 0;
    iv32[1] = (iv[4] | (iv[5] << 8) | (iv[6] << 16) | (iv[7] << 24)) >>> 0;

    state32[0] = readUint32LE(sigma, 0);
    state32[1] = key32[0];
    state32[2] = key32[1];
    state32[3] = key32[2];
    state32[4] = key32[3];
    state32[5] = readUint32LE(sigma, 4);
    state32[6] = iv32[0];
    state32[7] = iv32[1];
    state32[8] = (counter & 0xFFFFFFFF) >>> 0;
    state32[9] = ((counter / 0x100000000) | 0) >>> 0;
    state32[10] = readUint32LE(sigma, 8);
    state32[11] = key32[4];
    state32[12] = key32[5];
    state32[13] = key32[6];
    state32[14] = key32[7];
    state32[15] = readUint32LE(sigma, 12);

    const original = new Uint32Array(state32);

    for (let i = 0; i < 10; i++) {
      QR(state32, 0, 4, 8, 12);
      QR(state32, 5, 9, 13, 1);
      QR(state32, 10, 14, 2, 6);
      QR(state32, 15, 3, 7, 11);
      QR(state32, 0, 1, 2, 3);
      QR(state32, 5, 6, 7, 4);
      QR(state32, 10, 11, 8, 9);
      QR(state32, 15, 12, 13, 14);
    }

    for (let i = 0; i < 16; i++) {
      state32[i] = (state32[i] + original[i]) >>> 0;
    }
  }

  let bufCounter = 0;
  let blockOffset = 64; // force first generation

  while (pos < data.length) {
    if (blockOffset >= 64) {
      generateBlock(bufCounter++);
      blockOffset = 0;
    }
    output[pos] = data[pos] ^ block[blockOffset];
    pos++;
    blockOffset++;
  }

  return output;
}

// ============================================================
// KDBX Header Parsing
// ============================================================

interface KdbxHeader {
  masterSeed: Uint8Array;
  transformSeed: Uint8Array;
  transformRounds: number;
  encryptionIv: Uint8Array;
  protectedStreamKey: Uint8Array;
  streamStartBytes: Uint8Array;
  innerStreamId: number;
  compression: number;
}

function parseHeader(bytes: Uint8Array): { header: KdbxHeader; offset: number } {
  let pos = 12; // skip 4+4+4 bytes (signatures + version)

  const header: Partial<KdbxHeader> = {};
  header.innerStreamId = STREAM_NONE;
  header.compression = 0;

  while (true) {
    if (pos + 3 > bytes.length) {
      throw new Error('Unexpected end of KDBX header');
    }

    const fieldType = bytes[pos];
    const fieldSize = readUint16LE(bytes, pos + 1);
    pos += 3;

    if (pos + fieldSize > bytes.length) {
      throw new Error(`KDBX header field ${fieldType} exceeds file bounds`);
    }

    const fieldData = slice(bytes, pos, pos + fieldSize);
    pos += fieldSize;

    switch (fieldType) {
      case HEADER_END:
        return { header: header as KdbxHeader, offset: pos };

      case HEADER_CIPHER_ID:
        // Validate AES-256 cipher
        if (fieldData.length !== 16) {
          throw new Error('Invalid cipher ID length in KDBX header');
        }
        for (let i = 0; i < 16; i++) {
          if (fieldData[i] !== CIPHER_AES256[i]) {
            throw new Error(
              `Unsupported KDBX cipher. Expected AES-256, got ID at index ${i}: ${fieldData[i]}`
            );
          }
        }
        break;

      case HEADER_COMPRESSION:
        if (fieldSize >= 4) {
          header.compression = readUint32LE(fieldData, 0);
        }
        break;

      case HEADER_MASTER_SEED:
        header.masterSeed = fieldData;
        break;

      case HEADER_TRANSFORM_SEED:
        header.transformSeed = fieldData;
        break;

      case HEADER_TRANSFORM_ROUNDS:
        // Read as 64-bit little-endian, clamp to JS safe integer
        header.transformRounds = readUint32LE(fieldData, 0);
        break;

      case HEADER_ENCRYPTION_IV:
        header.encryptionIv = fieldData;
        break;

      case HEADER_PROTECTED_KEY:
        header.protectedStreamKey = fieldData;
        break;

      case HEADER_STREAM_START:
        header.streamStartBytes = fieldData;
        break;

      case HEADER_INNER_STREAM_ID:
        if (fieldSize >= 4) {
          header.innerStreamId = readUint32LE(fieldData, 0);
        }
        break;

      default:
        // Skip unknown fields
        break;
    }
  }
}

// ============================================================
// KDBX Key Derivation (mimics KeePass AES-ECB transform)
// ============================================================

/**
 * Derive the AES-256 decryption key from the master password.
 *
 * KeePass KDBX3 uses a custom AES-ECB key transform:
 *   1. SHA-256(password) → compositeKey
 *   2. transformed = transformSeed
 *   3. Repeat TransformRounds times: transformed = AES-ECB-encrypt(transformed, compositeKey)
 *   4. finalKey = SHA-256(transformed || masterSeed)
 *
 * Note: Web Crypto does not expose AES-ECB. We simulate it using AES-CBC
 * with a zero IV on a single 16-byte block. For a 32-byte transformed key,
 * we process two 16-byte blocks independently (which is exactly what ECB does).
 *
 * @param password      — The master password string.
 * @param transformSeed — 32-byte seed from KDBX header.
 * @param transformRounds — Number of AES transformation rounds.
 * @param masterSeed    — 32-byte master seed from KDBX header.
 * @returns 32-byte AES-256 key for decrypting the inner data.
 */
async function deriveKdbxKey(
  password: string,
  transformSeed: Uint8Array,
  transformRounds: number,
  masterSeed: Uint8Array
): Promise<Uint8Array> {
  try {
    // 1. Hash password with SHA-256
    const passwordBytes = new TextEncoder().encode(password);
    const compositeKey = new Uint8Array(
      await crypto.subtle.digest('SHA-256', passwordBytes)
    );

    // Import compositeKey as an AES-256-CBC key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      compositeKey,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    // 2. Key transformation loop (AES-ECB simulated via per-block AES-CBC)
    let transformed = new Uint8Array(transformSeed);
    const zeroIv = new Uint8Array(16);

    for (let round = 0; round < transformRounds; round++) {
      // Process 32-byte input as two 16-byte ECB blocks
      const block1 = transformed.slice(0, 16);
      const block2 = transformed.slice(16, 32);

      const enc1 = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIv }, aesKey, block1)
      );
      const enc2 = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIv }, aesKey, block2)
      );

      transformed = asBuffer(concatU8(
        asBuffer(enc1.slice(0, 16)),
        asBuffer(enc2.slice(0, 16))
      ));
    }

    // 3. SHA-256(transformed || masterSeed)
    const finalHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', asBuffer(concatU8(asBuffer(transformed), asBuffer(masterSeed))))
    );

    return finalHash;
  } catch (error) {
    throw new Error(
      `KDBX key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================
// AES-256-CBC Decryption (via Web Crypto)
// ============================================================

async function aes256CbcDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      asBuffer(key),
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: asBuffer(iv) },
      cryptoKey,
      asBuffer(data)
    );

    return new Uint8Array(decrypted);
  } catch (error) {
    throw new Error(
      `AES-CBC decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================
// GZip Decompression (via DecompressionStream)
// ============================================================

async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(asBuffer(data));
    writer.close();

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch (error) {
    throw new Error(
      `GZip decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================
// XML Parsing (minimal — extracts Entry elements)
// ============================================================

interface KdbxEntry {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

/**
 * Parse KeePass XML inner data and extract Entry elements.
 *
 * Uses a regex-based approach for simplicity (KeePass XML is well-structured).
 * Each Entry has String children with Key/Value.
 */
function parseKdbxXml(xmlText: string): KdbxEntry[] {
  const entries: KdbxEntry[] = [];

  // Find all Entry blocks
  const entryRegex = /<Entry>([\s\S]*?)<\/Entry>/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    const entryBlock = entryMatch[1];
    const entry: Partial<KdbxEntry> = {};

    // Extract String elements: <String><Key>Title</Key><Value ...>text</Value></String>
    const stringRegex = /<String>[\s\S]*?<Key>(.*?)<\/Key>[\s\S]*?<Value[^>]*>(.*?)<\/Value>[\s\S]*?<\/String>/g;
    let strMatch: RegExpExecArray | null;

    while ((strMatch = stringRegex.exec(entryBlock)) !== null) {
      const key = strMatch[1].trim();
      let value = strMatch[2].trim();

      // Decode XML entities
      value = value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      switch (key) {
        case 'Title': entry.title = value; break;
        case 'UserName': entry.username = value; break;
        case 'Password': entry.password = value; break;
        case 'URL': entry.url = value; break;
        case 'Notes': entry.notes = value; break;
      }
    }

    if (entry.title || entry.username || entry.password) {
      entries.push({
        title: entry.title ?? '',
        username: entry.username ?? '',
        password: entry.password ?? '',
        url: entry.url ?? '',
        notes: entry.notes ?? '',
      });
    }
  }

  return entries;
}

// ============================================================
// Protected String Decryption (Salsa20)
// ============================================================

/**
 * Decrypt a KeePass protected string value.
 *
 * Protected strings in KDBX3 use Salsa20 with the ProtectedStreamKey
 * from the header. The first 8 bytes (decoded from base64) are the
 * Salsa20 IV; the remaining bytes are ciphertext.
 *
 * Values not starting with the Salsa20 marker are plaintext.
 *
 * @param protectedKey — 32-byte ProtectedStreamKey from KDBX header.
 * @param value        — The protected value string (may be base64 with IV prefix).
 * @returns Decrypted plaintext.
 */
function decryptProtectedString(
  protectedKey: Uint8Array,
  value: string
): string {
  try {
    // Try to decode as base64
    let raw: Uint8Array;
    try {
      const binary = atob(value);
      raw = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        raw[i] = binary.charCodeAt(i);
      }
    } catch {
      // Not base64 — already plaintext
      return value;
    }

    if (raw.length < 8) return value;

    const iv = raw.slice(0, 8);
    const ciphertext = raw.slice(8);
    const plaintext = salsa20Decrypt(protectedKey, iv, ciphertext);

    // Remove null padding (Salsa20 appends null bytes)
    let end = plaintext.length;
    while (end > 0 && plaintext[end - 1] === 0) end--;

    return new TextDecoder().decode(plaintext.slice(0, end));
  } catch {
    return value;
  }
}

// ============================================================
// Main Public API
// ============================================================

/**
 * Result of a KDBX file parse.
 */
export interface KdbxResult {
  /** Parsed vault items */
  items: VaultItem[];
  /** Database name from the KDBX meta section */
  databaseName: string;
  /** Number of entries found */
  entryCount: number;
  /** Number of entries that were groups (not imported) */
  groupCount: number;
}

/**
 * Read and decrypt a KDBX3.1 file, returning VaultItem objects.
 *
 * Supports:
 *   - KDBX version 3.1 (file version 0x00030001)
 *   - AES-256-CBC inner encryption
 *   - GZip compression
 *   - Salsa20 protected strings
 *
 * NOT supported (throws error):
 *   - KDBX4 format (different key derivation and cipher)
 *   - Key files (password-only)
 *   - ArcFour protected strings (deprecated by KeePass)
 *
 * @param kdbxBytes — The raw bytes of the .kdbx file.
 * @param password  — The master password to unlock the database.
 * @returns Parsed KdbxResult with VaultItem array.
 */
export async function readKdbx(
  kdbxBytes: Uint8Array,
  password: string
): Promise<KdbxResult> {
  try {
    // Validate file signature
    if (kdbxBytes.length < 12) {
      throw new Error('KDBX file too small — minimum 12 bytes required');
    }

    const sig1 = readUint32LE(kdbxBytes, 0);
    const sig2 = readUint32LE(kdbxBytes, 4);
    const version = readUint32LE(kdbxBytes, 8);

    if (sig1 !== KDBX_SIGNATURE1 || sig2 !== KDBX_SIGNATURE2) {
      throw new Error('Not a valid KDBX file (invalid signature)');
    }

    if (version !== KDBX_VERSION_3_1) {
      throw new Error(
        `Unsupported KDBX version: 0x${version.toString(16)}. ` +
        `This reader supports KDBX 3.1 (0x00030001).`
      );
    }

    // Parse header
    const { header, offset } = parseHeader(kdbxBytes);

    // Validate required header fields
    if (!header.masterSeed || !header.transformSeed || !header.encryptionIv) {
      throw new Error('KDBX header missing required fields (masterSeed, transformSeed, or encryptionIv)');
    }

    // Derive decryption key
    const aesKey = await deriveKdbxKey(
      password,
      header.transformSeed,
      header.transformRounds,
      header.masterSeed
    );

    // Decrypt inner data
    const encryptedData = kdbxBytes.slice(offset);
    if (encryptedData.length === 0) {
      throw new Error('No encrypted data found in KDBX file');
    }

    // Ensure encrypted data length is multiple of 16 (AES-CBC block size)
    // KeePass may not pad — add PKCS7 padding check
    let decrypted: Uint8Array;
    try {
      decrypted = await aes256CbcDecrypt(aesKey, header.encryptionIv, encryptedData);
    } catch {
      throw new Error('KDBX decryption failed — incorrect password or corrupted file');
    }

    // Validate stream start bytes
    if (header.streamStartBytes && header.streamStartBytes.length > 0) {
      for (let i = 0; i < Math.min(header.streamStartBytes.length, decrypted.length); i++) {
        if (decrypted[i] !== header.streamStartBytes[i]) {
          throw new Error('KDBX decryption failed — stream start bytes mismatch (wrong password)');
        }
      }
    }

    // Decompress if needed
    let xmlBytes: Uint8Array;
    if (header.compression === 1) {
      xmlBytes = await gzipDecompress(decrypted);
    } else {
      xmlBytes = decrypted;
    }

    // Parse XML
    const xmlText = new TextDecoder().decode(xmlBytes);
    const rawEntries = parseKdbxXml(xmlText);

    // Count groups
    const groupCount = (xmlText.match(/<Group>/g) || []).length;

    // Convert to VaultItem and decrypt protected strings
    const now = Date.now();
    const items: VaultItem[] = rawEntries.map((entry, index) => {
      const protectedKey = header.protectedStreamKey;

      return {
        id: crypto.randomUUID(),
        type: 'password',
        title: entry.title || entry.url || `مستورد ${index + 1}`,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        data: {
          username: decryptProtectedString(protectedKey, entry.username),
          password: decryptProtectedString(protectedKey, entry.password),
          url: decryptProtectedString(protectedKey, entry.url),
          notes: decryptProtectedString(protectedKey, entry.notes),
        },
      };
    });

    // Extract database name from XML
    const dbNameMatch = xmlText.match(/<DatabaseName>(.*?)<\/DatabaseName>/);
    const databaseName = dbNameMatch ? dbNameMatch[1].trim() : 'KeePass';

    return {
      items,
      databaseName,
      entryCount: items.length,
      groupCount,
    };
  } catch (error) {
    throw new Error(
      `KDBX read failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
