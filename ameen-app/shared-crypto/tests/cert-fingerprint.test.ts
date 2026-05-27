import { describe, it, expect } from 'vitest';
import { computeCertFingerprint, formatFingerprint } from '../src/cert-fingerprint';

describe('cert-fingerprint', () => {
  describe('computeCertFingerprint', () => {
    it('returns a 12-character hex string', async () => {
      const der = crypto.getRandomValues(new Uint8Array(256));
      const fp = await computeCertFingerprint(der);
      expect(fp.length).toBe(12);
      expect(/^[0-9A-F]{12}$/.test(fp)).toBe(true);
    });

    it('same input produces same fingerprint', async () => {
      const der = new Uint8Array(128).fill(0x42);
      const fp1 = await computeCertFingerprint(der);
      const fp2 = await computeCertFingerprint(der);
      expect(fp1).toBe(fp2);
    });

    it('different input produces different fingerprint', async () => {
      const der1 = new Uint8Array(64).fill(0x11);
      const der2 = new Uint8Array(64).fill(0x22);
      const fp1 = await computeCertFingerprint(der1);
      const fp2 = await computeCertFingerprint(der2);
      expect(fp1).not.toBe(fp2);
    });

    it('returns uppercase hex', async () => {
      const der = crypto.getRandomValues(new Uint8Array(100));
      const fp = await computeCertFingerprint(der);
      expect(fp).toBe(fp.toUpperCase());
    });
  });

  describe('formatFingerprint', () => {
    it('formats 12-char hex into spaced groups', () => {
      const formatted = formatFingerprint('AABBCCDDEEFF');
      expect(formatted).toBe('AA BB CC DD EE FF');
    });

    it('returns input as-is for non-12-char strings', () => {
      expect(formatFingerprint('ABCD')).toBe('ABCD');
      expect(formatFingerprint('ABCDEFGHIJKLmnop')).toBe('ABCDEFGHIJKLmnop');
    });
  });
});
