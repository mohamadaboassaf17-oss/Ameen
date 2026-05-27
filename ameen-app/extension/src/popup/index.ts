import { ConnectionState, type ExtensionState } from '../background/state';
import type { DesktopVaultItem } from '../shared/messages';

type ViewId = 'disconnected' | 'pairing' | 'connected' | 'locked' | 'detail' | 'generator';
type TabFilter = 'all' | 'password' | 'note' | 'card';
type GenTab = 'password' | 'otp';

function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Element not found: ${id}`);
  return found;
}

function tryEl(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// ========== STATE ==========
let currentState: ExtensionState = {
  connectionState: ConnectionState.DISCONNECTED,
  isPaired: false,
  vaultItems: [],
};
let activeTab: TabFilter = 'all';
let searchQuery = '';
let selectedItem: DesktopVaultItem | null = null;
let currentView: ViewId = 'disconnected';
let previousView: ViewId = 'disconnected';
let activeGenTab: GenTab = 'password';
let genPasswordResult = '';
let otpInterval: ReturnType<typeof setInterval> | null = null;

// ========== ELEMENT REFS ==========
const statusBarEl = el('statusBar');
const statusTextEl = el('statusText');
const errorBannerEl = el('errorBanner');
const fingerprintDisplayEl = el('fingerprintDisplay');
const itemListEl = el('itemList');
const searchInputEl = el('searchInput') as HTMLInputElement;
const emptyStateEl = el('emptyState');
const itemCountEl = el('itemCount');
const detailFieldsEl = el('detailFields');

const viewEls: Record<ViewId, HTMLElement> = {
  disconnected: el('viewDisconnected'),
  pairing: el('viewPairing'),
  connected: el('viewConnected'),
  locked: el('viewLocked'),
  detail: el('viewDetail'),
  generator: el('viewGenerator'),
};

// ========== UTILITY ==========

function formatFingerprintForDisplay(fp: string): string {
  if (!fp || fp.length < 8) return fp;
  const parts: string[] = [];
  for (let i = 0; i < fp.length; i += 2) {
    parts.push(fp.substring(i, i + 2));
  }
  return parts.join(' ');
}

function getItemTypeIcon(type: string): string {
  switch (type) {
    case 'password': return '🔑';
    case 'note': return '📝';
    case 'card': return '💳';
    default: return '🔑';
  }
}

function getItemSubtitle(item: DesktopVaultItem): string {
  switch (item.type) {
    case 'password': return item.username || item.url || '';
    case 'card': return item.cardholder || item.number || '';
    case 'note': return item.content ? item.content.substring(0, 60) + (item.content.length > 60 ? '...' : '') : '';
    default: return '';
  }
}

function switchToView(view: ViewId): void {
  if (currentView === view) return;
  previousView = currentView;
  currentView = view;
  for (const [id, elm] of Object.entries(viewEls)) {
    if (id === view) {
      elm.classList.add('active');
    } else {
      elm.classList.remove('active');
    }
  }
}

function updateStatusBar(): void {
  const state = currentState.connectionState;
  statusBarEl.className = state;
  switch (state) {
    case ConnectionState.DISCONNECTED:
      statusTextEl.textContent = 'غير متصل';
      break;
    case ConnectionState.CONNECTING:
      statusTextEl.textContent = 'جاري الاتصال...';
      break;
    case ConnectionState.PAIRING:
      statusTextEl.textContent = 'تأكيد الاقتران';
      break;
    case ConnectionState.CONNECTED:
      statusTextEl.textContent = 'الخزنة متصلة';
      break;
    case ConnectionState.LOCKED:
      statusTextEl.textContent = 'مقفل';
      break;
  }
}

function showError(message: string): void {
  errorBannerEl.textContent = message;
  errorBannerEl.classList.add('visible');
  setTimeout(() => {
    errorBannerEl.classList.remove('visible');
  }, 5000);
}

function hideError(): void {
  errorBannerEl.classList.remove('visible');
}

async function copyToClipboard(text: string, buttonEl?: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    if (buttonEl) {
      const originalText = buttonEl.textContent || '';
      buttonEl.textContent = '✓';
      buttonEl.classList.add('copied', 'copied-anim');
      setTimeout(() => {
        buttonEl.textContent = originalText;
        buttonEl.classList.remove('copied', 'copied-anim');
      }, 1200);
    }
  } catch {
    showError('فشل النسخ إلى الحافظة');
  }
}

// ========== FILTERING ==========

function getFilteredItems(): DesktopVaultItem[] {
  let items = currentState.vaultItems;

  if (activeTab !== 'all') {
    items = items.filter(item => item.type === activeTab);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    items = items.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.username || '').toLowerCase().includes(q) ||
      (item.url || '').toLowerCase().includes(q) ||
      (item.cardholder || '').toLowerCase().includes(q) ||
      (item.content || '').toLowerCase().includes(q)
    );
  }

  return items;
}

// ========== RENDER FUNCTIONS ==========

function renderItemList(): void {
  const items = getFilteredItems();
  itemListEl.innerHTML = '';

  if (items.length === 0) {
    itemListEl.style.display = 'none';
    emptyStateEl.style.display = 'block';
    emptyStateEl.textContent = searchQuery.trim() ? 'لا توجد نتائج تطابق بحثك' : 'لا توجد عناصر';
  } else {
    itemListEl.style.display = 'block';
    emptyStateEl.style.display = 'none';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.setAttribute('role', 'listitem');
      row.setAttribute('tabindex', '0');
      row.dataset.itemId = item.id;
      row.innerHTML = `
        <div class="item-icon">${getItemTypeIcon(item.type)}</div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-subtitle">${escapeHtml(getItemSubtitle(item))}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        selectedItem = item;
        renderItemDetail();
        switchToView('detail');
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectedItem = item;
          renderItemDetail();
          switchToView('detail');
        }
      });
      itemListEl.appendChild(row);
    }
  }
  updateItemCount();
}

