import { ExtensionWebSocket } from './websocket-client';
import {
  ConnectionState,
  createDefaultState,
  shouldAllowReconnect,
  PAIR_TIMEOUT_MS_EXPORT,
} from './state';
import type { ExtensionState } from './state';
import { savePairingState, isAlreadyPaired } from './pairing';
import { forwardToPopup } from './message-handler';
import {
  PING_INTERVAL_MS,
  RECONNECT_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
} from '../shared/constants';
import type { ExtensionRequest, ExtensionResponse } from '../shared/messages';

let state: ExtensionState = createDefaultState();
let ws: ExtensionWebSocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;

function broadcastState(): void {
  chrome.runtime.sendMessage({
    type: 'state_update',
    state: { ...state },
  }).catch(() => {});
}

function setState(partial: Partial<ExtensionState>): void {
  state = { ...state, ...partial };
  broadcastState();
}

async function sendRequestAndReceive(
  requestType: ExtensionRequest['type'],
  payload?: Record<string, unknown>
): Promise<ExtensionResponse> {
  if (!ws || !ws.isConnected) {
    throw new Error('غير متصل');
  }

  const request: ExtensionRequest = {
    id: crypto.randomUUID(),
    type: requestType,
    payload: payload ? JSON.stringify(payload) : undefined,
  };

  await ws.send(request);
  return ws.receive();
}

async function doConnect(): Promise<void> {
  if (state.connectionState === ConnectionState.CONNECTING) {
    return;
  }

  setState({
    connectionState: ConnectionState.CONNECTING,
    lastError: undefined,
  });

  try {
    ws = new ExtensionWebSocket();

    ws.onDisconnect(() => {
      setState({
        connectionState: ConnectionState.DISCONNECTED,
        lastError: 'انقطع الاتصال بالتطبيق',
      });

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
          void tryReconnect();
        }, RECONNECT_DELAY_MS);
      }
    });

    const { fingerprint } = await ws.connect();

    setState({
      connectionState: ConnectionState.PAIRING,
      serverFingerprint: fingerprint,
    });

    reconnectAttempts = 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل الاتصال';
    setState({
      connectionState: ConnectionState.DISCONNECTED,
      lastError: message,
    });
    ws = null;
  }
}

async function tryReconnect(): Promise<void> {
  if (!shouldAllowReconnect(state)) {
    return;
  }
  await doConnect();
}

function startPing(): void {
  stopPing();
  pingInterval = setInterval(() => {
    void sendPing();
  }, PING_INTERVAL_MS);
}

function stopPing(): void {
  if (pingInterval !== null) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

async function sendPing(): Promise<void> {
  if (!ws || !ws.isConnected) {
    return;
  }
  try {
    await sendRequestAndReceive('ping');
  } catch {
    console.debug('فشل ping');
  }
}

function doDisconnect(): void {
  stopPing();
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS + 1;
  ws?.disconnect();
  ws = null;
  setState({
    connectionState: ConnectionState.DISCONNECTED,
    vaultItems: [],
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ extensionState: createDefaultState() });
});

chrome.runtime.onMessage.addListener((
  message: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: Record<string, unknown>) => void
) => {
  void handleMessage(message, sendResponse);
  return true;
});

async function handleMessage(
  message: Record<string, unknown>,
  sendResponse: (response: Record<string, unknown>) => void
): Promise<void> {
  const { type } = message;

  switch (type) {
    case 'connect':
      await doConnect();
      sendResponse({ success: true });
      break;

    case 'confirm_pairing': {
      const confirmed = message.confirmed === true;
      if (!confirmed || !ws) {
        ws?.disconnect();
        ws = null;
        setState({ connectionState: ConnectionState.DISCONNECTED });
        sendResponse({ success: false });
        break;
      }

      const paired = await isAlreadyPaired();
      if (paired) {
        await savePairingState(true);
        setState({ connectionState: ConnectionState.CONNECTED });
        startPing();
        sendResponse({ success: true });
        break;
      }

      await savePairingState(true);
      setState({
        connectionState: ConnectionState.CONNECTED,
        isPaired: true,
      });

      try {
        const response = await sendRequestAndReceive('get_vault');
        if (response.type === 'vault' && response.data) {
          const items = JSON.parse(response.data);
          setState({ vaultItems: items });
        }
      } catch {
        setState({ lastError: 'فشل تحميل الخزنة' });
      }

      startPing();
      sendResponse({ success: true });
      break;
    }

    case 'reject_pairing':
      ws?.disconnect();
      ws = null;
      setState({ connectionState: ConnectionState.DISCONNECTED });
      sendResponse({ success: true });
      break;

    case 'get_vault':
      try {
        const response = await sendRequestAndReceive('get_vault');
        if (response.type === 'vault' && response.data) {
          const items = JSON.parse(response.data);
          setState({ vaultItems: items });
        }
        forwardToPopup(response);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'فشل في جلب الخزنة',
        });
      }
      break;

    case 'get_item':
      try {
        const response = await sendRequestAndReceive('get_item', {
          itemId: message.itemId,
        });
        forwardToPopup(response);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'فشل في جلب العنصر',
        });
      }
      break;

    case 'search_items':
      try {
        const response = await sendRequestAndReceive('search_items', {
          query: message.query,
        });
        forwardToPopup(response);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'فشل في البحث',
        });
      }
      break;

    case 'generate_otp':
      try {
        const response = await sendRequestAndReceive('generate_otp', {
          secret: message.secret,
        });
        forwardToPopup(response);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'فشل في توليد رمز OTP',
        });
      }
      break;

    case 'generate_password':
      try {
        const response = await sendRequestAndReceive('generate_password', {
          length: message.length ?? 20,
          useSymbols: message.useSymbols ?? true,
          useDigits: message.useDigits ?? true,
          useUppercase: message.useUppercase ?? true,
          useLowercase: message.useLowercase ?? true,
        });
        forwardToPopup(response);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'فشل في توليد كلمة المرور',
        });
      }
      break;

    case 'disconnect':
      doDisconnect();
      sendResponse({ success: true });
      break;

    case 'get_state':
      sendResponse({ success: true, state: { ...state } });
      break;

    default:
      sendResponse({
        success: false,
        error: `نوع رسالة غير معروف: ${String(type)}`,
      });
  }
}
