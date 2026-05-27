import { VaultItem } from './vault-format';

export interface MergeResult {
  merged: VaultItem[];
  conflicts: VaultItem[];
  stats: {
    synced: number;
    newItems: number;
    conflicts: number;
  };
}

function deepEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function mergeVaults(
  localItems: VaultItem[],
  remoteItems: VaultItem[]
): MergeResult {
  const localMap = new Map<string, VaultItem>();
  for (const item of localItems) {
    localMap.set(item.id, item);
  }

  const merged = new Map<string, VaultItem>();
  const conflicts: VaultItem[] = [];
  let synced = 0;
  let newItems = 0;

  for (const remoteItem of remoteItems) {
    const localItem = localMap.get(remoteItem.id);

    if (!localItem) {
      merged.set(remoteItem.id, remoteItem);
      newItems++;
      continue;
    }

    if (remoteItem.revision > localItem.revision) {
      merged.set(remoteItem.id, remoteItem);
      synced++;
    } else if (remoteItem.revision < localItem.revision) {
      merged.set(localItem.id, localItem);
    } else {
      if (
        !deepEqual(localItem.data, remoteItem.data) ||
        localItem.title !== remoteItem.title ||
        localItem.type !== remoteItem.type
      ) {
        const now = Date.now();
        const localConflict: VaultItem = {
          ...localItem,
          isConflict: true,
          conflictDate: now,
          conflictOriginalId: remoteItem.id,
        };
        const remoteConflict: VaultItem = {
          ...remoteItem,
          isConflict: true,
          conflictDate: now,
          conflictOriginalId: localItem.id,
        };
        merged.set(localItem.id, localConflict);
        merged.set(remoteItem.id + '_conflict', remoteConflict);
        conflicts.push(localConflict);
      } else {
        merged.set(localItem.id, localItem);
      }
    }
  }

  for (const localItem of localItems) {
    if (!merged.has(localItem.id)) {
      merged.set(localItem.id, localItem);
    }
  }

  return {
    merged: Array.from(merged.values()),
    conflicts,
    stats: { synced, newItems, conflicts: conflicts.length },
  };
}
