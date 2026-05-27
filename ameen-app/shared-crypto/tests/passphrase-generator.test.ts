import { describe, it, expect } from 'vitest';
import {
  generatePassphrase,
  EFF_WORDLIST_LENGTH,
  ARABIC_WORDLIST_LENGTH,
} from '../src/passphrase-generator';

describe('passphrase-generator', () => {
  describe('generatePassphrase', () => {
    it('word count matches request', () => {
      const result = generatePassphrase({ wordCount: 5 });
      expect(result.wordCount).toBe(5);
      expect(result.passphrase.split('-').length).toBe(5);
    });

    it('defaults to 6 words', () => {
      const result = generatePassphrase();
      expect(result.wordCount).toBe(6);
      expect(result.passphrase.split('-').length).toBe(6);
    });

    it('uses specified separator', () => {
      const result = generatePassphrase({ separator: '.', wordCount: 4 });
      expect(result.passphrase.split('.').length).toBe(4);
    });

    it('uses space separator', () => {
      const result = generatePassphrase({ separator: ' ', wordCount: 4 });
      expect(result.passphrase.split(' ').length).toBe(4);
    });

    it('uses empty separator', () => {
      const result = generatePassphrase({ separator: '', wordCount: 4 });
      expect(result.passphrase).not.toContain('-');
      expect(result.passphrase.split('').length).toBeGreaterThan(4);
    });

    it('capitalize option works', () => {
      const result = generatePassphrase({ capitalize: true, wordCount: 4 });
      const words = result.passphrase.split('-');
      for (const word of words) {
        expect(word[0]).toBe(word[0].toUpperCase());
      }
    });

    it('capitalize is false by default', () => {
      const result = generatePassphrase({ wordCount: 4 });
      const words = result.passphrase.split('-');
      const hasLower = words.some((w) => w[0] === w[0].toLowerCase());
      expect(hasLower).toBe(true);
    });

    it('generates Arabic passphrase', () => {
      const result = generatePassphrase({ language: 'ar', wordCount: 4 });
      expect(result.passphrase.split('-').length).toBe(4);
    });

    it('two calls produce different values', () => {
      const r1 = generatePassphrase({ wordCount: 8 });
      const r2 = generatePassphrase({ wordCount: 8 });
      expect(r1.passphrase).not.toBe(r2.passphrase);
    });

    it('clamps word count to valid range', () => {
      const tooLow = generatePassphrase({ wordCount: 1 });
      expect(tooLow.wordCount).toBe(4);

      const tooHigh = generatePassphrase({ wordCount: 20 });
      expect(tooHigh.wordCount).toBe(10);
    });

    it('returns entropy and strength metadata', () => {
      const result = generatePassphrase({ wordCount: 6 });
      expect(result.entropy).toBeGreaterThan(0);
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(100);
      expect(typeof result.strengthLabel).toBe('string');
    });

    it('defaults to invalid separator', () => {
      const result = generatePassphrase({ separator: '#' as any, wordCount: 5 });
      expect(result.passphrase).toContain('-');
    });
  });

  describe('wordlist sizes', () => {
    it('EFF wordlist has expected size', () => {
      expect(EFF_WORDLIST_LENGTH).toBeGreaterThan(1000);
    });

    it('Arabic wordlist has expected size', () => {
      expect(ARABIC_WORDLIST_LENGTH).toBeGreaterThan(400);
    });
  });
});
