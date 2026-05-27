import { describe, it, expect } from 'vitest';
import {
  serializeIndex,
  deserializeIndex,
  createAuditEntry,
  serializeAuditLog,
  deserializeAuditLog,
} from '../src/index-format';
import type { IndexData, AuditLog } from '../src/index-format';

describe('index-format', () => {
  describe('serializeIndex / deserializeIndex', () => {
    it('round-trip', () => {
      const data: IndexData = {
        version: 1,
        profiles: [
          {
            id: 'profile-1',
            displayName: 'Test User',
            avatarColor: '#FF0000',
            avatarInitial: 'T',
            salt: 'abc',
            argon2Params: { iterations: 3, memory: 65536, parallelism: 4 },
            vaultFileName: 'vault-1.ameen',
          },
        ],
        pairedDevices: [
          {
            deviceId: 'dev-1',
            deviceName: 'Laptop',
            lastSyncedAt: 1700000000000,
            certFingerprint: 'ABCDEF123456',
          },
        ],
      };
      const json = serializeIndex(data);
      const restored = deserializeIndex(json);
      expect(restored).toEqual(data);
    });

    it('handles index without pairedDevices', () => {
      const data: IndexData = {
        version: 1,
        profiles: [
          {
            id: 'profile-1',
            displayName: 'Solo User',
            avatarColor: '#00FF00',
            avatarInitial: 'S',
            salt: 'def',
            argon2Params: { iterations: 3, memory: 65536, parallelism: 4 },
            vaultFileName: 'vault-1.ameen',
          },
        ],
      };
      const json = serializeIndex(data);
      const restored = deserializeIndex(json);
      expect(restored.profiles[0].displayName).toBe('Solo User');
    });
  });

  describe('createAuditEntry', () => {
    it('creates entry with all fields', () => {
      const entry = createAuditEntry(
        'recovery_setup',
        'parent-1',
        'child-1',
        'Parent set up recovery for child'
      );
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.action).toBe('recovery_setup');
      expect(entry.actorProfileId).toBe('parent-1');
      expect(entry.targetProfileId).toBe('child-1');
      expect(entry.description).toBe('Parent set up recovery for child');
    });

    it('handles different action types', () => {
      const entry = createAuditEntry('password_change', 'user-1', 'user-1', 'Password changed');
      expect(entry.action).toBe('password_change');
    });
  });

  describe('serializeAuditLog / deserializeAuditLog', () => {
    it('round-trip', () => {
      const log: AuditLog = {
        version: 1,
        entries: [
          {
            id: 'entry-1',
            timestamp: 1700000000000,
            action: 'recovery_setup',
            actorProfileId: 'parent-1',
            targetProfileId: 'child-1',
            description: 'Setup recovery',
          },
        ],
      };
      const json = serializeAuditLog(log);
      const restored = deserializeAuditLog(json);
      expect(restored).toEqual(log);
    });

    it('handles empty entries', () => {
      const log: AuditLog = { version: 1, entries: [] };
      const json = serializeAuditLog(log);
      const restored = deserializeAuditLog(json);
      expect(restored.entries).toEqual([]);
    });
  });
});
