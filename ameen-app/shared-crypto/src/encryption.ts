const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ALGORITHM = 'AES-GCM';

function asBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}

async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    asBuffer(rawKey),
    ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await importKey(key);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: asBuffer(iv) },
    cryptoKey,
    asBuffer(plaintext)
  );

  const combined = new Uint8Array(encrypted);
  const ciphertext = combined.slice(0, combined.length - TAG_LENGTH);
  const tag = combined.slice(combined.length - TAG_LENGTH);

  return { ciphertext, iv, tag };
}

export async function decrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await importKey(key);

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: asBuffer(iv) },
    cryptoKey,
    asBuffer(combined)
  );

  return new Uint8Array(decrypted);
}

export async function encryptString(
  plaintext: string,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  const encoded = new TextEncoder().encode(plaintext);
  return encrypt(encoded, key);
}

export async function decryptToString(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array
): Promise<string> {
  const decrypted = await decrypt(ciphertext, key, iv, tag);
  return new TextDecoder().decode(decrypted);
}
