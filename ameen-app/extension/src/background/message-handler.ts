import type { ExtensionResponse } from '../shared/messages';

export function forwardToPopup(response: ExtensionResponse): void {
  chrome.runtime.sendMessage({ type: 'extension_response', response }).catch(() => {});
}

export function forwardToContent(tabId: number, response: ExtensionResponse): void {
  chrome.tabs.sendMessage(tabId, { type: 'extension_response', response }).catch(() => {});
}
