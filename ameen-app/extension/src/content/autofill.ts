import { DetectedField } from './field-detector';

function setNativeValue(element: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, 'value'
  );
  const nativeSetter = descriptor?.set;
  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchFillEvents(element: HTMLInputElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('compositionstart', { bubbles: true }));
  element.dispatchEvent(new Event('compositionupdate', { bubbles: true }));
  element.dispatchEvent(new Event('compositionend', { bubbles: true }));

  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

export function fillField(field: DetectedField, value: string): void {
  const element = field.element;
  try {
    element.focus();
    setNativeValue(element, value);
    dispatchFillEvents(element);
  } catch (err) {
    console.error('[Ameen] فشل تعبئة الحقل:', err);
  }
}

export function autofillLogin(
  usernameField: DetectedField,
  passwordField: DetectedField,
  usernameValue: string,
  passwordValue: string
): void {
  try {
    fillField(usernameField, usernameValue);
    setTimeout(() => {
      fillField(passwordField, passwordValue);
    }, 50);
  } catch (err) {
    console.error('[Ameen] فشل التعبئة التلقائية:', err);
  }
}

export function autofillOTP(
  otpField: DetectedField,
  code: string
): void {
  fillField(otpField, code);
}