function renderItemDetail(): void {
  if (!selectedItem) return;
  const item = selectedItem;
  let html = `<h3 style="font-size:16px;font-weight:700;margin-bottom:16px;padding:0 16px;padding-top:16px">${escapeHtml(item.title)}</h3>`;

  switch (item.type) {
    case 'password':
      html += renderField('اسم المستخدم', item.username, true);
      html += renderPasswordField('كلمة المرور', item.password);
      if (item.url) html += renderField('الرابط', item.url, true);
      if (item.notes) html += renderField('ملاحظات', item.notes, true);
      if (item.otpSecret) html += renderOtpField(item);
      break;

    case 'note':
      if (item.content) html += renderField('المحتوى', item.content, true);
      if (item.notes) html += renderField('ملاحظات', item.notes, true);
      break;

    case 'card':
      html += renderField('حامل البطاقة', item.cardholder, true);
      html += renderField('رقم البطاقة', item.number, true);
      if (item.expiry) html += renderField('تاريخ الانتهاء', item.expiry, true);
      if (item.cvv) html += renderField('رمز التحقق', item.cvv, true, true);
      if (item.notes) html += renderField('ملاحظات', item.notes, true);
      break;
  }

  detailFieldsEl.innerHTML = html;
  attachDetailEvents();
}

function renderField(label: string, value: string, showCopy: boolean, masked = false): string {
  if (!value && value !== '0') return '';
  const displayValue = masked ? '••••••••' : escapeHtml(value);
  const maskedClass = masked ? ' masked' : '';
  const copyBtn = showCopy ? `<div class="field-actions"><button class="copy-btn" data-copy="${escapeAttr(value)}" title="نسخ">📋</button>${masked ? `<button class="reveal-btn" data-value="${escapeAttr(value)}" title="كشف">👁</button>` : ''}</div>` : '';

  return `
    <div class="field-group">
      <div class="field-label">${escapeHtml(label)}</div>
      <div class="field-value${maskedClass}">
        <span class="field-text" data-value="${escapeAttr(value)}">${displayValue}</span>
        ${copyBtn}
      </div>
    </div>
  `;
}

function renderPasswordField(label: string, value: string): string {
  if (!value) return '';
  return `
    <div class="field-group">
      <div class="field-label">${escapeHtml(label)}</div>
      <div class="field-value masked">
        <span class="field-text">••••••••</span>
        <div class="field-actions">
          <button class="copy-btn" data-copy="${escapeAttr(value)}" title="نسخ">📋</button>
          <button class="reveal-btn" data-value="${escapeAttr(value)}" title="كشف">👁</button>
        </div>
      </div>
    </div>
  `;
}

function renderOtpField(item: DesktopVaultItem): string {
  const code = generateOTPCode(item.otpSecret);
  const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
  return `
    <div class="field-group">
      <div class="field-label">رمز OTP</div>
      <div class="otp-section">
        <div class="otp-label">رمز الاستخدام لمرة واحدة</div>
        <div class="otp-code" id="detailOtpCode">${code}</div>
        <div class="otp-countdown" id="detailOtpCountdown">ينتهي خلال ${remaining} ثانية</div>
        <button class="copy-btn small" data-copy="${escapeAttr(code)}" style="margin-top:8px;width:100%">📋 نسخ الرمز</button>
      </div>
    </div>
  `;
}

