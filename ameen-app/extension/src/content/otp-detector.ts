export interface OtpField {
  element: HTMLInputElement;
  autoSubmit: boolean;
}

const OTP_PATTERNS: Array<{ attr: string; regex: RegExp }> = [
  { attr: 'autocomplete', regex: /one-time-code/i },
  { attr: 'name', regex: /(otp|token|code|2fa|mfa|twofactor|verification|pin|totp|two.factor|auth.?code)/i },
  { attr: 'id', regex: /(otp|token|code|2fa|mfa|twofactor|verification|pin|totp|two.factor|auth.?code)/i },
  { attr: 'placeholder', regex: /(رمز|تأكيد|تحقق|otp|token|code|2fa|000000|••••••|●●●●●●)/i },
  { attr: 'aria-label', regex: /(otp|token|code|2fa|mfa|twofactor|verification|one.time)/i },
];

function matchesOtpPatterns(element: HTMLInputElement): boolean {
  for (const { attr, regex } of OTP_PATTERNS) {
    let value: string;
    try {
      if (attr === 'autocomplete') {
        value = element.getAttribute('autocomplete') ?? '';
      } else if (attr === 'placeholder') {
        value = element.getAttribute('placeholder') ?? '';
      } else if (attr === 'aria-label') {
        value = element.getAttribute('aria-label') ?? '';
      } else {
        value = (element as unknown as Record<string, unknown>)[attr] as string ?? '';
      }
    } catch {
      value = '';
    }
    if (value && regex.test(value)) {
      return true;
    }
  }
  return false;
}

function isOtpLengthField(element: HTMLInputElement): boolean {
  const maxLength = element.getAttribute('maxlength');
  if (maxLength) {
    const len = parseInt(maxLength, 10);
    if (len >= 4 && len <= 8) return true;
  }
  const type = (element.getAttribute('type') ?? 'text').toLowerCase();
  const inputMode = (element.getAttribute('inputmode') ?? '').toLowerCase();
  const pattern = (element.getAttribute('pattern') ?? '').toLowerCase();

  if (type === 'text' && pattern === '[0-9]*') return true;
  if (type === 'text' && inputMode === 'numeric') return true;
  return false;
}

function formAutoSubmitsOnOtp(element: HTMLInputElement): boolean {
  const form = element.closest('form');
  if (!form) return false;
  const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
  const hasSubmit = submitButtons.length > 0;
  const hasAutoSubmitAttr = element.getAttribute('data-autosubmit') === 'true';
  return hasSubmit || hasAutoSubmitAttr;
}

export function detectOtpFields(): OtpField[] {
  const results: OtpField[] = [];

  try {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
    for (const input of inputs) {
      const type = (input.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'password') continue;
      if (type === 'hidden') continue;

      if (matchesOtpPatterns(input)) {
        results.push({
          element: input,
          autoSubmit: formAutoSubmitsOnOtp(input),
        });
        continue;
      }

      if (isOtpLengthField(input)) {
        const maxLen = parseInt(input.getAttribute('maxlength') ?? '0', 10);
        if (maxLen >= 4 && maxLen <= 8) {
          results.push({
            element: input,
            autoSubmit: formAutoSubmitsOnOtp(input),
          });
        }
      }
    }
  } catch {
    /* CSP may block */
  }

  return results;
}
