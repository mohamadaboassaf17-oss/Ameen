import { detectForms, findBestLoginForm, DetectedForm, DetectedField } from './field-detector';
import { autofillLogin, autofillOTP } from './autofill';
import { AutofillOverlay } from './overlay';
import { detectOtpFields, OtpField } from './otp-detector';
import { DesktopVaultItem } from '../shared/messages';
import { scoreUrlMatch } from '../shared/utils';

const OVERLAY_MAX_ITEMS = 5;
const KEYBOARD_SHORTCUT_FILL = 'Ctrl+Shift+L';
const KEYBOARD_SHORTCUT_OTP = 'Ctrl+Shift+O';

let activeField: HTMLInputElement | null = null;
let detectedForms: DetectedForm[] = [];
let detectedOtpFields: OtpField[] = [];
let overlay = new AutofillOverlay();
let pendingMatchingItems: DesktopVaultItem[] = [];

function logError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[Ameen] ${context}: ${message}`);
}

function findFormForField(field: HTMLInputElement): DetectedForm | undefined {
  for (const form of detectedForms) {
    if (form.fields.some(f => f.element === field)) {
      return form;
    }
  }
  return undefined;
}

function isCredentialField(field: HTMLInputElement): boolean {
  if (!field) return false;
  const type = (field.getAttribute('type') ?? 'text').toLowerCase();
  if (type === 'password') return true;
  if (type === 'email') return true;
  const name = (field.name ?? '').toLowerCase();
  const id = (field.id ?? '').toLowerCase();
  const autocomplete = (field.getAttribute('autocomplete') ?? '').toLowerCase();
  return (
    name.includes('user') || name.includes('login') || name.includes('email') || name.includes('account') ||
    id.includes('user') || id.includes('login') || id.includes('email') || id.includes('account') ||
    autocomplete.includes('username') || autocomplete.includes('email')
  );
}

function isOtpField(field: HTMLInputElement): boolean {
  return detectedOtpFields.some(otp => otp.element === field);
}

function getDetectedField(element: HTMLInputElement): DetectedField | undefined {
  for (const form of detectedForms) {
    const match = form.fields.find(f => f.element === element);
    if (match) return match;
  }
  return undefined;
}

function sortByUrlMatch(items: DesktopVaultItem[]): DesktopVaultItem[] {
  const pageUrl = window.location.href;
  return [...items].sort((a, b) => {
    const scoreA = a.url ? scoreUrlMatch(pageUrl, a.url) : 0;
    const scoreB = b.url ? scoreUrlMatch(pageUrl, b.url) : 0;
    return scoreB - scoreA;
  });
}

function handleFieldFocus(event: FocusEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.readOnly || target.disabled) return;
  if (target.getAttribute('data-ameen-ignore') === 'true') return;

  activeField = target;

  if (isOtpField(target)) {
    try {
      chrome.runtime.sendMessage({ type: 'field_focused', fieldType: 'otp' }).catch(() => {});
    } catch {
      /* disconnected */
    }
    return;
  }

  if (isCredentialField(target)) {
    const form = findFormForField(target);
    const formCategory = form?.category ?? 'unknown';

    try {
      chrome.runtime.sendMessage({
        type: 'field_focused',
        fieldType: 'credential',
        formCategory,
        url: window.location.href,
      }).catch(() => {});
    } catch {
      /* disconnected */
    }

    if (pendingMatchingItems.length > 0) {
      const field = target.getBoundingClientRect();
      overlay.show(pendingMatchingItems.slice(0, OVERLAY_MAX_ITEMS), field);
    }
  }
}

function handleFieldBlur(event: FocusEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (activeField === target) {
    activeField = null;
  }
}

function refreshDetections(): void {
  try {
    detectedForms = detectForms();
  } catch (err) {
    logError('فشل كشف النماذج', err);
    detectedForms = [];
  }
  try {
    detectedOtpFields = detectOtpFields();
  } catch (err) {
    logError('فشل كشف حقول OTP', err);
    detectedOtpFields = [];
  }
}

function notifyFormsDetected(): void {
  if (detectedForms.length === 0 && detectedOtpFields.length === 0) return;
  try {
    chrome.runtime.sendMessage({
      type: 'forms_detected',
      forms: detectedForms.map(f => ({
        category: f.category,
        fieldCount: f.fields.length,
        hasUsername: f.fields.some(fd => fd.category === 'username' || fd.category === 'email'),
        hasPassword: f.fields.some(fd => fd.category === 'password' || fd.category === 'current_password'),
      })),
      otpCount: detectedOtpFields.length,
      url: window.location.href,
    }).catch(() => {});
  } catch {
    /* disconnected */
  }
}

function getPageForms(): {
  forms: Array<{ category: string; fieldCount: number }>;
  otpCount: number;
} {
  return {
    forms: detectedForms.map(f => ({
      category: f.category,
      fieldCount: f.fields.length,
    })),
    otpCount: detectedOtpFields.length,
  };
}

function executeAutofillLogin(item: DesktopVaultItem): void {
  const best = findBestLoginForm();
  if (!best) {
    console.warn('[Ameen] لم يتم العثور على نموذج تسجيل دخول');
    return;
  }
  autofillLogin(best.username, best.password, item.username, item.password);
}

function executeAutofillOtp(code: string): void {
  const otpFields = detectOtpFields();
  if (otpFields.length === 0) {
    console.warn('[Ameen] لم يتم العثور على حقل OTP');
    return;
  }
  const field = otpFields[0];
  autofillOTP({ element: field.element, category: 'otp', confidence: 100 }, code);
}

function handleKeyboardShortcut(event: KeyboardEvent): void {
  const isCtrlShiftL = event.ctrlKey && event.shiftKey && event.key === 'L';
  const isCtrlShiftO = event.ctrlKey && event.shiftKey && event.key === 'O';

  if (!isCtrlShiftL && !isCtrlShiftO) return;

  event.preventDefault();
  event.stopPropagation();

  if (isCtrlShiftO) {
    try {
      const otpFields = detectOtpFields();
      if (otpFields.length > 0) {
        chrome.runtime.sendMessage({ type: 'request_otp', url: window.location.href }).catch(() => {});
      }
    } catch (err) {
      logError('اختصار OTP', err);
    }
    return;
  }

  if (isCtrlShiftL) {
    try {
      chrome.runtime.sendMessage({
        type: 'request_autofill',
        url: window.location.href,
      }).catch(() => {});
    } catch (err) {
      logError('اختصار التعبئة', err);
    }
  }
}

function handleMessage(
  message: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: Record<string, unknown>) => void
): boolean {
  const msgType = message.type as string | undefined;

  switch (msgType) {
    case 'autofill_login': {
      const raw = message.item;
      if (!raw || typeof raw !== 'object') {
        sendResponse({ success: false, error: 'بيانات غير صالحة' });
        return false;
      }
      const item = raw as DesktopVaultItem;
      try {
        executeAutofillLogin(item);
        sendResponse({ success: true });
      } catch (err) {
        logError('autofill_login', err);
        sendResponse({ success: false, error: 'فشلت التعبئة التلقائية' });
      }
      break;
    }

    case 'autofill_otp': {
      const code = message.code as string | undefined;
      if (!code) {
        sendResponse({ success: false, error: 'الرمز مطلوب' });
        return false;
      }
      try {
        executeAutofillOtp(code);
        sendResponse({ success: true });
      } catch (err) {
        logError('autofill_otp', err);
        sendResponse({ success: false, error: 'فشل تعبئة رمز التحقق' });
      }
      break;
    }

    case 'get_page_forms': {
      try {
        refreshDetections();
        sendResponse({ success: true, data: getPageForms() });
      } catch (err) {
        logError('get_page_forms', err);
        sendResponse({ success: false, error: 'فشل جلب معلومات النموذج' });
      }
      break;
    }

    case 'show_overlay': {
      const raw = message.items;
      if (!Array.isArray(raw)) {
        sendResponse({ success: false, error: 'بيانات غير صالحة' });
        return false;
      }
      const items = raw as DesktopVaultItem[];
      pendingMatchingItems = sortByUrlMatch(items);
      if (activeField) {
        const rect = activeField.getBoundingClientRect();
        overlay.show(pendingMatchingItems.slice(0, OVERLAY_MAX_ITEMS), rect);
      }
      sendResponse({ success: true });
      break;
    }

    case 'hide_overlay': {
      overlay.hide();
      sendResponse({ success: true });
      break;
    }

    default:
      break;
  }

  return true;
}

function initializeOverlayCallback(): void {
  overlay.onSelect((item: DesktopVaultItem) => {
    try {
      executeAutofillLogin(item);
    } catch (err) {
      logError('اختيار العنصر', err);
    }
  });
}

function initMutationObserver(): void {
  const observer = new MutationObserver(() => {
    refreshDetections();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const debouncedObserver = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refreshDetections();
      notifyFormsDetected();
    }, 500);
  });

  debouncedObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function init(): void {
  try {
    initializeOverlayCallback();
    refreshDetections();
    notifyFormsDetected();

    document.addEventListener('focusin', handleFieldFocus);
    document.addEventListener('focusout', handleFieldBlur);
    document.addEventListener('keydown', handleKeyboardShortcut);
    chrome.runtime.onMessage.addListener(handleMessage);

    initMutationObserver();
  } catch (err) {
    logError('تهيئة المحتوى', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
