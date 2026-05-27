import { describe, it, expect } from 'vitest';
import { deriveKey } from '../../src/key-derivation';
import { encrypt, decrypt } from '../../src/encryption';
import { generateTOTP, generateTOTPSecret } from '../../src/totp';
import { generatePassword } from '../../src/password-generator';
import { parseCsvToVaultItems, vaultItemsToAmeenCsv } from '../../src/csv-parser';
import { encryptBackup, decryptBackup } from '../../src/backup-format';
import type { VaultData, VaultItem } from '../../src/vault-format';

const RANDOM_BUFFER_LIMIT = 65536;

function generateKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function generateRandomBytes(size: number): Uint8Array {
  const buffer = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += RANDOM_BUFFER_LIMIT) {
    const chunkSize = Math.min(RANDOM_BUFFER_LIMIT, size - offset);
    buffer.set(crypto.getRandomValues(new Uint8Array(chunkSize)), offset);
  }
  return buffer;
}

function createFakeVault(itemCount: number): VaultData {
  const items: VaultItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    items.push({
      id: crypto.randomUUID(),
      type: 'password' as const,
      title: `Item ${i} — example.com`,
      revision: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        username: `user${i}@example.com`,
        password: generatePassword({ length: 16 }).password,
        url: `https://example${i}.com/login`,
        notes: 'Some notes for this item.',
      },
    });
  }
  return {
    version: 1,
    vaultId: crypto.randomUUID(),
    items,
  };
}

function buildCsvText(itemCount: number): string {
  const headers = 'id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpSecret';
  const rows: string[] = [];
  for (let i = 0; i < itemCount; i++) {
    const pwd = generatePassword({ length: 12 }).password;
    rows.push(
      `${crypto.randomUUID()},password,Item ${i},user${i}@example.com,${pwd},https://example${i}.com,,,,,,,notes here,`
    );
  }
  return [headers, ...rows].join('\n');
}

const TEST_SECRET = generateTOTPSecret();

describe('Performance Benchmarks', () => {
  let results: Record<string, { duration: number; unit: string }> = {};

  // =========================================================================
  // 1. Key Derivation (Argon2id) — vault unlock time
  // =========================================================================
  it('key derivation (Argon2id unlock)', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const start = performance.now();
    const { key } = await deriveKey('test-password-123', salt);
    const duration = performance.now() - start;
    console.log(`  Key derivation (unlock): ${duration.toFixed(0)}ms (target <2000ms)`);
    expect(key).toBeDefined();
    expect(key.length).toBe(32);
    expect(duration).toBeLessThan(5000);
    results['Key derivation (unlock)'] = { duration, unit: 'ms' };
  });

  // =========================================================================
  // 2. AES-256-GCM Encryption — three data sizes
  // =========================================================================
  const SIZES = [1024, 10 * 1024, 100 * 1024];

  for (const size of SIZES) {
    const label = size >= 1024 ? `${size / 1024}KB` : `${size}B`;
    it(`AES-256-GCM encrypt (${label})`, async () => {
      const key = generateKey();
      const plaintext = generateRandomBytes(size);
      const start = performance.now();
      const result = await encrypt(plaintext, key);
      const duration = performance.now() - start;
      console.log(`  Encrypt ${label}: ${duration.toFixed(2)}ms`);
      expect(result.ciphertext).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.tag).toBeDefined();
      results[`Encrypt (${label})`] = { duration, unit: 'ms' };
    });
  }

  // =========================================================================
  // 3. AES-256-GCM Decryption — same sizes
  // =========================================================================
  for (const size of SIZES) {
    const label = size >= 1024 ? `${size / 1024}KB` : `${size}B`;
    it(`AES-256-GCM decrypt (${label})`, async () => {
      const key = generateKey();
      const plaintext = generateRandomBytes(size);
      const { ciphertext, iv, tag } = await encrypt(plaintext, key);
      const start = performance.now();
      const decrypted = await decrypt(ciphertext, key, iv, tag);
      const duration = performance.now() - start;
      console.log(`  Decrypt ${label}: ${duration.toFixed(2)}ms`);
      expect(decrypted).toBeDefined();
      expect(decrypted.length).toBe(size);
      results[`Decrypt (${label})`] = { duration, unit: 'ms' };
    });
  }

  // =========================================================================
  // 4. TOTP Generation — 1000 operations
  // =========================================================================
  it('TOTP generation (1000 ops)', async () => {
    const secret = TEST_SECRET;
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const result = await generateTOTP(secret);
      expect(result.code.length).toBe(6);
    }
    const duration = performance.now() - start;
    console.log(`  TOTP x1000: ${duration.toFixed(0)}ms (${(duration / 1000).toFixed(2)}ms each)`);
    results['TOTP (1000 ops)'] = { duration, unit: 'ms' };
  });

  // =========================================================================
  // 5. Password Generation — 1000 passwords, length 20, all types
  // =========================================================================
  it('password generation (1000 passwords, length 20)', async () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const result = generatePassword({
        length: 20,
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: true,
        excludeAmbiguous: true,
      });
      expect(result.password.length).toBe(20);
    }
    const duration = performance.now() - start;
    console.log(`  Password gen x1000 (len=20): ${duration.toFixed(0)}ms (${(duration / 1000).toFixed(3)}ms each)`);
    results['Password gen (1000 ops)'] = { duration, unit: 'ms' };
  });

  // =========================================================================
  // 6. CSV Parsing — 1000 vault items
  // =========================================================================
  it('CSV parsing (1000 vault items)', async () => {
    const csvText = buildCsvText(1000);
    const start = performance.now();
    const items = parseCsvToVaultItems(csvText);
    const duration = performance.now() - start;
    console.log(`  CSV parse x1000 items: ${duration.toFixed(0)}ms (${(duration / 1000).toFixed(3)}ms each)`);
    expect(items.length).toBe(1000);
    results['CSV parse (1000 items)'] = { duration, unit: 'ms' };
  });

  // =========================================================================
  // 7. Backup Encrypt + Decrypt Round-Trip — vault with 100 items
  // =========================================================================
  it('backup encrypt + decrypt round-trip (100 items)', async () => {
    const vault = createFakeVault(100);
    const key = generateKey();

    const encryptStart = performance.now();
    const manifest = await encryptBackup(vault, key, 'Test Profile');
    const encryptDuration = performance.now() - encryptStart;

    const decryptStart = performance.now();
    const restored = await decryptBackup(manifest, key);
    const decryptDuration = performance.now() - decryptStart;

    const totalDuration = encryptDuration + decryptDuration;
    console.log(`  Backup encrypt 100 items: ${encryptDuration.toFixed(0)}ms`);
    console.log(`  Backup decrypt 100 items: ${decryptDuration.toFixed(0)}ms`);
    console.log(`  Backup round-trip total: ${totalDuration.toFixed(0)}ms`);

    expect(restored.items.length).toBe(100);
    expect(restored.vaultId).toBe(vault.vaultId);

    results['Backup encrypt (100 items)'] = { duration: encryptDuration, unit: 'ms' };
    results['Backup decrypt (100 items)'] = { duration: decryptDuration, unit: 'ms' };
    results['Backup round-trip (100 items)'] = { duration: totalDuration, unit: 'ms' };
  });
});
