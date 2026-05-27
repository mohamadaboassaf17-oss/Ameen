function asBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}

export async function computeCertFingerprint(certDer: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', asBuffer(certDer));
  const bytes = new Uint8Array(hash);
  const hex = Array.from(bytes.slice(0, 6))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hex;
}

export function formatFingerprint(fp: string): string {
  if (fp.length !== 12) return fp;
  const parts: string[] = [];
  for (let i = 0; i < 12; i += 2) {
    parts.push(fp.substring(i, i + 2));
  }
  return parts.join(' ');
}
