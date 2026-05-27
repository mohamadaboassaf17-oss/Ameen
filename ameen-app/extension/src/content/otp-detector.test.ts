import { detectOtpFields } from './otp-detector';

function setBody(html: string) {
  document.body.innerHTML = html;
}

describe('detectOtpFields', () => {
  it('detects OTP field by name attribute', () => {
    setBody('<input type="text" name="otp">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects OTP field by autocomplete="one-time-code"', () => {
    setBody('<input type="text" autocomplete="one-time-code">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects OTP field by name="2fa"', () => {
    setBody('<input type="text" name="2fa">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects OTP field by name="verification"', () => {
    setBody('<input type="text" name="verification">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects OTP field by name="token"', () => {
    setBody('<input type="text" name="token">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects 6-digit OTP field by maxlength', () => {
    setBody('<input type="text" maxlength="6">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects 8-digit OTP field by maxlength', () => {
    setBody('<input type="text" maxlength="8">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('does not detect maxlength=12 as OTP', () => {
    setBody('<input type="text" maxlength="12">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });

  it('does not detect maxlength=2 as OTP', () => {
    setBody('<input type="text" maxlength="2">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });

  it('does not detect regular text inputs as OTP', () => {
    setBody('<input type="text" name="username">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });

  it('does not detect password inputs as OTP', () => {
    setBody('<input type="password" name="otp">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });

  it('does not detect hidden inputs as OTP', () => {
    setBody('<input type="hidden" name="otp">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });

  it('does not detect submit buttons as OTP', () => {
    setBody('<input type="submit" name="otp">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });

  it('detects OTP field by pattern="[0-9]*" with maxlength', () => {
    setBody('<input type="text" pattern="[0-9]*" maxlength="6">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('detects OTP field by inputmode="numeric" with maxlength', () => {
    setBody('<input type="text" inputmode="numeric" maxlength="6">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
  });

  it('sets autoSubmit to true when form has submit button', () => {
    setBody(
      '<form><input type="text" name="otp"><button type="submit">Submit</button></form>'
    );
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
    expect(fields[0].autoSubmit).toBe(true);
  });

  it('sets autoSubmit to false when no submit button', () => {
    setBody('<input type="text" name="otp">');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(1);
    expect(fields[0].autoSubmit).toBe(false);
  });

  it('returns empty array for empty page', () => {
    setBody('');
    const fields = detectOtpFields();
    expect(fields).toHaveLength(0);
  });
});
