const DEFAULT_LENGTH = 20;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?/`~';

const AMBIGUOUS_CHARS = new Set(['I', 'l', '1', 'O', '0', '|']);

export interface PasswordOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  excludeAmbiguous?: boolean;
}

export interface PasswordResult {
  password: string;
  strength: number;
  strengthLabel: 'ضعيف' | 'مقبول' | 'قوي' | 'قوي جداً';
  entropy: number;
}

export const PASSWORD_CHARSETS = {
  uppercase: UPPERCASE,
  lowercase: LOWERCASE,
  digits: DIGITS,
  symbols: SYMBOLS,
  ambiguous: 'Il1O0|',
};

function filterAmbiguous(charset: string): string {
  let result = '';
  for (let i = 0; i < charset.length; i++) {
    if (!AMBIGUOUS_CHARS.has(charset[i])) {
      result += charset[i];
    }
  }
  return result;
}

function buildPool(options: Required<PasswordOptions>): {
  pool: string;
  charsets: string[];
} {
  const charsets: string[] = [];

  if (options.uppercase) {
    charsets.push(options.excludeAmbiguous ? filterAmbiguous(UPPERCASE) : UPPERCASE);
  }
  if (options.lowercase) {
    charsets.push(options.excludeAmbiguous ? filterAmbiguous(LOWERCASE) : LOWERCASE);
  }
  if (options.digits) {
    charsets.push(options.excludeAmbiguous ? filterAmbiguous(DIGITS) : DIGITS);
  }
  if (options.symbols) {
    charsets.push(options.excludeAmbiguous ? filterAmbiguous(SYMBOLS) : SYMBOLS);
  }

  if (charsets.length === 0) {
    throw new Error('At least one character set must be selected for password generation');
  }

  for (const cs of charsets) {
    if (cs.length === 0) {
      throw new Error(
        'A character set is empty after removing ambiguous characters. Enable additional charsets or disable excludeAmbiguous.'
      );
    }
  }

  const pool = charsets.join('');

  return { pool, charsets };
}

function secureRandomIndices(max: number, count: number): Uint32Array {
  const result = new Uint32Array(count);
  crypto.getRandomValues(result);
  for (let i = 0; i < count; i++) {
    result[i] = result[i] % max;
  }
  return result;
}

function shuffleArray(arr: string[]): void {
  const indices = secureRandomIndices(256, arr.length);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = indices[i] % (i + 1);
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
}

function countUniqueChars(password: string): number {
  const seen = new Set<string>();
  for (const ch of password) {
    seen.add(ch);
  }
  return seen.size;
}

function getPresentCharsetCount(password: string): number {
  let hasUpper = false;
  let hasLower = false;
  let hasDigit = false;
  let hasSymbol = false;

  for (const ch of password) {
    if (!hasUpper && UPPERCASE.includes(ch)) hasUpper = true;
    if (!hasLower && LOWERCASE.includes(ch)) hasLower = true;
    if (!hasDigit && DIGITS.includes(ch)) hasDigit = true;
    if (!hasSymbol && SYMBOLS.includes(ch)) hasSymbol = true;
    if (hasUpper && hasLower && hasDigit && hasSymbol) break;
  }

  return (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSymbol ? 1 : 0);
}

function calculateEntropy(poolSize: number, length: number): number {
  return length * Math.log2(poolSize);
}

function resolveOptions(options?: PasswordOptions): Required<PasswordOptions> {
  return {
    length: options?.length ?? DEFAULT_LENGTH,
    uppercase: options?.uppercase ?? true,
    lowercase: options?.lowercase ?? true,
    digits: options?.digits ?? true,
    symbols: options?.symbols ?? true,
    excludeAmbiguous: options?.excludeAmbiguous ?? true,
  };
}

/**
 * Estimate the strength of an existing password string.
 *
 * Evaluates entropy based on character-class diversity and length,
 * then computes a 0-100 score with an Arabic label. This function is
 * shared by the password generator and the password-health module.
 *
 * @param password - The password to evaluate.
 * @returns A score between 0 and 100 with a strength label.
 */
export function estimateStrength(password: string): {
  score: number;
  label: 'ضعيف' | 'مقبول' | 'قوي' | 'قوي جداً';
} {
  if (password.length === 0) {
    return { score: 0, label: 'ضعيف' };
  }

  const presentCount = getPresentCharsetCount(password);

  let poolSize = 0;
  {
    // Calculate the effective pool size based on character classes actually used
    let combined = '';
    if (/[A-Z]/.test(password)) combined += UPPERCASE;
    if (/[a-z]/.test(password)) combined += LOWERCASE;
    if (/[0-9]/.test(password)) combined += DIGITS;

    // For symbols, check each symbol char individually since the set is limited
    let hasSymbol = false;
    for (const ch of SYMBOLS) {
      if (password.includes(ch)) {
        hasSymbol = true;
        break;
      }
    }
    if (hasSymbol) combined += SYMBOLS;

    if (combined.length === 0) {
      // Unknown character class — use a conservative estimate
      combined = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;
    }

    poolSize = combined.length;
  }

  const entropy = calculateEntropy(poolSize, password.length);
  const uniqueChars = countUniqueChars(password);

  const entropyScore = Math.min(1, entropy / 128) * 70;
  const diversityScore = (presentCount / 4) * 20;
  const uniquenessScore = (uniqueChars / password.length) * 10;

  const score = Math.round(
    Math.min(100, entropyScore + diversityScore + uniquenessScore)
  );

  let label: 'ضعيف' | 'مقبول' | 'قوي' | 'قوي جداً';
  if (score <= 25) label = 'ضعيف';
  else if (score <= 50) label = 'مقبول';
  else if (score <= 75) label = 'قوي';
  else label = 'قوي جداً';

  return { score, label };
}

/**
 * Generate a cryptographically secure random password.
 *
 * Uses {@link crypto.getRandomValues} to select characters from the
 * chosen character sets. Ensures at least one character from each
 * selected class is present and shuffles the result to distribute
 * guaranteed characters evenly.
 *
 * Throws if no character sets are selected or if excluding ambiguous
 * characters empties every set.
 *
 * @param options - Optional constraints for length, charsets, and ambiguity.
 * @returns The generated password together with its strength assessment.
 */
export function generatePassword(options?: PasswordOptions): PasswordResult {
  const resolved = resolveOptions(options);

  if (resolved.length < MIN_LENGTH || resolved.length > MAX_LENGTH) {
    throw new Error(
      `Password length must be between ${MIN_LENGTH} and ${MAX_LENGTH}, got ${resolved.length}`
    );
  }

  const { pool, charsets } = buildPool(resolved);

  const characters: string[] = [];

  // Pick one guaranteed character from each selected charset
  for (const cs of charsets) {
    const indices = secureRandomIndices(cs.length, 1);
    characters.push(cs[indices[0]]);
  }

  // Fill remaining slots with random picks from the full pool
  const remaining = resolved.length - characters.length;
  if (remaining > 0) {
    const indices = secureRandomIndices(pool.length, remaining);
    for (let i = 0; i < remaining; i++) {
      characters.push(pool[indices[i]]);
    }
  }

  // Shuffle so guaranteed characters are not clustered at the front
  shuffleArray(characters);

  const password = characters.join('');
  const entropy = calculateEntropy(pool.length, resolved.length);
  const strength = estimateStrength(password);

  return {
    password,
    strength: strength.score,
    strengthLabel: strength.label,
    entropy: Math.round(entropy * 100) / 100,
  };
}
