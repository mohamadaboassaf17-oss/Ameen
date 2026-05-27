import { VaultItem } from './vault-format';

export interface SyncRequest {
  messageType: 'sync_request';
  vaultId: string;
  items: VaultItem[];
}

export interface SyncResponse {
  messageType: 'sync_response';
  vaultId: string;
  items: VaultItem[];
  conflicts: VaultItem[];
  syncedItemCount: number;
  newItemCount: number;
  conflictCount: number;
}

export type SyncMessage = SyncRequest | SyncResponse;

export function isSyncRequest(msg: SyncMessage): msg is SyncRequest {
  return msg.messageType === 'sync_request';
}

export function isSyncResponse(msg: SyncMessage): msg is SyncResponse {
  return msg.messageType === 'sync_response';
}
