import { describe, it, expect } from 'vitest';
import { readKdbx } from '../src/kdbx-reader';

function makeHeader(sig1: number, sig2: number, version: number): Uint8Array {
  const buf = new Uint8Array(12);
  const v = new DataView(buf.buffer);
  v.setUint32(0, sig1, true);
  v.setUint32(4, sig2, true);
  v.setUint32(8, version, true);
  return buf;
}

const VALID_SIG1 = 0x9AA2D903;
const VALID_SIG2 = 0xB54BFB67;
const VALID_VERSION = 0x00030001;

describe('kdbx-reader', () => {
  describe('header magic check', () => {
    it('rejects file smaller than 12 bytes', async () => {
      await expect(readKdbx(new Uint8Array(5), 'password')).rejects.toThrow(
        'KDBX file too small'
      );
    });

    it('rejects invalid signature 1', async () => {
      const data = makeHeader(0x00000000, VALID_SIG2, VALID_VERSION);
      await expect(readKdbx(data, 'password')).rejects.toThrow(
        'Not a valid KDBX file'
      );
    });

    it('rejects invalid signature 2', async () => {
      const data = makeHeader(VALID_SIG1, 0x00000000, VALID_VERSION);
      await expect(readKdbx(data, 'password')).rejects.toThrow(
        'Not a valid KDBX file'
      );
    });

    it('rejects unsupported KDBX version', async () => {
      const data = makeHeader(VALID_SIG1, VALID_SIG2, 0x00040000);
      await expect(readKdbx(data, 'password')).rejects.toThrow(
        'Unsupported KDBX version'
      );
    });
  });

  describe('error handling for invalid data', () => {
    it('rejects truncated header (no END marker)', async () => {
      const data = makeHeader(VALID_SIG1, VALID_SIG2, VALID_VERSION);
      await expect(readKdbx(data, 'password')).rejects.toThrow(
        'Unexpected end of KDBX header'
      );
    });

    it('rejects valid signature but empty remaining', async () => {
      const header = makeHeader(VALID_SIG1, VALID_SIG2, VALID_VERSION);
      const endField = new Uint8Array([0x00, 0x00, 0x00]);
      const data = new Uint8Array(header.length + endField.length);
      data.set(header);
      data.set(endField, header.length);
      await expect(readKdbx(data, 'password')).rejects.toThrow(
        'KDBX header missing required fields'
      );
    });
  });
});