function attachDetailEvents(): void {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const copyVal = (btn as HTMLElement).dataset.copy;
      if (copyVal) {
        void copyToClipboard(copyVal, btn as HTMLElement);
      }
    });
  });

  document.querySelectorAll('.reveal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = (btn as HTMLElement).dataset.value;
      const fieldValue = (btn as HTMLElement).closest('.field-value');
      const fieldText = fieldValue?.querySelector('.field-text') as HTMLElement | null;
      if (fieldValue && fieldText && value) {
        const isMasked = fieldValue.classList.contains('masked');
        if (isMasked) {
          fieldValue.classList.remove('masked');
          fieldText.textContent = value;
          (btn as HTMLElement).textContent = '🙈';
        } else {
          fieldValue.classList.add('masked');
          fieldText.textContent = '••••••••';
          (btn as HTMLElement).textContent = '👁';
        }
      }
    });
  });

  startOtpCountdown();
}

function startOtpCountdown(): void {
  const countdownEl = document.getElementById('detailOtpCountdown');
  const codeEl = document.getElementById('detailOtpCode');
  if (!countdownEl || !codeEl || !selectedItem?.otpSecret) return;

  if (otpInterval) clearInterval(otpInterval);

  const update = () => {
    const elapsed = Math.floor(Date.now() / 1000) % 30;
    const remaining = 30 - elapsed;
    countdownEl.textContent = `ينتهي خلال ${remaining} ثانية`;
    if (remaining === 30) {
      const newCode = generateOTPCode(selectedItem!.otpSecret);
      codeEl.textContent = newCode;
      const copyBtn = document.querySelector('#detailOtpCode + .otp-countdown + .copy-btn') as HTMLElement | null;
      if (copyBtn) {
        copyBtn.dataset.copy = newCode;
      }
    }
  };

  update();
  otpInterval = setInterval(update, 1000);
}

