export type FieldCategory = 'login' | 'registration' | 'password_change' | 'otp' | 'unknown';

export interface DetectedField {
  element: HTMLInputElement;
  category: 'username' | 'email' | 'password' | 'current_password' | 'new_password' | 'confirm_password' | 'otp';
  confidence: number;
}

export interface DetectedForm {
  category: FieldCategory;
  container: Element;
  fields: DetectedField[];
}

const PASSWORD_INPUT_SELECTOR = 'input[type="password"], input:not([type])[name*="pass" i], input:not([type])[name*="pwd" i], input[autocomplete*="password"]';
const INPUT_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])';

const USERNAME_PATTERNS = [
  { attr: 'autocomplete', regex: /username/i, score: 40 },
  { attr: 'name', regex: /^(user(name)?|login|account|uname|uid)$/i, score: 30 },
  { attr: 'id', regex: /^(user(name)?|login|account|uname|uid)$/i, score: 20 },
  { attr: 'placeholder', regex: /(اسم المستخدم|اسم الدخول|البريد|username|user|login|account)/i, score: 10 },
  { attr: 'aria-label', regex: /(username|user|login|account)/i, score: 10 },
];

const EMAIL_PATTERNS = [
  { attr: 'autocomplete', regex: /email/i, score: 40 },
  { attr: 'name', regex: /(email|e-mail|mail)/i, score: 30 },
  { attr: 'id', regex: /(email|e-mail|mail)/i, score: 20 },
  { attr: 'placeholder', regex: /(البريد|الإيميل|email|e-mail)/i, score: 10 },
  { attr: 'aria-label', regex: /(email|e-mail|mail)/i, score: 10 },
];

const PASSWORD_PATTERNS = [
  { attr: 'autocomplete', regex: /(current-password|password)/i, score: 40 },
  { attr: 'name', regex: /(pass(word)?|pwd)$/i, score: 30 },
  { attr: 'id', regex: /(pass(word)?|pwd)$/i, score: 20 },
  { attr: 'placeholder', regex: /(كلمة المرور|السر|password|pwd)/i, score: 10 },
  { attr: 'aria-label', regex: /(password|pwd)/i, score: 10 },
];

const CONFIRM_PASSWORD_PATTERNS = [
  { attr: 'autocomplete', regex: /new-password/i, score: 40 },
  { attr: 'name', regex: /(confirm|retype|verify|new.?pass(word)?|new.?pwd)/i, score: 30 },
  { attr: 'id', regex: /(confirm|retype|verify|new.?pass(word)?|new.?pwd)/i, score: 20 },
  { attr: 'placeholder', regex: /(تأكيد|جديد|confirm|retype|new.?pass)/i, score: 10 },
  { attr: 'aria-label', regex: /(confirm|new.?password|verify)/i, score: 10 },
];

const CURRENT_PASSWORD_PATTERNS = [
  { attr: 'autocomplete', regex: /current-password/i, score: 40 },
  { attr: 'name', regex: /(current|old|existing|prev).?(pass(word)?|pwd)/i, score: 30 },
  { attr: 'id', regex: /(current|old|existing|prev).?(pass(word)?|pwd)/i, score: 20 },
  { attr: 'placeholder', regex: /(الحالي|القديم|current|old|existing)/i, score: 10 },
  { attr: 'aria-label', regex: /(current|old|existing).?(password|pwd)/i, score: 10 },
];

function computeConfidence(
  element: HTMLInputElement,
  patterns: Array<{ attr: string; regex: RegExp; score: number }>
): number {
  let confidence = 0;
  for (const { attr, regex, score } of patterns) {
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
      confidence += score;
    }
  }
  return Math.min(confidence, 100);
}

function classifyField(element: HTMLInputElement): DetectedField {
  const tag = element.tagName.toLowerCase();
  if (tag !== 'input') {
    return { element, category: 'username', confidence: 0 };
  }

  const type = (element.getAttribute('type') ?? 'text').toLowerCase();

  if (type === 'email') {
    return { element, category: 'email', confidence: 80 };
  }

  if (type === 'password') {
    const currentConf = computeConfidence(element, CURRENT_PASSWORD_PATTERNS);
    const confirmConf = computeConfidence(element, CONFIRM_PASSWORD_PATTERNS);
    const baseConf = computeConfidence(element, PASSWORD_PATTERNS);

    if (currentConf > confirmConf && currentConf > baseConf) {
      return { element, category: 'current_password', confidence: currentConf };
    }
    if (confirmConf > baseConf) {
      return { element, category: 'new_password', confidence: confirmConf };
    }
    return { element, category: 'password', confidence: baseConf };
  }

  const emailScore = computeConfidence(element, EMAIL_PATTERNS);
  if (emailScore > 30) {
    return { element, category: 'email', confidence: emailScore };
  }

  const usernameScore = computeConfidence(element, USERNAME_PATTERNS);
  if (usernameScore > 30) {
    return { element, category: 'username', confidence: usernameScore };
  }

  return { element, category: 'username', confidence: 0 };
}

