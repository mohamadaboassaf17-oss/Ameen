import { argon2id } from 'hash-wasm';

const DEFAULT_ITERATIONS = 3;
const DEFAULT_MEMORY = 64 * 1024; // 64 MB in KiB
const DEFAULT_PARALLELISM = 4;
const DEFAULT_OUTPUT_LEN = 32;
const SALT_LENGTH = 16;

export interface Argon2Params {
  iterations: number;
  memory: number; // KiB
  parallelism: number;
  outputLength: number;
}

export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  iterations: DEFAULT_ITERATIONS,
  memory: DEFAULT_MEMORY,
  parallelism: DEFAULT_PARALLELISM,
  outputLength: DEFAULT_OUTPUT_LEN,
};

export async function deriveKey(
  password: string,
  salt?: Uint8Array,
  config?: Partial<Argon2Params>
): Promise<{ key: Uint8Array; salt: Uint8Array }> {
  const params = { ...DEFAULT_ARGON2_PARAMS, ...config };

  const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const derived = await argon2id({
    password,
    salt: actualSalt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memory,
    hashLength: params.outputLength,
    outputType: 'binary',
  });

  return { key: derived, salt: actualSalt };
}
