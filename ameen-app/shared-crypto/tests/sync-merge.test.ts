import { describe, it, expect } from 'vitest';
import { mergeVaults } from '../src/sync-merge';
import type { VaultItem } from '../src/vault-format';

function makeItem(id: string, revision: number, title: string, data: Record<string, string> = {}): VaultItem {
  return {
    id,
    type: 'password' as const,
    title,
    revision,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data,
  };
}

describe('sync-merge', () => {
  describe('mergeVaults', () => {
    it('adds new remote items not in local', () => {
      const local: VaultItem[] = [];
      const remote = [makeItem('remote-1', 1, 'Remote Item', { password: 'p1' })];
      const result = mergeVaults(local, remote);
      expect(result.merged.length).toBe(1);
      expect(result.stats.newItems).toBe(1);
      expect(result.stats.synced).toBe(0);
      expect(result.stats.conflicts).toBe(0);
    });

    it('updates local item when remote has higher revision', () => {
      const local = [makeItem('item-1', 1, 'Old Title', { password: 'old' })];
      const remote = [makeItem('item-1', 2, 'New Title', { password: 'new' })];
      const result = mergeVaults(local, remote);
      expect(result.merged.length).toBe(1);
      expect(result.merged[0].title).toBe('New Title');
      expect(result.stats.synced).toBe(1);
    });

    it('keeps local item when local has higher revision', () => {
      const local = [makeItem('item-1', 3, 'Local Title', { password: 'local' })];
      const remote = [makeItem('item-1', 2, 'Remote Title', { password: 'remote' })];
      const result = mergeVaults(local, remote);
      expect(result.merged.length).toBe(1);
      expect(result.merged[0].title).toBe('Local Title');
    });

    it('detects conflict when same revision but different data', () => {
      const local = [makeItem('item-1', 1, 'Title', { password: 'local-pass' })];
      const remote = [makeItem('item-1', 1, 'Title', { password: 'remote-pass' })];
      const result = mergeVaults(local, remote);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.stats.conflicts).toBeGreaterThan(0);
    });

    it('detects conflict when same revision but different title', () => {
      const local = [makeItem('item-1', 1, 'Title A', { password: 'pass' })];
      const remote = [makeItem('item-1', 1, 'Title B', { password: 'pass' })];
      const result = mergeVaults(local, remote);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('no conflict when same revision and same data', () => {
      const local = [makeItem('item-1', 1, 'Title', { password: 'pass' })];
      const remote = [makeItem('item-1', 1, 'Title', { password: 'pass' })];
      const result = mergeVaults(local, remote);
      expect(result.conflicts.length).toBe(0);
      expect(result.stats.conflicts).toBe(0);
    });

    it('preserves local-only items', () => {
      const local = [makeItem('local-only', 1, 'Local')];
      const remote = [makeItem('remote-only', 1, 'Remote')];
      const result = mergeVaults(local, remote);
      expect(result.merged.length).toBe(2);
      expect(result.merged.find((i) => i.id === 'local-only')).toBeDefined();
    });

    it('handles empty local', () => {
      const local: VaultItem[] = [];
      const remote = [makeItem('r1', 1, 'R1'), makeItem('r2', 2, 'R2')];
      const result = mergeVaults(local, remote);
      expect(result.merged.length).toBe(2);
      expect(result.stats.newItems).toBe(2);
    });

    it('handles empty remote', () => {
      const local = [makeItem('l1', 1, 'L1'), makeItem('l2', 2, 'L2')];
      const remote: VaultItem[] = [];
      const result = mergeVaults(local, remote);
      expect(result.merged.length).toBe(2);
    });
  });
});
