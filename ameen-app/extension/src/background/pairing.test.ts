const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockStorageRemove = vi.fn();

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: mockStorageGet,
        set: mockStorageSet,
        remove: mockStorageRemove,
      },
    },
  });
  mockStorageGet.mockReset();
  mockStorageSet.mockReset();
  mockStorageRemove.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

vi.mock('../../../shared-crypto/src/cert-fingerprint', () => ({
  computeCertFingerprint: vi.fn().mockResolvedValue('A1B2C3D4E5F6'),
  formatFingerprint: vi.fn((fp: string) => {
    if (fp.length !== 12) return fp;
    const parts: string[] = [];
    for (let i = 0; i < 12; i += 2) {
      parts.push(fp.substring(i, i + 2));
    }
    return parts.join(' ');
  }),
}));

describe('verifyFingerprint', () => {
  it('returns true when fingerprints match', async () => {
    const { verifyFingerprint } = await import('./pairing');
    const result = await verifyFingerprint('ABC', 'ABC');
    expect(result).toBe(true);
  });

  it('returns false when fingerprints differ', async () => {
    const { verifyFingerprint } = await import('./pairing');
    const result = await verifyFingerprint('ABC', 'DEF');
    expect(result).toBe(false);
  });

  it('returns false for empty vs non-empty', async () => {
    const { verifyFingerprint } = await import('./pairing');
    const result = await verifyFingerprint('', 'ABC');
    expect(result).toBe(false);
  });
});

describe('savePairingState', () => {
  it('stores paired flag as true', async () => {
    const { savePairingState } = await import('./pairing');
    mockStorageSet.mockResolvedValue(undefined);
    await savePairingState(true);
    expect(mockStorageSet).toHaveBeenCalledWith({
      isExtensionPaired: true,
    });
  });

  it('stores paired flag as false', async () => {
    const { savePairingState } = await import('./pairing');
    mockStorageSet.mockResolvedValue(undefined);
    await savePairingState(false);
    expect(mockStorageSet).toHaveBeenCalledWith({
      isExtensionPaired: false,
    });
  });
});

describe('isAlreadyPaired', () => {
  it('returns true when stored value is true', async () => {
    const { isAlreadyPaired } = await import('./pairing');
    mockStorageGet.mockResolvedValue({ isExtensionPaired: true });
    const result = await isAlreadyPaired();
    expect(result).toBe(true);
  });

  it('returns false when stored value is false', async () => {
    const { isAlreadyPaired } = await import('./pairing');
    mockStorageGet.mockResolvedValue({ isExtensionPaired: false });
    const result = await isAlreadyPaired();
    expect(result).toBe(false);
  });

  it('returns false when key is missing', async () => {
    const { isAlreadyPaired } = await import('./pairing');
    mockStorageGet.mockResolvedValue({});
    const result = await isAlreadyPaired();
    expect(result).toBe(false);
  });
});

describe('unpair', () => {
  it('removes the pairing key from storage', async () => {
    const { unpair } = await import('./pairing');
    mockStorageRemove.mockResolvedValue(undefined);
    await unpair();
    expect(mockStorageRemove).toHaveBeenCalledWith('isExtensionPaired');
  });
});

describe('computeCertFingerprint', () => {
  it('is exported from the module', async () => {
    const mod = await import('./pairing');
    expect(mod.computeCertFingerprint).toBeDefined();
    expect(typeof mod.computeCertFingerprint).toBe('function');
  });
});

describe('formatFingerprint', () => {
  it('formats 12-char hex into groups of 2', async () => {
    const { formatFingerprint } = await import('./pairing');
    const result = formatFingerprint('A1B2C3D4E5F6');
    expect(result).toBe('A1 B2 C3 D4 E5 F6');
  });

  it('returns input unchanged when not 12 chars', async () => {
    const { formatFingerprint } = await import('./pairing');
    const result = formatFingerprint('A1B2');
    expect(result).toBe('A1B2');
  });
});

describe('exports', () => {
  it('has all required exported functions', async () => {
    const mod = await import('./pairing');
    expect(mod.verifyFingerprint).toBeDefined();
    expect(mod.savePairingState).toBeDefined();
    expect(mod.isAlreadyPaired).toBeDefined();
    expect(mod.unpair).toBeDefined();
    expect(mod.computeCertFingerprint).toBeDefined();
    expect(mod.formatFingerprint).toBeDefined();
  });
});
