import { describe, it, expect } from 'vitest';
import {
  scanPasswordHealth,
  generateHealthRecommendations,
  hashPasswordForComparison,
} from '../src/password-health';
import type { PasswordHealthResult } from '../src/password-health';

interface VaultItem {
  id: string;
  type: 'password' | 'note' | 'card';
  title: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  data: Record<string, string>;
}

function makeItem(overrides: Partial<VaultItem> = {}): VaultItem {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    type: 'password',
    title: 'test-item',
    revision: 1,
    createdAt: now,
    updatedAt: now,
    data: { password: 'default123' },
    ...overrides,
  };
}

describe('password-health', () => {
  describe('scanPasswordHealth', () => {
    it('detects duplicate passwords', async () => {
      const items = [
        makeItem({ id: 'a', title: 'Site A', data: { password: 'same-password' } }),
        makeItem({ id: 'b', title: 'Site B', data: { password: 'same-password' } }),
      ];
      const result = await scanPasswordHealth(items);
      expect(result.duplicatePasswords.length).toBe(1);
      expect(result.duplicatePasswords[0].itemIds).toContain('a');
      expect(result.duplicatePasswords[0].itemIds).toContain('b');
      expect(result.duplicatePasswords[0].passwordHash).toBeDefined();
      expect(result.duplicatePasswords[0].passwordHash.length).toBeGreaterThan(0);
    });

    it('detects weak passwords', async () => {
      const items = [
        makeItem({ id: 'a', title: 'Weak', data: { password: '123' } }),
      ];
      const result = await scanPasswordHealth(items);
      expect(result.weakPasswords.length).toBe(1);
      expect(result.weakPasswords[0].itemId).toBe('a');
      expect(result.weakPasswords[0].score).toBeLessThan(40);
    });

    it('detects old passwords', async () => {
      const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000;
      const items = [
        makeItem({ id: 'a', title: 'Old', updatedAt: oldDate, data: { password: 'strong!P@ss1' } }),
      ];
      const result = await scanPasswordHealth(items);
      expect(result.oldPasswords.length).toBe(1);
      expect(result.oldPasswords[0].itemId).toBe('a');
      expect(result.oldPasswords[0].ageDays).toBeGreaterThan(90);
    });

    it('skips non-password items', async () => {
      const items = [
        makeItem({ id: 'a', type: 'note', data: { content: 'some note' } } as any),
        makeItem({ id: 'b', type: 'card', data: { number: '1234' } } as any),
      ];
      const result = await scanPasswordHealth(items);
      expect(result.totalPasswordItems).toBe(0);
    });

    it('computes overallScore based on issues', async () => {
      const items = [
        makeItem({ id: 'a', title: 'Good', data: { password: 'Str0ng!P@ssw0rd!L0ng#' } }),
      ];
      const result = await scanPasswordHealth(items);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('returns 100 for empty vault', async () => {
      const result = await scanPasswordHealth([]);
      expect(result.overallScore).toBe(100);
      expect(result.weakPasswords).toEqual([]);
      expect(result.duplicatePasswords).toEqual([]);
      expect(result.oldPasswords).toEqual([]);
      expect(result.recommendationCount).toBe(0);
    });

    it('counts totalPasswordItems', async () => {
      const items = [
        makeItem({ id: 'a', data: { password: 'pass1' } }),
        makeItem({ id: 'b', data: { password: 'pass2' } }),
        makeItem({ id: 'c', type: 'note', data: { content: 'note' } } as any),
      ];
      const result = await scanPasswordHealth(items);
      expect(result.totalPasswordItems).toBe(2);
    });
  });

  describe('generateHealthRecommendations', () => {
    it('returns recommendations for weak passwords', () => {
      const result: PasswordHealthResult = {
        overallScore: 70,
        weakPasswords: [{ itemId: '1', itemTitle: 'Weak', score: 20, label: 'ضعيف', reason: 'ضعف' }],
        duplicatePasswords: [],
        oldPasswords: [],
        totalPasswordItems: 1,
        recommendationCount: 1,
      };
      const recs = generateHealthRecommendations(result);
      expect(recs).toContain('تغيير كلمات المرور الضعيفة');
    });

    it('returns recommendations for duplicates', () => {
      const result: PasswordHealthResult = {
        overallScore: 70,
        weakPasswords: [],
        duplicatePasswords: [{ itemIds: ['1', '2'], itemTitles: ['A', 'B'], passwordHash: 'abc' }],
        oldPasswords: [],
        totalPasswordItems: 2,
        recommendationCount: 1,
      };
      const recs = generateHealthRecommendations(result);
      expect(recs).toContain('استخدام كلمات مرور فريدة لكل حساب');
    });

    it('returns recommendations for old passwords', () => {
      const result: PasswordHealthResult = {
        overallScore: 70,
        weakPasswords: [],
        duplicatePasswords: [],
        oldPasswords: [{ itemId: '1', itemTitle: 'Old', ageDays: 120 }],
        totalPasswordItems: 1,
        recommendationCount: 1,
      };
      const recs = generateHealthRecommendations(result);
      expect(recs).toContain('تحديث كلمات المرور القديمة');
    });

    it('returns praise when no issues', () => {
      const result: PasswordHealthResult = {
        overallScore: 100,
        weakPasswords: [],
        duplicatePasswords: [],
        oldPasswords: [],
        totalPasswordItems: 0,
        recommendationCount: 0,
      };
      const recs = generateHealthRecommendations(result);
      expect(recs).toContain('خزنتك في حالة ممتازة!');
    });
  });

  describe('hashPasswordForComparison', () => {
    it('returns hex string', async () => {
      const hash = await hashPasswordForComparison('test-password');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('same password produces same hash', async () => {
      const h1 = await hashPasswordForComparison('mypass');
      const h2 = await hashPasswordForComparison('mypass');
      expect(h1).toBe(h2);
    });

    it('different passwords produce different hashes', async () => {
      const h1 = await hashPasswordForComparison('pass1');
      const h2 = await hashPasswordForComparison('pass2');
      expect(h1).not.toBe(h2);
    });
  });
});
