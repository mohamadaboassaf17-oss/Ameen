import { fillField, autofillLogin, autofillOTP } from './autofill';
import type { DetectedField } from './field-detector';

describe('fillField', () => {
  it('fills a text input with a value', () => {
    document.body.innerHTML =
      '<form><input type="text" name="username"></form>';
    const input = document.querySelector('input')!;
    const field: DetectedField = {
      element: input,
      category: 'username',
      confidence: 80,
    };

    fillField(field, 'testuser');

    expect(input.value).toBe('testuser');
  });

  it('fills a password input with a value', () => {
    document.body.innerHTML = '<form><input type="password"></form>';
    const input = document.querySelector('input')!;
    const field: DetectedField = {
      element: input,
      category: 'password',
      confidence: 80,
    };

    fillField(field, 'secret123');

    expect(input.value).toBe('secret123');
  });

  it('does not throw when supplied an invalid field', () => {
    const orphan = document.createElement('input');
    orphan.type = 'text';

    const field: DetectedField = {
      element: orphan,
      category: 'username',
      confidence: 0,
    };

    expect(() => fillField(field, 'value')).not.toThrow();
  });
});

describe('autofillLogin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills both username and password fields', () => {
    document.body.innerHTML =
      '<form><input type="text" name="username"><input type="password"></form>';
    const [userInput, pwInput] = Array.from(
      document.querySelectorAll('input')
    );
    const usernameField: DetectedField = {
      element: userInput,
      category: 'username',
      confidence: 80,
    };
    const passwordField: DetectedField = {
      element: pwInput as HTMLInputElement,
      category: 'password',
      confidence: 80,
    };

    autofillLogin(usernameField, passwordField, 'alice', 'p@ss');
    vi.advanceTimersByTime(100);

    expect(userInput.value).toBe('alice');
    expect(pwInput.value).toBe('p@ss');
  });

  it('fills username immediately but password after timeout', () => {
    document.body.innerHTML =
      '<form><input type="text" name="username"><input type="password"></form>';
    const [userInput, pwInput] = Array.from(
      document.querySelectorAll('input')
    );
    const usernameField: DetectedField = {
      element: userInput,
      category: 'username',
      confidence: 80,
    };
    const passwordField: DetectedField = {
      element: pwInput as HTMLInputElement,
      category: 'password',
      confidence: 80,
    };

    autofillLogin(usernameField, passwordField, 'bob', 'secret');

    expect(userInput.value).toBe('bob');
    expect(pwInput.value).toBe('');

    vi.advanceTimersByTime(60);

    expect(pwInput.value).toBe('secret');
  });

  it('does not throw when elements are missing', () => {
    document.body.innerHTML = '';
    // Create an orphan input for the username
    const orphanInput = document.createElement('input');
    orphanInput.type = 'text';
    const usernameField: DetectedField = {
      element: orphanInput,
      category: 'username',
      confidence: 80,
    };
    const passwordField: DetectedField = {
      element: orphanInput,
      category: 'password',
      confidence: 80,
    };

    expect(() => {
      autofillLogin(usernameField, passwordField, 'x', 'y');
    }).not.toThrow();
  });
});

describe('autofillOTP', () => {
  it('fills an OTP field with the code', () => {
    document.body.innerHTML =
      '<input type="text" name="otp" maxlength="6">';
    const input = document.querySelector('input')!;
    const field: DetectedField = {
      element: input,
      category: 'otp',
      confidence: 100,
    };

    autofillOTP(field, '123456');

    expect(input.value).toBe('123456');
  });
});
