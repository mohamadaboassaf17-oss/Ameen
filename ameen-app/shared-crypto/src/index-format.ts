export interface ProfileEntry {
  id: string;
  displayName: string;
  avatarColor: string;
  avatarInitial: string;
  salt: string;
  argon2Params: {
    iterations: number;
    memory: number;
    parallelism: number;
  };
  vaultFileName: string;
  isChild?: boolean;
  parentProfileId?: string;
  recoveryPublicKey?: string;
  recoveryEncryptedKey?: string;
  createdAt?: number;
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  lastSyncedAt: number;
  certFingerprint: string;
}

export interface IndexData {
  version: 1;
  profiles: ProfileEntry[];
  pairedDevices?: PairedDevice[];
}

export type RecoveryAction = 'recovery_setup' | 'recovery_reset' | 'password_change';

export interface RecoveryAuditEntry {
  id: string;
  timestamp: number;
  action: RecoveryAction;
  actorProfileId: string;
  targetProfileId: string;
  description: string;
}

export interface AuditLog {
  version: 1;
  entries: RecoveryAuditEntry[];
}

export function serializeIndex(data: IndexData): string {
  return JSON.stringify(data);
}

export function deserializeIndex(json: string): IndexData {
  return JSON.parse(json) as IndexData;
}

export function readIndex(path: string): IndexData | null {
  const raw = localStorage.getItem(path);
  if (!raw) return null;
  return deserializeIndex(raw);
}

export function writeIndex(path: string, data: IndexData): void {
  localStorage.setItem(path, serializeIndex(data));
}

export function createAuditEntry(
  action: RecoveryAction,
  actorProfileId: string,
  targetProfileId: string,
  description: string,
): RecoveryAuditEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action,
    actorProfileId,
    targetProfileId,
    description,
  };
}

export function serializeAuditLog(log: AuditLog): string {
  return JSON.stringify(log);
}

export function deserializeAuditLog(json: string): AuditLog {
  return JSON.parse(json) as AuditLog;
}

export function readAuditLog(path: string): AuditLog {
  const raw = localStorage.getItem(path);
  if (!raw) {
    return { version: 1, entries: [] };
  }
  return deserializeAuditLog(raw);
}

export function writeAuditLog(path: string, log: AuditLog): void {
  localStorage.setItem(path, serializeAuditLog(log));
}

export function appendAuditEntry(path: string, entry: RecoveryAuditEntry): void {
  const log = readAuditLog(path);
  log.entries.push(entry);
  writeAuditLog(path, log);
}