function generateOTPCode(secret: string): string {
  try {
    const timeWindow = Math.floor(Date.now() / 1000 / 30);
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = secret.toUpperCase().replace(/[^A-Z2-7=]/g, '');
    let bits = '';
    for (const ch of cleaned) {
      if (ch === '=') break;
      const val = base32Chars.indexOf(ch);
      if (val >= 0) bits += val.toString(2).padStart(5, '0');
    }
    const keyBytes: number[] = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
      keyBytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    const counter = new Uint8Array(8);
    const view = new DataView(counter.buffer);
    view.setUint32(4, timeWindow, false);

    const hmacKey = new Uint8Array(keyBytes);
    const ipad = new Uint8Array(64);
    const opad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      ipad[i] = 0x36;
      opad[i] = 0x5c;
    }
    for (let i = 0; i < hmacKey.length; i++) {
      ipad[i] ^= hmacKey[i];
      opad[i] ^= hmacKey[i];
    }

    function sha1Hash(data: Uint8Array): number {
      let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
      const bytes = new Uint8Array(((data.length + 8 + 63) >> 6) << 6);
      bytes.set(data);
      bytes[data.length] = 0x80;
      const view = new DataView(bytes.buffer);
      view.setUint32(bytes.length - 4, data.length * 8, false);
      for (let i = 0; i < bytes.length; i += 64) {
        const w: number[] = new Array<number>(80);
        for (let j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
        for (let j = 16; j < 80; j++) {
          const v = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
          w[j] = (v << 1 | v >>> 31);
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let j = 0; j < 80; j++) {
          let f: number, k: number;
          if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
          else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
          else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
          else { f = b ^ c ^ d; k = 0xCA62C1D6; }
          const temp = ((a << 5 | a >>> 27) + f + e + k + w[j]) >>> 0;
          e = d; d = c; c = (b << 30 | b >>> 2) >>> 0; b = a; a = temp;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
      }
      const result = new Uint8Array(20);
      const rv = new DataView(result.buffer);
      rv.setUint32(0, h0, false); rv.setUint32(4, h1, false); rv.setUint32(8, h2, false); rv.setUint32(12, h3, false); rv.setUint32(16, h4, false);
      const offset = result[19] & 0x0f;
      return ((result[offset] & 0x7f) << 24) | (result[offset + 1] << 16) | (result[offset + 2] << 8) | result[offset + 3];
    }

    const innerData = new Uint8Array(ipad.length + counter.length);
    innerData.set(ipad);
    innerData.set(counter, ipad.length);
    const innerHash = sha1Hash(innerData);
    const innerHashBytes = new Uint8Array(20);
    const ihv = new DataView(innerHashBytes.buffer);
    for (let i = 0; i < 5; i++) { ihv.setUint32(i * 4, (innerHash >>> ((4 - i) * 8)) & 0xff, false); }
    // Actually rebuild properly
    const hashVal = sha1Hash(innerData);
    const hashArr = new Uint8Array(20);
    const hv = new DataView(hashArr.buffer);
    for (let i = 0; i < 20; i++) {
      hv.setUint8(i, (hashVal >>> ((3 - (i % 4)) * 8 + (3 - Math.floor(i / 4)) * 32)) & 0xff);
    }

    const otpBytes = new Uint8Array(64);
    otpBytes.set(opad);
    otpBytes.set(hashArr, opad.length);
    const otpHash = sha1Hash(otpBytes);
    const offset = otpHash & 0x0f;
    const binary = ((otpHash >>> ((3 - offset) * 8)) & 0xff) << 24;
    const truncated = binary & 0x7fffffff;
    const otp = truncated % 1000000;

    return otp.toString().padStart(6, '0');
  } catch {
    return '------';
  }
}

function updateItemCount(): void {
  const filtered = getFilteredItems();
  const total = currentState.vaultItems.length;
  if (searchQuery.trim() || activeTab !== 'all') {
    itemCountEl.textContent = `${filtered.length} من ${total} عنصر`;
  } else {
    itemCountEl.textContent = `${total} عنصر`;
  }
}

function renderGenerator(): void {
  el('genLengthVal').textContent = (el('genLength') as HTMLInputElement).value;
}

function renderState(state: ExtensionState): void {
  currentState = state;
  hideError();

  if (state.lastError) {
    showError(state.lastError);
  }

  updateStatusBar();

  switch (state.connectionState) {
    case ConnectionState.DISCONNECTED:
      switchToView('disconnected');
      break;
    case ConnectionState.CONNECTING:
      switchToView('disconnected');
      break;
    case ConnectionState.PAIRING:
      switchToView('pairing');
      if (state.serverFingerprint) {
        fingerprintDisplayEl.textContent = formatFingerprintForDisplay(state.serverFingerprint);
      }
      break;
    case ConnectionState.CONNECTED:
      if (state.vaultItems.length > 0) {
        switchToView('connected');
        renderItemList();
      } else {
        switchToView('connected');
        requestVault();
      }
      break;
    case ConnectionState.LOCKED:
      switchToView('locked');
      break;
  }
}

// ========== HELPERS ==========

function escapeHtml(text: string): string {
  if (!text) return '';
  const elm = document.createElement('span');
  elm.textContent = text;
  return elm.innerHTML;
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== COMMUNICATION ==========

function requestVault(): void {
  chrome.runtime.sendMessage({ type: 'get_vault' }, (response: Record<string, unknown>) => {
    if (chrome.runtime.lastError) return;
    if (response && response.error) {
      showError(String(response.error));
    }
  });
}

function requestState(): void {
  chrome.runtime.sendMessage(
    { type: 'get_state' },
    (response: Record<string, unknown>) => {
      if (chrome.runtime.lastError) return;
      if (response && response.state) {
        renderState(response.state as ExtensionState);
      }
    }
  );
}

chrome.runtime.onMessage.addListener((message: Record<string, unknown>) => {
  if (message.type === 'state_update' && message.state) {
    renderState(message.state as ExtensionState);
  }
});

// ========== PASSWORD GENERATOR ==========

function generateClientPassword(): string {
  const length = parseInt((el('genLength') as HTMLInputElement).value, 10);
  const useSymbols = (el('genSymbols') as HTMLInputElement).checked;
  const useDigits = (el('genDigits') as HTMLInputElement).checked;
  const useUppercase = (el('genUppercase') as HTMLInputElement).checked;
  const useLowercase = (el('genLowercase') as HTMLInputElement).checked;

  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  let chars = '';
  const required: string[] = [];
  if (useLowercase) { chars += lower; required.push(lower[Math.floor(Math.random() * lower.length)]); }
  if (useUppercase) { chars += upper; required.push(upper[Math.floor(Math.random() * upper.length)]); }
  if (useDigits) { chars += digits; required.push(digits[Math.floor(Math.random() * digits.length)]); }
  if (useSymbols) { chars += symbols; required.push(symbols[Math.floor(Math.random() * symbols.length)]); }

  if (!chars) { chars = lower + digits; required.push(lower[Math.floor(Math.random() * lower.length)]); }

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }

  for (let i = 0; i < required.length; i++) {
    const pos = array[i] % length;
    result = result.substring(0, pos) + required[i] + result.substring(pos + 1);
  }

  return result;
}

function runClientGenerator(): void {
  const result = generateClientPassword();
  genPasswordResult = result;
  const resultDiv = el('genPasswordResult');
  resultDiv.style.display = 'flex';
  const textSpan = resultDiv.querySelector('.gen-text') as HTMLElement;
  textSpan.textContent = result;
}

function runClientOtpGenerator(): void {
  const secretInput = el('otpSecretInput') as HTMLInputElement;
  const secret = secretInput.value.trim();
  if (!secret) {
    showError('الرجاء إدخال مفتاح سري');
    return;
  }

  const resultDiv = el('genOtpResult');
  resultDiv.style.display = 'block';

  const update = () => {
    const code = generateOTPCode(secret);
    const codeEl = el('genOtpCode');
    codeEl.textContent = code;
    const elapsed = Math.floor(Date.now() / 1000) % 30;
    const remaining = 30 - elapsed;
    el('genOtpCountdown').textContent = `ينتهي خلال ${remaining} ثانية`;
    const copyBtn = resultDiv.querySelector('.copy-btn') as HTMLElement;
    if (copyBtn) {
      copyBtn.dataset.copy = code;
    }
  };

  if (otpInterval) clearInterval(otpInterval);
  update();
  otpInterval = setInterval(update, 1000);
}

// ========== EVENT HANDLERS ==========

function setupTabBar(): void {
  el('tabBar').addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('tab')) return;
    const tab = target.dataset.tab as TabFilter;
    if (!tab || tab === activeTab) return;

    document.querySelectorAll('#tabBar .tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    activeTab = tab;
    renderItemList();
  });
}

