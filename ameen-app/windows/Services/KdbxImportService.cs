using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Ameen.Windows.Models;

namespace Ameen.Windows.Services;

public class KdbxImportResult
{
    public List<VaultItem> Items { get; set; } = new();
    public string DatabaseName { get; set; } = string.Empty;
    public int EntryCount { get; set; }
    public int GroupCount { get; set; }
}

public class KdbxImportService
{
    // KDBX signature constants
    private const uint KdbxSig1 = 0x9AA2D903;
    private const uint KdbxSig2 = 0xB54BFB67;
    private const uint KdbxVersion3_1 = 0x00030001;

    // Header field IDs
    private const byte HdrEnd = 0;
    private const byte HdrCipherId = 2;
    private const byte HdrCompression = 3;
    private const byte HdrMasterSeed = 4;
    private const byte HdrTransformSeed = 5;
    private const byte HdrTransformRounds = 6;
    private const byte HdrEncryptionIv = 7;
    private const byte HdrProtectedKey = 8;
    private const byte HdrStreamStart = 9;
    private const byte HdrInnerStreamId = 10;

    private static readonly byte[] CipherAes256 =
    {
        0x31, 0xC1, 0xF2, 0xE6, 0xBF, 0x71, 0x43, 0x50,
        0xBE, 0x58, 0x05, 0x21, 0x6A, 0xFC, 0x5A, 0xFF,
    };

    private const uint StreamSalsa20 = 2;

