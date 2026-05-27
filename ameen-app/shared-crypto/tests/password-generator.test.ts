import { describe, it, expect } from 'vitest';
import { generatePassword, estimateStrength, PASSWORD_CHARSETS } from '../src/password-generator';

describe('password-generator', () => {
  describe('generatePassword', () => {
    it('generates password of requested length', () => {
      const result = generatePassword({ length: 16 });
      expect(result.password.length).toBe(16);
    });

    it('defaults to 20 characters', () => {
      const result = generatePassword();
      expect(result.password.length).toBe(20);
    });

    it('two calls produce different values', () => {
      const r1 = generatePassword();
      const r2 = generatePassword();
      expect(r1.password).not.toBe(r2.password);
    });

    it('contains uppercase when enabled', () => {
      const result = generatePassword({
        uppercase: true,
        lowercase: false,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
      });
      expect(/^[A-Z]+$/.test(result.password)).toBe(true);
    });

    it('contains lowercase when enabled', () => {
      const result = generatePassword({
        uppercase: false,
        lowercase: true,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
      });
      expect(/^[a-z]+$/.test(result.password)).toBe(true);
    });

    it('contains digits when enabled', () => {
      const result = generatePassword({
        uppercase: false,
        lowercase: false,
        digits: true,
        symbols: false,
        excludeAmbiguous: false,
      });
      expect(/^[0-9]+$/.test(result.password)).toBe(true);
    });

    it('contains symbols when enabled', () => {
      const result = generatePassword({
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: true,
        excludeAmbiguous: false,
        length: 48,
      });
      const symbolSet = new Set('!@#$%^&*()_+-=[]{}|;:,.<>?/`~'.split(''));
      for (const ch of result.password) {
        expect(symbolSet.has(ch)).toBe(true);
      }
    });

    it('includes at least one char from each selected charset', () => {
      const result = generatePassword({
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: true,
        length: 20,
        excludeAmbiguous: false,
      });
      expect(/[A-Z]/.test(result.password)).toBe(true);
      expect(/[a-z]/.test(result.password)).toBe(true);
      expect(/[0-9]/.test(result.password)).toBe(true);
      const symbolSet = new Set('!@#$%^&*()_+-=[]{}|;:,.<>?/`~'.split(''));
      let hasSymbol = false;
      for (const ch of result.password) {
        if (symbolSet.has(ch)) {
          hasSymbol = true;
          break;
        }
      }
      expect(hasSymbol).toBe(true);
    });

    it('excludes ambiguous characters when requested', () => {
      const ambiguous = new Set(['I', 'l', '1', 'O', '0', '|']);
      const result = generatePassword({
        length: 64,
        excludeAmbiguous: true,
      });
      for (const ch of result.password) {
        expect(ambiguous.has(ch)).toBe(false);
      }
    });

    it('throws for empty charsets', () => {
      expect(() =>
        generatePassword({
          uppercase: false,
          lowercase: false,
          digits: false,
          symbols: false,
        })
      ).toThrow('At least one character set');
    });

    it('throws for invalid length', () => {
      expect(() => generatePassword({ length: 4 })).toThrow(
        'Password length must be between'
      );
      expect(() => generatePassword({ length: 200 })).toThrow(
        'Password length must be between'
      );
    });

    it('returns strength metadata', () => {
      const result = generatePassword({ length: 32 });
      expect(result.password.length).toBe(32);
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(100);
      expect(['ضعيف', 'مقبول', 'قوي', 'قوي جداً']).toContain(result.strengthLabel);
      expect(result.entropy).toBeGreaterThan(0);
    });
  });

  describe('estimateStrength', () => {
    it('returns 0 for empty password', () => {
      const result = estimateStrength('');
      expect(result.score).toBe(0);
      expect(result.label).toBe('ضعيف');
    });

    it('rates weak short password low', () => {
      const result = estimateStrength('abc');
      expect(result.score).toBeLessThanOrEqual(40);
    });

    it('rates long complex password high', () => {
      const result = estimateStrength('MyP@ssw0rd!Complex#2024Long');
      expect(result.score).toBeGreaterThan(50);
    });

    it('rates very strong password as maximum label', () => {
      const result = estimateStrength('xT9#mK2$pL7@wR4!nV8%qB3&zF6^');
      expect(result.label).toBe('قوي جداً');
    });
  });

  describe('PASSWORD_CHARSETS', () => {
    it('exports expected charsets', () => {
      expect(PASSWORD_CHARSETS.uppercase).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(PASSWORD_CHARSETS.lowercase).toBe('abcdefghijklmnopqrstuvwxyz');
      expect(PASSWORD_CHARSETS.digits).toBe('0123456789');
      expect(PASSWORD_CHARSETS.symbols).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?/`~');
      expect(PASSWORD_CHARSETS.ambiguous).toBe('Il1O0|');
    });
  });
});
