import type {
  ExtensionRequest,
  ExtensionResponse,
  DesktopVaultItem,
  GetItemPayload,
  SearchPayload,
  OtpPayload,
  PasswordPayload,
} from './messages';

const validRequestTypes = [
  'pair',
  'get_vault',
  'get_item',
  'search_items',
  'generate_otp',
  'generate_password',
  'export_vault',
  'import_vault',
  'ping',
] as const;

const validResponseTypes = [
  'paired',
  'vault',
  'item',
  'search_results',
  'otp_code',
  'password',
  'pong',
  'error',
] as const;

describe('ExtensionRequest', () => {
  it('accepts all valid request types', () => {
    for (const type of validRequestTypes) {
      const req: ExtensionRequest = { id: '1', type };
      expect(req.id).toBe('1');
      expect(req.type).toBe(type);
    }
  });

  it('includes export_vault in type union', () => {
    const req: ExtensionRequest = { id: 'x', type: 'export_vault' };
    expect(req.type).toBe('export_vault');
  });

  it('includes import_vault in type union', () => {
    const req: ExtensionRequest = { id: 'x', type: 'import_vault' };
    expect(req.type).toBe('import_vault');
  });

  it('includes ping in type union', () => {
    const req: ExtensionRequest = { id: 'x', type: 'ping' };
    expect(req.type).toBe('ping');
  });

  it('has optional payload', () => {
    const req: ExtensionRequest = { id: '1', type: 'ping', payload: '{}' };
    expect(req.payload).toBe('{}');
  });
});

describe('ExtensionResponse', () => {
  it('accepts all valid response types', () => {
    for (const type of validResponseTypes) {
      const res: ExtensionResponse = { id: '1', type };
      expect(res.id).toBe('1');
      expect(res.type).toBe(type);
    }
  });

  it('includes error type', () => {
    const res: ExtensionResponse = { id: 'x', type: 'error', error: 'fail' };
    expect(res.type).toBe('error');
    expect(res.error).toBe('fail');
  });

  it('has optional data and error fields', () => {
    const res: ExtensionResponse = {
      id: '1',
      type: 'vault',
      data: '[]',
      error: undefined,
    };
    expect(res.data).toBe('[]');
  });
});

describe('DesktopVaultItem', () => {
  it('has all required fields', () => {
    const item: DesktopVaultItem = {
      id: 'abc-123',
      type: 'login',
      title: 'GitHub',
      username: 'octocat',
      password: '',
      url: 'https://github.com',
      content: '',
      cardholder: '',
      number: '',
      expiry: '',
      cvv: '',
      notes: '',
      otpSecret: '',
      updatedAt: '',
      isConflict: false,
    };
    expect(item.id).toBe('abc-123');
    expect(item.type).toBe('login');
    expect(item.title).toBe('GitHub');
  });
});

describe('Payload types', () => {
  it('GetItemPayload has itemId', () => {
    const p: GetItemPayload = { itemId: '123' };
    expect(p.itemId).toBe('123');
  });

  it('SearchPayload has query', () => {
    const p: SearchPayload = { query: 'github' };
    expect(p.query).toBe('github');
  });

  it('OtpPayload has secret', () => {
    const p: OtpPayload = { secret: 'JBSWY3DPEHPK3PXP' };
    expect(p.secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('PasswordPayload has all options', () => {
    const p: PasswordPayload = {
      length: 16,
      useSymbols: true,
      useDigits: true,
      useUppercase: true,
      useLowercase: true,
    };
    expect(p.length).toBe(16);
    expect(p.useSymbols).toBe(true);
  });
});
