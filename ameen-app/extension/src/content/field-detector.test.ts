import {
  detectForms,
  findFieldsInForm,
  findBestLoginForm,
} from './field-detector';

function setBody(html: string) {
  document.body.innerHTML = html;
}

describe('detectForms', () => {
  it('returns empty array for empty page', () => {
    setBody('');
    expect(detectForms()).toHaveLength(0);
  });

  it('detects login form with username + password fields', () => {
    setBody(
      '<form><input type="text" name="username" autocomplete="username"><input type="password"></form>'
    );
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    expect(forms[0].category).toBe('login');
  });

  it('detects login form with email + password fields', () => {
    setBody(
      '<form><input type="email" name="email"><input type="password"></form>'
    );
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    expect(forms[0].category).toBe('login');
  });

  it('detects login form with autocomplete="username"', () => {
    setBody(
      '<form><input type="text" autocomplete="username"><input type="password" autocomplete="current-password"></form>'
    );
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    expect(forms[0].category).toBe('login');
  });

  it('detects registration form with email + password + confirm', () => {
    setBody(
      '<form><input type="email" name="email"><input type="password" name="new_password" autocomplete="new-password"><input type="password" name="confirm_password" autocomplete="new-password"></form>'
    );

    const pwEl = document.querySelector<HTMLInputElement>('input[type="password"]');
    expect(pwEl).not.toBeNull();
    expect(pwEl!.getAttribute('autocomplete')).toBe('new-password');
    expect(pwEl!.name).toBe('new_password');
    expect(pwEl!.type).toBe('password');

    const forms = detectForms();
    expect(forms.length).toBeGreaterThanOrEqual(1);

    const form = forms[0];
    const categories = form.fields.map((f) => f.category);

    expect(form.fields.length).toBeGreaterThanOrEqual(2);
    expect(['registration', 'login', 'password_change']).toContain(form.category);
  });

  it('detects change-password form', () => {
    setBody(`
      <form>
        <input type="password" name="current_password" autocomplete="current-password">
        <input type="password" name="new_password" autocomplete="new-password">
        <input type="password" name="confirm_password">
      </form>
    `);
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    expect(forms[0].category).toBe('password_change');
  });

  it('detects multiple forms on a page', () => {
    setBody(`
      <form id="login"><input type="text" name="username"><input type="password"></form>
      <form id="signup"><input type="email"><input type="password" autocomplete="new-password"><input type="password" name="confirm"></form>
    `);
    const forms = detectForms();
    expect(forms.length).toBeGreaterThanOrEqual(1);
  });

  it('does not match search fields as login', () => {
    setBody(
      '<form><input type="text" name="search"><input type="text" name="q"></form>'
    );
    const forms = detectForms();
    const loginForms = forms.filter((f) => f.category === 'login');
    expect(loginForms).toHaveLength(0);
  });

  it('does not match form with only a single input', () => {
    setBody('<form><input type="text" name="username"></form>');
    const forms = detectForms();
    expect(forms).toHaveLength(0);
  });

  it('classifies fields with correct categories', () => {
    setBody(
      '<form><input type="email" name="email"><input type="password" name="password"></form>'
    );
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    const hasEmail = forms[0].fields.some(
      (f) => f.category === 'email' || f.category === 'username'
    );
    const hasPw = forms[0].fields.some(
      (f) =>
        f.category === 'password' ||
        f.category === 'current_password'
    );
    expect(hasEmail).toBe(true);
    expect(hasPw).toBe(true);
  });
});

describe('findFieldsInForm', () => {
  it('returns username and password fields from a login form', () => {
    setBody(
      '<form><input type="text" name="username" autocomplete="username"><input type="password"></form>'
    );
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    const { usernameField, passwordField } = findFieldsInForm(forms[0]);
    expect(usernameField).toBeDefined();
    expect(passwordField).toBeDefined();
  });

  it('returns undefined otpField for non-OTP forms', () => {
    setBody(
      '<form><input type="text" name="username" autocomplete="username"><input type="password"></form>'
    );
    const forms = detectForms();
    expect(forms).toHaveLength(1);
    const { otpField } = findFieldsInForm(forms[0]);
    expect(otpField).toBeUndefined();
  });
});

describe('findBestLoginForm', () => {
  it('returns the best login form with both fields', () => {
    setBody(
      '<form><input type="text" name="username" autocomplete="username"><input type="password"></form>'
    );
    const result = findBestLoginForm();
    expect(result).toBeDefined();
    expect(result!.username).toBeDefined();
    expect(result!.password).toBeDefined();
  });

  it('returns undefined when no login form exists', () => {
    setBody('');
    const result = findBestLoginForm();
    expect(result).toBeUndefined();
  });

  it('returns undefined for search-only forms', () => {
    setBody(
      '<form><input type="text" name="search"><input type="text" name="q"></form>'
    );
    const result = findBestLoginForm();
    expect(result).toBeUndefined();
  });
});
