import { describe, it, expect } from 'vitest';
import { detectCsvFormat, parseCsvToVaultItems, vaultItemsToAmeenCsv } from '../src/csv-parser';

describe('csv-parser', () => {
  describe('detectCsvFormat', () => {
    it('identifies Chrome headers', () => {
      const result = detectCsvFormat('name,url,username,password');
      expect(result.format).toBe('chrome');
    });

    it('identifies Firefox headers', () => {
      const result = detectCsvFormat(
        'url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged'
      );
      expect(result.format).toBe('firefox');
    });

    it('identifies Edge headers (5 columns)', () => {
      const result = detectCsvFormat('name,url,username,password,note');
      expect(result.format).toBe('edge');
    });

    it('identifies Safari headers', () => {
      const result = detectCsvFormat('Title,URL,Username,Password,OTPAuth');
      expect(result.format).toBe('safari');
    });

    it('identifies Ameen headers', () => {
      const result = detectCsvFormat(
        'id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpSecret'
      );
      expect(result.format).toBe('ameen');
    });

    it('returns unknown for unrecognized headers', () => {
      const result = detectCsvFormat('col1,col2,col3');
      expect(result.format).toBe('unknown');
    });
  });

  describe('parseCsvToVaultItems', () => {
    it('parses Chrome format', () => {
      const csv = `name,url,username,password
Google,https://google.com,user@gmail.com,secret123`;
      const items = parseCsvToVaultItems(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Google');
      expect(items[0].data.username).toBe('user@gmail.com');
      expect(items[0].data.password).toBe('secret123');
      expect(items[0].data.url).toBe('https://google.com');
    });

    it('parses Firefox format', () => {
      const csv = `url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged
https://example.com,user@example.com,pass123,,,guid123,1640000000,1640000000`;
      const items = parseCsvToVaultItems(csv);
      expect(items.length).toBe(1);
      expect(items[0].data.username).toBe('user@example.com');
      expect(items[0].data.password).toBe('pass123');
    });

    it('parses Edge format', () => {
      const csv = `name,url,username,password,note
Edge Login,https://edge.com,edgeuser,edgepass,some note`;
      const items = parseCsvToVaultItems(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Edge Login');
      expect(items[0].data.notes).toBe('some note');
    });

    it('parses Safari format', () => {
      const csv = `Title,URL,Username,Password,OTPAuth
Safari Login,https://safari.com,safariuser,safaripass,otpauth://totp/test`;
      const items = parseCsvToVaultItems(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Safari Login');
      expect(items[0].data.otpSecret).toBe('otpauth://totp/test');
    });

    it('parses Ameen format', () => {
      const csv = `id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpSecret
abc-123,password,My Login,myuser,mypass,https://test.com,,,,,,,some notes,`;
      const items = parseCsvToVaultItems(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('My Login');
      expect(items[0].data.username).toBe('myuser');
    });

    it('handles quoted fields with commas inside', () => {
      const csv = `name,url,username,password
"My, Site","https://example.com?a=1,b=2",user,pass`;
      const items = parseCsvToVaultItems(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('My, Site');
      expect(items[0].data.url).toBe('https://example.com?a=1,b=2');
    });

    it('returns empty array for unknown format', () => {
      const csv = `col1,col2
val1,val2`;
      const items = parseCsvToVaultItems(csv);
      expect(items).toEqual([]);
    });

    it('returns empty array for empty CSV', () => {
      const items = parseCsvToVaultItems('');
      expect(items).toEqual([]);
    });

    it('returns empty array for header-only CSV', () => {
      const items = parseCsvToVaultItems('name,url,username,password');
      expect(items).toEqual([]);
    });
  });

  describe('vaultItemsToAmeenCsv', () => {
    it('round-trip with Ameen format', () => {
      const csv = `id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpSecret
abc-123,password,My Login,myuser,mypass,https://test.com,,,,,,,some notes,`;
      const items = parseCsvToVaultItems(csv);
      const exported = vaultItemsToAmeenCsv(items);

      const reimported = parseCsvToVaultItems(exported);
      expect(reimported.length).toBe(items.length);
      expect(reimported[0].data.username).toBe('myuser');
      expect(reimported[0].data.password).toBe('mypass');
    });

    it('exports with all header columns', () => {
      const exported = vaultItemsToAmeenCsv([]);
      const expectedHeaders =
        'id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpSecret';
      expect(exported).toBe(expectedHeaders);
    });

    it('escapes fields containing commas', () => {
      const items = [
        {
          id: 'test-1',
          type: 'password' as const,
          title: 'Title, with comma',
          revision: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { username: 'user', password: 'pass', url: '', notes: '', cardholder: '', number: '', expiry: '', cvv: '', content: '', otpSecret: '' },
        },
      ];
      const exported = vaultItemsToAmeenCsv(items);
      expect(exported).toContain('"Title, with comma"');
    });
  });
});