    /// <summary>
    /// Import entries from a KeePass KDBX3.1 database file.
    /// </summary>
    public async Task<KdbxImportResult> ImportAsync()
    {
        try
        {
            var result = await FilePicker.Default.PickAsync(new PickOptions
            {
                PickerTitle = "اختر ملف KeePass (.kdbx)",
                FileTypes = new FilePickerFileType(new Dictionary<DevicePlatform, IEnumerable<string>>
                {
                    { DevicePlatform.WinUI, new[] { ".kdbx" } },
                }),
            });

            if (result == null)
            {
                Debug.WriteLine("[KdbxImportService] File picker cancelled.");
                return new KdbxImportResult();
            }

            // Prompt for password (handled at UI level — here we accept bytes directly)
            // For now, the caller must provide password. We'll create a helper.
            Debug.WriteLine("[KdbxImportService] KDBX file selected — password must be provided by UI.");
            return new KdbxImportResult();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[KdbxImportService] Import failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Read KDBX3.1 file bytes with master password and extract vault items.
    /// </summary>
    public KdbxImportResult ReadKdbx(byte[] kdbxBytes, string password)
    {
        try
        {
            if (kdbxBytes.Length < 12)
                throw new InvalidOperationException("KDBX file is too small.");

            using var ms = new MemoryStream(kdbxBytes);
            using var reader = new BinaryReader(ms);

            uint sig1 = reader.ReadUInt32();
            uint sig2 = reader.ReadUInt32();
            uint version = reader.ReadUInt32();

            if (sig1 != KdbxSig1 || sig2 != KdbxSig2)
                throw new InvalidOperationException("Not a valid KDBX file.");

            if (version != KdbxVersion3_1)
                throw new InvalidOperationException($"Unsupported KDBX version: 0x{version:X8}. Only KDBX 3.1 is supported.");

            // Parse header
            var header = ParseHeader(reader);
            var encryptedData = ReadRemainingBytes(reader);

            // Derive key
            byte[] aesKey = DeriveKey(password, header.TransformSeed, header.TransformRounds, header.MasterSeed);

            // Decrypt
            byte[] decrypted = DecryptAesCbc(aesKey, header.EncryptionIv, encryptedData);

            // Verify stream start bytes
            if (header.StreamStartBytes != null && header.StreamStartBytes.Length > 0)
            {
                for (int i = 0; i < Math.Min(header.StreamStartBytes.Length, decrypted.Length); i++)
                {
                    if (decrypted[i] != header.StreamStartBytes[i])
                        throw new InvalidOperationException("Wrong password — stream start bytes mismatch.");
                }
            }

            // Decompress
            byte[] xmlBytes;
            if (header.Compression == 1)
            {
                xmlBytes = GzipDecompress(decrypted);
            }
            else
            {
                xmlBytes = decrypted;
            }

            string xmlText = Encoding.UTF8.GetString(xmlBytes);
            var entries = ParseXml(xmlText, header.ProtectedStreamKey);

            var result = new KdbxImportResult
            {
                Items = entries.Select((e, i) => new VaultItem
                {
                    Id = Guid.NewGuid().ToString("N")[..12],
                    Type = "password",
                    Title = !string.IsNullOrEmpty(e.title) ? e.title : (!string.IsNullOrEmpty(e.url) ? e.url : $"مستورد {i + 1}"),
                    Username = e.username,
                    Password = e.password,
                    Url = e.url,
                    Notes = e.notes,
                    UpdatedAt = DateTime.Now,
                }).ToList(),
                DatabaseName = ExtractDatabaseName(xmlText),
                EntryCount = entries.Count,
                GroupCount = CountGroups(xmlText),
            };

            Debug.WriteLine($"[KdbxImportService] Imported {result.EntryCount} entries from '{result.DatabaseName}'.");
            return result;
        }
        catch (CryptographicException)
        {
            throw new InvalidOperationException("فشل فك تشفير ملف KeePass — كلمة المرور غير صحيحة.");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[KdbxImportService] Read error: {ex.Message}");
            throw;
        }
    }

    // ============================================================
    // Header Parsing
    // ============================================================

    private class KdbxHeader
    {
        public byte[]? MasterSeed;
        public byte[]? TransformSeed;
        public ulong TransformRounds;
        public byte[]? EncryptionIv;
        public byte[]? ProtectedStreamKey;
        public byte[]? StreamStartBytes;
        public uint InnerStreamId;
        public uint Compression;
    }

    private static KdbxHeader ParseHeader(BinaryReader reader)
    {
        var header = new KdbxHeader();

        while (true)
        {
            byte fieldType = reader.ReadByte();
            ushort fieldSize = reader.ReadUInt16();

            byte[] fieldData;
            if (fieldSize > 0)
            {
                fieldData = reader.ReadBytes(fieldSize);
            }
            else
            {
                fieldData = Array.Empty<byte>();
            }

            switch (fieldType)
            {
                case HdrEnd:
                    return header;

                case HdrCipherId:
                    if (fieldData.Length != 16)
                        throw new InvalidOperationException("Invalid cipher ID.");
                    for (int i = 0; i < 16; i++)
                    {
                        if (fieldData[i] != CipherAes256[i])
                            throw new InvalidOperationException($"Unsupported cipher. Only AES-256 is supported.");
                    }
                    break;

                case HdrCompression:
                    if (fieldSize >= 4)
                        header.Compression = BitConverter.ToUInt32(fieldData, 0);
                    break;

                case HdrMasterSeed:
                    header.MasterSeed = fieldData;
                    break;

                case HdrTransformSeed:
                    header.TransformSeed = fieldData;
                    break;

                case HdrTransformRounds:
                    header.TransformRounds = BitConverter.ToUInt64(fieldData, 0);
                    break;

                case HdrEncryptionIv:
                    header.EncryptionIv = fieldData;
                    break;

                case HdrProtectedKey:
                    header.ProtectedStreamKey = fieldData;
                    break;

                case HdrStreamStart:
                    header.StreamStartBytes = fieldData;
                    break;

                case HdrInnerStreamId:
                    if (fieldSize >= 4)
                        header.InnerStreamId = BitConverter.ToUInt32(fieldData, 0);
                    break;
            }
        }
    }

    private static byte[] ReadRemainingBytes(BinaryReader reader)
    {
        using var ms = new MemoryStream();
        reader.BaseStream.CopyTo(ms);
        return ms.ToArray();
    }

    // ============================================================
    // Key Derivation (KeePass AES-ECB transform)
    // ============================================================

    private static byte[] DeriveKey(string password, byte[] transformSeed, ulong transformRounds, byte[] masterSeed)
    {
        byte[] compositeKey = SHA256.HashData(Encoding.UTF8.GetBytes(password));

        using var aes = Aes.Create();
        aes.Key = compositeKey;
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.None;

        byte[] transformed = new byte[transformSeed.Length];
        Array.Copy(transformSeed, transformed, transformSeed.Length);

        using var encryptor = aes.CreateEncryptor();
        for (ulong round = 0; round < transformRounds; round++)
        {
            transformed = encryptor.TransformFinalBlock(transformed, 0, transformed.Length);
        }

        byte[] combined = new byte[transformed.Length + masterSeed.Length];
        Array.Copy(transformed, 0, combined, 0, transformed.Length);
        Array.Copy(masterSeed, 0, combined, transformed.Length, masterSeed.Length);

        return SHA256.HashData(combined);
    }

    // ============================================================
    // AES-256-CBC
    // ============================================================

    private static byte[] DecryptAesCbc(byte[] key, byte[] iv, byte[] data)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.None;
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(data, 0, data.Length);
    }

    // ============================================================
    // GZip Decompression
    // ============================================================

    private static byte[] GzipDecompress(byte[] data)
    {
        using var input = new MemoryStream(data);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();
        gzip.CopyTo(output);
        return output.ToArray();
    }

    // ============================================================
    // XML Parsing
    // ============================================================

    private class KdbxEntry
    {
        public string title = string.Empty;
        public string username = string.Empty;
        public string password = string.Empty;
        public string url = string.Empty;
        public string notes = string.Empty;
    }

    private static List<KdbxEntry> ParseXml(string xml, byte[]? protectedKey)
    {
        var entries = new List<KdbxEntry>();
        var doc = XDocument.Parse(xml);
        var ns = doc.Root!.GetDefaultNamespace();

        foreach (var entryElem in doc.Descendants(ns + "Entry"))
        {
            var entry = new KdbxEntry();

            foreach (var stringElem in entryElem.Descendants(ns + "String"))
            {
                var keyElem = stringElem.Element(ns + "Key");
                var valueElem = stringElem.Element(ns + "Value");

                if (keyElem == null || valueElem == null) continue;

                string? key = keyElem.Value;
                string? value = valueElem.Value;

                // Check if protected
                var protectedAttr = valueElem.Attribute("Protected");
                bool isProtected = protectedAttr != null && protectedAttr.Value == "True";

                string decrypted;
                if (isProtected && protectedKey != null && protectedKey.Length > 0)
                {
                    decrypted = DecryptProtectedString(protectedKey, value ?? "");
                }
                else
                {
                    decrypted = value ?? "";
                }

                switch (key)
                {
                    case "Title": entry.title = decrypted; break;
                    case "UserName": entry.username = decrypted; break;
                    case "Password": entry.password = decrypted; break;
                    case "URL": entry.url = decrypted; break;
                    case "Notes": entry.notes = decrypted; break;
                }
            }

            if (!string.IsNullOrEmpty(entry.title) ||
                !string.IsNullOrEmpty(entry.username) ||
                !string.IsNullOrEmpty(entry.password))
            {
                entries.Add(entry);
            }
        }

        return entries;
    }

    // ============================================================
    // Salsa20 Decryption
    // ============================================================

    private static string DecryptProtectedString(byte[] key, string base64Value)
    {
        try
        {
            byte[] raw = Convert.FromBase64String(base64Value);
            if (raw.Length < 8) return base64Value;

            byte[] iv = raw.Take(8).ToArray();
            byte[] ciphertext = raw.Skip(8).ToArray();

            byte[] plaintext = Salsa20Decrypt(key, iv, ciphertext);

            // Remove null padding
            int end = plaintext.Length;
            while (end > 0 && plaintext[end - 1] == 0) end--;

            return Encoding.UTF8.GetString(plaintext, 0, end);
        }
        catch
        {
            return base64Value;
        }
    }

    private static byte[] Salsa20Decrypt(byte[] key, byte[] iv, byte[] data)
    {
        byte[] output = new byte[data.Length];
        byte[] block = new byte[64];
        int pos = 0;
        ulong counter = 0;

        while (pos < data.Length)
        {
            GenerateSalsa20Block(key, iv, counter, block);
            counter++;

            int remaining = Math.Min(64, data.Length - pos);
            for (int i = 0; i < remaining; i++)
            {
                output[pos + i] = (byte)(data[pos + i] ^ block[i]);
            }
            pos += 64;
        }

        return output;
    }

    private static void GenerateSalsa20Block(byte[] key, byte[] iv, ulong counter, byte[] output)
    {
        uint[] state = new uint[16];

        // "expand 32-byte k"
        state[0] = 0x61707865;
        state[5] = 0x3320646E;
        state[10] = 0x79622D32;
        state[15] = 0x6B206574;

        // Key (8 x uint32)
        state[1] = BitConverter.ToUInt32(key, 0);
        state[2] = BitConverter.ToUInt32(key, 4);
        state[3] = BitConverter.ToUInt32(key, 8);
        state[4] = BitConverter.ToUInt32(key, 12);

        state[11] = BitConverter.ToUInt32(key, 16);
        state[12] = BitConverter.ToUInt32(key, 20);
        state[13] = BitConverter.ToUInt32(key, 24);
        state[14] = BitConverter.ToUInt32(key, 28);

        // IV (2 x uint32)
        state[6] = BitConverter.ToUInt32(iv, 0);
        state[7] = BitConverter.ToUInt32(iv, 4);

        // Counter
        state[8] = (uint)(counter & 0xFFFFFFFF);
        state[9] = (uint)(counter >> 32);

        uint[] working = (uint[])state.Clone();

        // 20 rounds (10 double-rounds)
        for (int i = 0; i < 10; i++)
        {
            // Column rounds
            QuarterRound(ref working, 0, 4, 8, 12);
            QuarterRound(ref working, 5, 9, 13, 1);
            QuarterRound(ref working, 10, 14, 2, 6);
            QuarterRound(ref working, 15, 3, 7, 11);

            // Row rounds
            QuarterRound(ref working, 0, 1, 2, 3);
            QuarterRound(ref working, 5, 6, 7, 4);
            QuarterRound(ref working, 10, 11, 8, 9);
            QuarterRound(ref working, 15, 12, 13, 14);
        }

        // Add original state
        for (int i = 0; i < 16; i++)
        {
            working[i] += state[i];
        }

        // Write to bytes
        for (int i = 0; i < 16; i++)
        {
            byte[] bytes = BitConverter.GetBytes(working[i]);
            Array.Copy(bytes, 0, output, i * 4, 4);
        }
    }

    private static void QuarterRound(ref uint[] state, int a, int b, int c, int d)
    {
        state[b] ^= RotateLeft(state[a] + state[d], 7);
        state[c] ^= RotateLeft(state[b] + state[a], 9);
        state[d] ^= RotateLeft(state[c] + state[b], 13);
        state[a] ^= RotateLeft(state[d] + state[c], 18);
    }

    private static uint RotateLeft(uint value, int shift)
    {
        return (value << shift) | (value >> (32 - shift));
    }

    private static string ExtractDatabaseName(string xml)
    {
        var doc = XDocument.Parse(xml);
        var ns = doc.Root!.GetDefaultNamespace();
        var nameElem = doc.Descendants(ns + "DatabaseName").FirstOrDefault();
        return nameElem?.Value.Trim() ?? "KeePass";
    }

    private static int CountGroups(string xml)
    {
        var doc = XDocument.Parse(xml);
        var ns = doc.Root!.GetDefaultNamespace();
        return doc.Descendants(ns + "Group").Count();
    }
}
