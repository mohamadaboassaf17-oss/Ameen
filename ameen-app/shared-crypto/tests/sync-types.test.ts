import { describe, it, expect } from 'vitest';
import { isSyncRequest, isSyncResponse } from '../src/sync-types';
import type { SyncRequest, SyncResponse, SyncMessage } from '../src/sync-types';

describe('sync-types', () => {
  describe('isSyncRequest', () => {
    it('returns true for sync_request messages', () => {
      const msg: SyncRequest = {
        messageType: 'sync_request',
        vaultId: 'vault-1',
        items: [],
      };
      expect(isSyncRequest(msg)).toBe(true);
    });

    it('returns false for sync_response messages', () => {
      const msg: SyncResponse = {
        messageType: 'sync_response',
        vaultId: 'vault-1',
        items: [],
        conflicts: [],
        syncedItemCount: 0,
        newItemCount: 0,
        conflictCount: 0,
      };
      expect(isSyncRequest(msg)).toBe(false);
    });

    it('returns false for unknown message types', () => {
      const msg = { messageType: 'unknown' } as SyncMessage;
      expect(isSyncRequest(msg)).toBe(false);
    });
  });

  describe('isSyncResponse', () => {
    it('returns true for sync_response messages', () => {
      const msg: SyncResponse = {
        messageType: 'sync_response',
        vaultId: 'vault-1',
        items: [],
        conflicts: [],
        syncedItemCount: 0,
        newItemCount: 0,
        conflictCount: 0,
      };
      expect(isSyncResponse(msg)).toBe(true);
    });

    it('returns false for sync_request messages', () => {
      const msg: SyncRequest = {
        messageType: 'sync_request',
        vaultId: 'vault-1',
        items: [],
      };
      expect(isSyncResponse(msg)).toBe(false);
    });
  });

  describe('type validation', () => {
    it('SyncRequest has required fields', () => {
      const msg: SyncRequest = {
        messageType: 'sync_request',
        vaultId: 'vault-abc',
        items: [{ id: '1', type: 'password', title: 'Test', revision: 1, createdAt: 0, updatedAt: 0, data: {} }],
      };
      expect(msg.messageType).toBe('sync_request');
      expect(typeof msg.vaultId).toBe('string');
      expect(Array.isArray(msg.items)).toBe(true);
    });

    it('SyncResponse has required fields', () => {
      const msg: SyncResponse = {
        messageType: 'sync_response',
        vaultId: 'vault-abc',
        items: [],
        conflicts: [],
        syncedItemCount: 0,
        newItemCount: 0,
        conflictCount: 0,
      };
      expect(msg.messageType).toBe('sync_response');
      expect(typeof msg.syncedItemCount).toBe('number');
      expect(typeof msg.newItemCount).toBe('number');
      expect(typeof msg.conflictCount).toBe('number');
    });
  });
});
