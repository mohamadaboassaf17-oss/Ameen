export interface SyncAuditEntry {
  id: string;
  timestamp: number;
  deviceId: string;
  deviceName: string;
  direction: 'sent' | 'received';
  itemsChanged: number;
  itemsAdded: number;
  conflictsDetected: number;
  conflictIds: string[];
}

export interface SyncAuditLog {
  version: 1;
  entries: SyncAuditEntry[];
}

export function createSyncAuditEntry(
  deviceId: string,
  deviceName: string,
  direction: 'sent' | 'received',
  itemsChanged: number,
  itemsAdded: number,
  conflictsDetected: number,
  conflictIds: string[]
): SyncAuditEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    deviceId,
    deviceName,
    direction,
    itemsChanged,
    itemsAdded,
    conflictsDetected,
    conflictIds,
  };
}
