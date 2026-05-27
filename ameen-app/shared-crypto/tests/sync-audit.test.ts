import { describe, it, expect } from 'vitest';
import { createSyncAuditEntry } from '../src/sync-audit';

describe('sync-audit', () => {
  describe('createSyncAuditEntry', () => {
    it('creates entry with correct structure', () => {
      const entry = createSyncAuditEntry(
        'device-123',
        'My Laptop',
        'sent',
        5,
        3,
        2,
        ['conflict-1', 'conflict-2']
      );
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.deviceId).toBe('device-123');
      expect(entry.deviceName).toBe('My Laptop');
      expect(entry.direction).toBe('sent');
      expect(entry.itemsChanged).toBe(5);
      expect(entry.itemsAdded).toBe(3);
      expect(entry.conflictsDetected).toBe(2);
      expect(entry.conflictIds).toEqual(['conflict-1', 'conflict-2']);
    });

    it('creates received direction entries', () => {
      const entry = createSyncAuditEntry('dev-1', 'Phone', 'received', 10, 0, 0, []);
      expect(entry.direction).toBe('received');
      expect(entry.itemsChanged).toBe(10);
      expect(entry.itemsAdded).toBe(0);
      expect(entry.conflictsDetected).toBe(0);
    });

    it('generates unique IDs per call', () => {
      const e1 = createSyncAuditEntry('d1', 'A', 'sent', 1, 0, 0, []);
      const e2 = createSyncAuditEntry('d1', 'A', 'sent', 1, 0, 0, []);
      expect(e1.id).not.toBe(e2.id);
    });
  });
});
