import type { DesktopVaultItem } from '../shared/messages';
import { PAIR_TIMEOUT_MS } from '../shared/constants';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  PAIRING = 'pairing',
  CONNECTED = 'connected',
  LOCKED = 'locked',
}

export interface ExtensionState {
  connectionState: ConnectionState;
  serverFingerprint?: string;
  isPaired: boolean;
  vaultItems: DesktopVaultItem[];
  lastError?: string;
}

export function createDefaultState(): ExtensionState {
  return {
    connectionState: ConnectionState.DISCONNECTED,
    isPaired: false,
    vaultItems: [],
  };
}

export function shouldAllowReconnect(state: ExtensionState): boolean {
  return state.connectionState === ConnectionState.DISCONNECTED
    || state.connectionState === ConnectionState.LOCKED;
}

export const PAIR_TIMEOUT_MS_EXPORT = PAIR_TIMEOUT_MS;
