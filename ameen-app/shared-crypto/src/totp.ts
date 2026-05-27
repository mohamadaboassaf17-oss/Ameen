// ============================================================================
// TOTP (Time-based One-Time Password) — RFC 6238
//
// Generates time-limited one-time passcodes for multi-factor authentication.
// Uses Web Crypto APIs only: no external dependencies.
// ============================================================================

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_ALGORITHM: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1';
const SECRET_BYTE_LENGTH = 20;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface TOTPOptions {
  digits?: number;
  period?: number;
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512';
}

export interface TOTPResult {
  code: string;
  remainingSeconds: number;
  nextCodeAt: number;
}

export interface TOTPURIResult {
  secret: string;
  label: string;
  issuer?: string;
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512';
  digits?: 6 | 8;
  period?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function asBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}

/**
 * Decode an RFC 4648 base32 string into raw bytes.
 *
 * Accepts uppercase A–Z and digits 2–7. Ignores whitespace, treats lowercase
 * as uppercase, and tolerates optional `=` padding.
 *
 * @throws {Error} if the input contains invalid characters.
 */
function base32ToBytes(str: string): Uint8Array {
  const cleaned = str.replace(/\s/g, '').toUpperCase().replace(/=+$/, '');
  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }

  const bits: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error(
        `Invalid base32 character '${cleaned[i]}' at position ${i}`
      );
    }
    for (let b = 4; b >= 0; b--) {
      bits.push((val >> b) & 1);
    }
  }

  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i * 8 + b];
    }
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Encode raw bytes to an RFC 4648 base32 string (uppercase, no padding).
 */
function bytesToBase32(bytes: Uint8Array): string {
  let result = '';
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      result += BASE32_ALPHABET[(buffer >> bitsInBuffer) & 0x1f];
    }
  }

  if (bitsInBuffer > 0) {
    result += BASE32_ALPHABET[(buffer << (5 - bitsInBuffer)) & 0x1f];
  }

  return result;
}

/**
 * Build an 8-byte big-endian counter buffer from a numeric counter value.
 */
function counterToBuffer(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  return buf;
}

/**
 * Compute an HMAC digest over `data` using the given key and algorithm.
 */
async function hmacDigest(
  keyBytes: Uint8Array,
  data: Uint8Array,
  algorithm: string
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    asBuffer(keyBytes),
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, asBuffer(data));
  return new Uint8Array(signature);
}

/**
 * Apply dynamic truncation per RFC 4226 section 5.4.
 *
 * Uses the low-order 4 bits of the last HMAC byte as the offset, then
 * extracts 4 bytes starting at that offset and masks the most significant
 * bit (to avoid signed/unsigned confusion).
 *
 * @param hmac - The raw HMAC-SHA output.
 * @returns A 31-bit unsigned integer.
 */
function dynamicTruncation(hmac: Uint8Array): number {
  const offset = hmac[hmac.length - 1] & 0x0f;
  return (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  );
}

/**
 * Validate and sanitise TOTP options, filling in defaults.
 */
function resolveOptions(options?: TOTPOptions): {
  digits: number;
  period: number;
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512';
} {
  const digits = options?.digits ?? DEFAULT_DIGITS;
  const period = options?.period ?? DEFAULT_PERIOD;
  const algorithm = options?.algorithm ?? DEFAULT_ALGORITHM;

  if (digits !== 6 && digits !== 8) {
    throw new Error(
      `Invalid digits: ${digits}. Supported values are 6 and 8.`
    );
  }
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error(
      `Invalid period: ${period}. Must be a positive integer.`
    );
  }
  if (
    algorithm !== 'SHA-1' &&
    algorithm !== 'SHA-256' &&
    algorithm !== 'SHA-512'
  ) {
    throw new Error(
      `Invalid algorithm: ${algorithm}. Supported values are SHA-1, SHA-256, SHA-512.`
    );
  }

  return { digits, period, algorithm };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Generate a TOTP code from a base32-encoded secret.
 *
 * Computes the HMAC-based one-time password for the current time window
 * according to RFC 6238 using the Web Crypto API.  The returned object
 * includes the zero-padded passcode, seconds until expiry, and the Unix
 * timestamp (ms) of the next window boundary — suitable for driving a UI
 * countdown timer.
 *
 * @param secret - Base32-encoded shared secret (whitespace is tolerated).
 * @param options - Optional parameters for digits, period, and HMAC algorithm.
 * @returns The generated code and timing metadata.
 *
 * @throws {Error} if the secret contains invalid base32 characters.
 */