function classifyNewPasswordField(element: HTMLInputElement): DetectedField {
  const confirmConf = computeConfidence(element, CONFIRM_PASSWORD_PATTERNS);
  const currentConf = computeConfidence(element, CURRENT_PASSWORD_PATTERNS);
  const baseConf = computeConfidence(element, PASSWORD_PATTERNS);

  if (confirmConf > 30 || confirmConf > currentConf) {
    return { element, category: 'confirm_password', confidence: confirmConf };
  }
  if (currentConf > 30) {
    return { element, category: 'current_password', confidence: currentConf };
  }
  return { element, category: 'new_password', confidence: baseConf };
}

function findContainer(field: Element): Element {
  let current = field.parentElement;
  for (let i = 0; i < 5 && current; i++) {
    const tag = current.tagName.toLowerCase();
    if (tag === 'form') return current;
    const role = current.getAttribute('role');
    if (role === 'form') return current;
    if (current.closest('form') === current) return current;
    current = current.parentElement;
  }
  const form = field.closest('form');
  return form ?? field.ownerDocument.body;
}

function resolveCategory(fields: DetectedField[]): FieldCategory {
  const categories = fields.map(f => f.category);

  const hasPassword = categories.some(c => c === 'password' || c === 'current_password');
  const hasCurrentPassword = categories.some(c => c === 'current_password');
  const hasNewPassword = categories.includes('new_password');
  const hasConfirmPassword = categories.includes('confirm_password');
  const hasUsername = categories.some(c => c === 'username' || c === 'email');

  const passwordCount = categories.filter(c =>
    c === 'password' || c === 'current_password' || c === 'new_password' || c === 'confirm_password'
  ).length;

  if (passwordCount >= 3 || (hasCurrentPassword && hasNewPassword)) {
    return 'password_change';
  }
  if ((hasNewPassword || hasConfirmPassword) && hasUsername) {
    return 'registration';
  }
  if (hasPassword && hasUsername) {
    return 'login';
  }
  if (passwordCount === 1 && hasUsername) {
    return 'login';
  }
  return 'unknown';
}

export function detectForms(): DetectedForm[] {
  const forms: DetectedForm[] = [];
  const processed = new Set<Element>();

  try {
    const formElements = Array.from(document.querySelectorAll<HTMLFormElement>('form'));
    for (const formEl of formElements) {
      const inputs = Array.from(formEl.querySelectorAll<HTMLInputElement>(INPUT_SELECTOR));
      if (inputs.length < 2) continue;

      const fields = inputs.map(classifyField).filter(f => f.confidence > 0 || f.element.type === 'email' || f.element.type === 'password');
      if (fields.length < 2) continue;

      forms.push({
        container: formEl,
        category: resolveCategory(fields),
        fields,
      });
      processed.add(formEl);
    }
  } catch {
    /* CSP may block */
  }

  try {
    const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>(PASSWORD_INPUT_SELECTOR));
    for (const pwInput of allInputs) {
      const container = findContainer(pwInput);
      if (processed.has(container)) continue;

      const scope = container.tagName.toLowerCase() === 'form' ? container : container;
      const inputs = Array.from(scope.querySelectorAll<HTMLInputElement>(INPUT_SELECTOR));
      if (inputs.length < 2) continue;

      const fields = inputs.map(classifyField).filter(f => f.confidence > 0 || f.element.type === 'email' || f.element.type === 'password');
      if (fields.length < 2) continue;

      forms.push({
        container,
        category: resolveCategory(fields),
        fields,
      });
      processed.add(container);
    }
  } catch {
    /* CSP may block */
  }

  return forms;
}

export function findFieldsInForm(form: DetectedForm): {
  usernameField: DetectedField | undefined;
  passwordField: DetectedField | undefined;
  otpField: DetectedField | undefined;
} {
  const usernameField = form.fields.find(f => f.category === 'username' || f.category === 'email');
  const passwordField = form.fields.find(f =>
    f.category === 'password' || f.category === 'current_password'
  );
  const otpField = form.fields.find(f => f.category === 'otp');
  return { usernameField, passwordField, otpField };
}

export function findBestLoginForm(): { form: DetectedForm; username: DetectedField; password: DetectedField } | undefined {
  const forms = detectForms();
  const loginForms = forms.filter(f => f.category === 'login');

  for (const form of loginForms) {
    const username = form.fields.find(f => f.category === 'username' || f.category === 'email');
    const password = form.fields.find(f => f.category === 'password' || f.category === 'current_password');
    if (username && password) {
      return { form, username, password };
    }
  }
  return undefined;
}
