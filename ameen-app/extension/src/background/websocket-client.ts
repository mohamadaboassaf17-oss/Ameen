import { WS_URL, PAIR_TIMEOUT_MS } from '../shared/constants';
import type { ExtensionRequest, ExtensionResponse } from '../shared/messages';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function asBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>;
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class ExtensionWebSocket {
  private ws: WebSocket | null = null;
  private aesKey: CryptoKey | null = null;
  private keyPair: CryptoKeyPair | null = null;
  private ourPublicKeyB64: string = '';
  private _isConnected = false;
  private messageQueue: ExtensionResponse[] = [];
  private receiveResolvers: Array<{
    resolve: (value: ExtensionResponse) => void;
    reject: (reason: Error) => void;
  }> = [];
  private disconnectCallback: (() => void) | null = null;

  get isConnected(): boolean {
    return this._isConnected && this.ws !== null;
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  async connect(): Promise<{ fingerprint: string }> {
    this.keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );

    const pubKeyRaw = await crypto.subtle.exportKey('spki', this.keyPair.publicKey);
    this.ourPublicKeyB64 = bytesToB64(new Uint8Array(pubKeyRaw));

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('انتهت مهلة الاتصال'));
      }, PAIR_TIMEOUT_MS);

      this.ws.onopen = () => {
        console.debug('WebSocket متصل — في انتظار المفتاح العام للخادم');
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        if (typeof event.data !== 'string') {
          return;
        }

        clearTimeout(timeout);

        try {
          const serverPubKeyB64 = event.data.trim();
          const serverPubBytes = b64ToBytes(serverPubKeyB64);

          const fpHash = await crypto.subtle.digest('SHA-256', asBuffer(serverPubBytes));
          const fpBytes = new Uint8Array(fpHash).slice(0, 6);
          const fingerprint = Array.from(fpBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();

          const theirPubKey = await crypto.subtle.importKey(
            'spki',
            asBuffer(serverPubBytes),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
          );

          const sharedSecret = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: theirPubKey },
            this.keyPair!.privateKey,
            256
          );

          const aesKeyRaw = await crypto.subtle.digest('SHA-256', sharedSecret);
          this.aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyRaw,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
          );

          this.ws!.send(this.ourPublicKeyB64);

          this._isConnected = true;
          this.ws!.onmessage = this.handleEncryptedMessage.bind(this);

          resolve({ fingerprint });
        } catch (err) {
          reject(new Error(`فشل إتمام المصافحة: ${err instanceof Error ? err.message : String(err)}`));
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('فشل الاتصال بالتطبيق المحلي — تأكد من تشغيل التطبيق'));
      };

      this.ws.onclose = () => {
        clearTimeout(timeout);
        this._isConnected = false;
        this.aesKey = null;
        this.keyPair = null;
        this.ws = null;
        this.messageQueue = [];

        for (const r of this.receiveResolvers) {
          r.reject(new Error('أُغلق الاتصال'));
        }
        this.receiveResolvers = [];

        this.disconnectCallback?.();
      };
    });
  }

  async send(request: ExtensionRequest): Promise<void> {
    if (!this.ws || !this.aesKey) {
      throw new Error('غير متصل — لا يمكن إرسال الطلب');
    }

    const json = JSON.stringify(request);
    const plaintext = new TextEncoder().encode(json);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBuffer(iv) },
      this.aesKey,
      asBuffer(plaintext)
    );

    const combined = new Uint8Array(encrypted);
    const ciphertextLen = combined.length - TAG_LENGTH;

    const msg = new Uint8Array(1 + IV_LENGTH + 4 + combined.length);
    msg[0] = IV_LENGTH;
    msg.set(iv, 1);

    const view = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
    view.setUint32(1 + IV_LENGTH, combined.length, true); // little-endian to match C# BitConverter

    msg.set(combined.subarray(0, ciphertextLen), 1 + IV_LENGTH + 4);
    msg.set(combined.subarray(ciphertextLen), 1 + IV_LENGTH + 4 + ciphertextLen);

    this.ws.send(msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength));
  }

  async receive(): Promise<ExtensionResponse> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift()!;
    }

    return new Promise((resolve, reject) => {
      this.receiveResolvers.push({ resolve, reject });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this._isConnected = false;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.aesKey = null;
    this.keyPair = null;
    this.messageQueue = [];
    for (const r of this.receiveResolvers) {
      r.reject(new Error('تم قطع الاتصال'));
    }
    this.receiveResolvers = [];
  }

  private async handleEncryptedMessage(event: MessageEvent): Promise<void> {
    if (!(event.data instanceof ArrayBuffer)) {
      return;
    }

    try {
      const data = new Uint8Array(event.data as ArrayBuffer);
      const ivLen = data[0];

      if (ivLen !== IV_LENGTH) {
        console.error('طول IV غير متوقع:', ivLen);
        return;
      }

      const iv = data.slice(1, 1 + ivLen);
      const view = new DataView(data.buffer, data.byteOffset + 1 + ivLen, 4);
      const payloadLen = view.getUint32(0, true); // little-endian to match C# BitConverter

      const payload = data.slice(1 + ivLen + 4, 1 + ivLen + 4 + payloadLen);
      const ciphertext = payload.subarray(0, payloadLen - TAG_LENGTH);
      const tag = payload.subarray(payloadLen - TAG_LENGTH);

      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext);
      combined.set(tag, ciphertext.length);

      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: asBuffer(iv) },
        this.aesKey!,
        asBuffer(combined)
      );

      const json = new TextDecoder().decode(plaintext);
      const response = JSON.parse(json) as ExtensionResponse;

      if (this.receiveResolvers.length > 0) {
        const receiver = this.receiveResolvers.shift()!;
        receiver.resolve(response);
      } else {
        this.messageQueue.push(response);
      }
    } catch (err) {
      console.error('فشل فك تشفير الرسالة:', err);
      if (this.receiveResolvers.length > 0) {
        this.receiveResolvers.shift()!.reject(
          new Error('فشل فك تشفير الرسالة')
        );
      }
    }
  }
}