export async function generateTOTP(
  secret: string,
  options?: TOTPOptions
): Promise<TOTPResult> {
  const { digits, period, algorithm } = resolveOptions(options);
  const keyBytes = base32ToBytes(secret);
  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBuf = counterToBuffer(counter);

  const hmac = await hmacDigest(keyBytes, counterBuf, algorithm);
  const truncated = dynamicTruncation(hmac);
  const otp = truncated % 10 ** digits;

  const remainingSeconds = getRemainingSeconds(period);
  const nextCodeAt = (Math.floor(Date.now() / 1000 / period) + 1) * period * 1000;

  return {
    code: otp.toString().padStart(digits, '0'),
    remainingSeconds,
    nextCodeAt,
  };
}

/**
 * Generate a cryptographically random base32-encoded TOTP secret.
 *
 * Produces 20 random bytes (160 bits) suitable for use as a shared TOTP
 * key.  Uses {@link crypto.getRandomValues} for entropy.
 *
 * @returns A base32-encoded secret string.
 */
export function generateTOTPSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTE_LENGTH));
  return bytesToBase32(bytes);
}

/**
 * Parse a standard `otpauth://` URI into its constituent parts.
 *
 * Handles the format `otpauth://totp/LABEL?secret=...&issuer=...&...`.
 * The label is URL-decoded.  If the label contains a colon (e.g.
 * `Issuer:user@example.com`) the issuer is extracted from the label;
 * an explicit `issuer` query parameter takes precedence.
 *
 * @param uri - A full otpauth URI string.
 * @returns Parsed fields suitable for use with {@link generateTOTP}.
 *
 * @throws {Error} if the URI scheme is not `otpauth`, the type is not `totp`,
 *   or the `secret` parameter is missing or invalid.
 */
export function parseOTPAuthURI(uri: string): TOTPURIResult {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Invalid otpauth URI: unable to parse URL');
  }

  if (parsed.protocol !== 'otpauth:') {
    throw new Error(
      `Invalid otpauth URI: expected "otpauth:" protocol, got "${parsed.protocol}"`
    );
  }

  // The pathname is "totp/LABEL" — strip the leading type segment.
  const pathParts = parsed.pathname.replace(/^\//, '').split('/');
  if (pathParts.length < 2 || pathParts[0] !== 'totp') {
    throw new Error(
      'Invalid otpauth URI: expected "totp" type in path'
    );
  }

  const encodedLabel = pathParts.slice(1).join('/');
  const label = decodeURIComponent(encodedLabel);

  const secret = parsed.searchParams.get('secret');
  if (!secret) {
    throw new Error('Invalid otpauth URI: missing "secret" parameter');
  }

  // Validate secret is valid base32 before returning.
  base32ToBytes(secret);

  const issuerParam = parsed.searchParams.get('issuer');
  const algorithmParam = parsed.searchParams.get('algorithm');
  const digitsParam = parsed.searchParams.get('digits');
  const periodParam = parsed.searchParams.get('period');

  // If label contains "Issuer:user", extract issuer from label
  // (only when no explicit issuer param is provided).
  const colonIdx = label.indexOf(':');
  const labelIssuer = colonIdx !== -1 ? label.substring(0, colonIdx) : undefined;
  const issuer = issuerParam ?? labelIssuer;

  let algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512' | undefined;
  if (algorithmParam) {
    const upper = algorithmParam.toUpperCase();
    if (
      upper === 'SHA1' ||
      upper === 'SHA-1'
    ) {
      algorithm = 'SHA-1';
    } else if (upper === 'SHA256' || upper === 'SHA-256') {
      algorithm = 'SHA-256';
    } else if (upper === 'SHA512' || upper === 'SHA-512') {
      algorithm = 'SHA-512';
    } else {
      throw new Error(
        `Invalid otpauth URI algorithm: ${algorithmParam}`
      );
    }
  }

  let digits: 6 | 8 | undefined;
  if (digitsParam) {
    const d = parseInt(digitsParam, 10);
    if (d !== 6 && d !== 8) {
      throw new Error(`Invalid otpauth URI digits: ${digitsParam}`);
    }
    digits = d;
  }

  let period: number | undefined;
  if (periodParam) {
    period = parseInt(periodParam, 10);
    if (period <= 0 || !Number.isInteger(period)) {
      throw new Error(`Invalid otpauth URI period: ${periodParam}`);
    }
  }

  return {
    secret,
    label,
    issuer,
    algorithm,
    digits,
    period,
  };
}

/**
 * Return the number of seconds remaining in the current TOTP time window.
 *
 * Useful for driving UI countdown timers without recomputing the full
 * passcode.  The returned value ranges from `period` (at the start of a
 * window) down to `1` (just before expiry).
 *
 * @param period - The TOTP period in seconds (default: 30).
 * @returns Seconds remaining in the current window (1 to `period`).
 */
export function getRemainingSeconds(period: number = DEFAULT_PERIOD): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now % period;
  if (elapsed === 0) {
    return period;
  }
  return period - elapsed;
}