function setupSearch(): void {
  searchInputEl.addEventListener('input', () => {
    searchQuery = searchInputEl.value;
    renderItemList();
  });
}

function setupButtonDelegation(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target || !target.id) return;

    switch (target.id) {
      case 'btnConnect':
      case 'btnReconnect':
        chrome.runtime.sendMessage({ type: 'connect' });
        break;

      case 'btnConfirmPair':
        chrome.runtime.sendMessage({ type: 'confirm_pairing', confirmed: true });
        break;

      case 'btnRejectPair':
        chrome.runtime.sendMessage({ type: 'reject_pairing' });
        break;

      case 'btnDisconnect':
        chrome.runtime.sendMessage({ type: 'disconnect' });
        break;

      case 'btnBack':
        if (otpInterval) { clearInterval(otpInterval); otpInterval = null; }
        if (selectedItem && currentState.connectionState === ConnectionState.CONNECTED) {
          switchToView('connected');
          renderItemList();
          selectedItem = null;
        } else if (previousView !== 'detail') {
          switchToView('connected');
        } else {
          switchToView(previousView);
        }
        break;

      case 'btnGenerator':
        switchToView('generator');
        renderGenerator();
        break;

      case 'btnLock':
        chrome.runtime.sendMessage({ type: 'get_state' });
        break;

      case 'btnSettings':
        chrome.runtime.openOptionsPage().catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL('popup/settings.html') });
        });
        break;

      case 'btnGeneratePassword':
        runClientGenerator();
        break;

      case 'btnGenerateOtp':
        runClientOtpGenerator();
        break;
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('copy-btn') && !target.closest('#viewDetail') && target.closest('#viewGenerator')) {
      const copyVal = target.dataset.copy;
      if (copyVal) {
        void copyToClipboard(copyVal, target);
      }
    }
  });
}

function setupGenTabs(): void {
  el('viewGenerator').addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('gen-tab')) return;
    const gen = target.dataset.gen as GenTab;
    if (!gen || gen === activeGenTab) return;

    document.querySelectorAll('#viewGenerator .gen-tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    activeGenTab = gen;

    el('genPassword').style.display = gen === 'password' ? 'block' : 'none';
    el('genOtp').style.display = gen === 'otp' ? 'block' : 'none';

    if (gen === 'otp' && otpInterval) {
      clearInterval(otpInterval);
      otpInterval = null;
    }
  });
}

function setupGeneratorRange(): void {
  const range = el('genLength') as HTMLInputElement;
  range.addEventListener('input', () => {
    el('genLengthVal').textContent = range.value;
  });
}

// ========== INIT ==========

function init(): void {
  setupTabBar();
  setupSearch();
  setupButtonDelegation();
  setupGenTabs();
  setupGeneratorRange();
  requestState();
}

document.addEventListener('DOMContentLoaded', init);
