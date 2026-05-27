import type { ExtensionResponse } from '../shared/messages';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('forwardToPopup', () => {
  it('sends response to chrome.runtime.sendMessage', async () => {
    const { forwardToPopup } = await import('./message-handler');

    const response: ExtensionResponse = {
      id: '1',
      type: 'paired',
    };

    forwardToPopup(response);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'extension_response',
      response,
    });
  });

  it('does not throw when chrome.runtime.sendMessage rejects', () => {
    const mockSend = vi.fn().mockRejectedValue(new Error('disconnected'));
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSend },
      tabs: { sendMessage: vi.fn() },
    });

    return import('./message-handler').then(({ forwardToPopup }) => {
      const response: ExtensionResponse = { id: '1', type: 'pong' };
      expect(() => forwardToPopup(response)).not.toThrow();
    });
  });
});

describe('forwardToContent', () => {
  it('sends response to a specific tab', async () => {
    const { forwardToContent } = await import('./message-handler');

    const response: ExtensionResponse = {
      id: '2',
      type: 'vault',
      data: '[]',
    };

    forwardToContent(42, response);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: 'extension_response',
      response,
    });
  });

  it('does not throw when chrome.tabs.sendMessage rejects', () => {
    const mockSend = vi.fn().mockRejectedValue(new Error('no tab'));
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: vi.fn() },
      tabs: { sendMessage: mockSend },
    });

    return import('./message-handler').then(({ forwardToContent }) => {
      const response: ExtensionResponse = { id: '1', type: 'error' };
      expect(() => forwardToContent(1, response)).not.toThrow();
    });
  });
});
