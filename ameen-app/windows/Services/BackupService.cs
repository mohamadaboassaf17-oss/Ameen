using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using Ameen.Windows.Models;
using CommunityToolkit.Maui.Storage;

namespace Ameen.Windows.Services;

public class BackupManifest
{
    [JsonPropertyName("version")]
    public int Version { get; set; } = 1;

    [JsonPropertyName("profileName")]
    public string ProfileName { get; set; } = string.Empty;

    [JsonPropertyName("vaultId")]
    public string VaultId { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public long CreatedAt { get; set; }

    [JsonPropertyName("iv")]
    public string Iv { get; set; } = string.Empty;

    [JsonPropertyName("ciphertext")]
    public string Ciphertext { get; set; } = string.Empty;

    [JsonPropertyName("tag")]
    public string Tag { get; set; } = string.Empty;
}

public class BackupService
{
    private const int KeySize = 256;
    private const int IvSize = 12;
    private const int TagSize = 16;

    /// <summary>
    /// Export vault items to an encrypted .ameen-backup file.
    /// </summary>
    public async Task<string?> ExportVaultAsync(
        List<VaultItem> items,
        byte[] key,
        string profileName,
        string vaultId)
    {
        try
        {
            if (items == null || items.Count == 0)
            {
                Debug.WriteLine("[BackupService] Export cancelled — no items to export.");
                return null;
            }

            var vaultJson = JsonSerializer.Serialize(new
            {
                version = 1,
                vaultId,
                items = items.Select(i => ToExportItem(i)).ToList()
            }, new JsonSerializerOptions { WriteIndented = true });

            var vaultBytes = Encoding.UTF8.GetBytes(vaultJson);

            using var aes = new AesGcm(key, TagSize);
            var iv = RandomNumberGenerator.GetBytes(IvSize);
            var ciphertext = new byte[vaultBytes.Length];
            var tag = new byte[TagSize];

            aes.Encrypt(iv, vaultBytes, ciphertext, tag);

            var manifest = new BackupManifest
            {
                Version = 1,
                ProfileName = profileName,
                VaultId = vaultId,
                CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Iv = Convert.ToHexString(iv),
                Ciphertext = Convert.ToHexString(ciphertext),
                Tag = Convert.ToHexString(tag),
            };

            var manifestJson = JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true });

            var filePath = await ShowSaveFileDialogAsync(profileName);
            if (string.IsNullOrEmpty(filePath))
            {
                Debug.WriteLine("[BackupService] Export cancelled by user.");
                return null;
            }

            await File.WriteAllTextAsync(filePath, manifestJson, Encoding.UTF8);
            Debug.WriteLine($"[BackupService] Vault exported to: {filePath} (${items.Count} items)");
            return filePath;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BackupService] Export failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Import and decrypt a .ameen-backup file.
    /// </summary>
    public async Task<List<VaultItem>?> ImportVaultAsync(byte[] key)
    {
        try
        {
            var filePath = await ShowOpenFileDialogAsync();
            if (string.IsNullOrEmpty(filePath))
            {
                Debug.WriteLine("[BackupService] Import cancelled by user.");
                return null;
            }

            var manifestJson = await File.ReadAllTextAsync(filePath, Encoding.UTF8);
            var manifest = JsonSerializer.Deserialize<BackupManifest>(manifestJson);

            if (manifest == null)
            {
                throw new InvalidOperationException("Invalid backup file — could not parse manifest.");
            }

            if (manifest.Version != 1)
            {
                throw new InvalidOperationException(
                    $"Unsupported backup version: {manifest.Version}. This app supports version 1.");
            }

            var iv = Convert.FromHexString(manifest.Iv);
            var ciphertext = Convert.FromHexString(manifest.Ciphertext);
            var tag = Convert.FromHexString(manifest.Tag);

            using var aes = new AesGcm(key, TagSize);
            var decrypted = new byte[ciphertext.Length];
            aes.Decrypt(iv, ciphertext, tag, decrypted);

            var vaultJson = Encoding.UTF8.GetString(decrypted);
            var vaultData = JsonSerializer.Deserialize<VaultImportData>(vaultJson);

            if (vaultData?.items == null || vaultData.items.Count == 0)
            {
                Debug.WriteLine("[BackupService] Imported vault is empty.");
                return new List<VaultItem>();
            }

            var items = vaultData.items.Select(i => FromImportItem(i)).ToList();
            Debug.WriteLine($"[BackupService] Vault imported: {items.Count} items from {Path.GetFileName(filePath)}");
            return items;
        }
        catch (CryptographicException)
        {
            Debug.WriteLine("[BackupService] Import failed — incorrect key or corrupted file.");
            throw new InvalidOperationException("فشل فك تشفير ملف النسخة الاحتياطية — كلمة المرور غير صحيحة أو الملف تالف.");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BackupService] Import failed: {ex.Message}");
            throw;
        }
    }

    private static object ToExportItem(VaultItem item)
    {
        return new
        {
            item.Id,
            item.Type,
            item.Title,
            item.Username,
            item.Password,
            item.Url,
            item.Content,
            item.Cardholder,
            item.Number,
            item.Expiry,
            item.Cvv,
            item.Notes,
            item.OtpSecret,
            item.UpdatedAt,
            item.IsConflict,
            item.ConflictDate,
            item.ConflictOriginalId,
        };
    }

    private static VaultItem FromImportItem(ImportItem import)
    {
        return new VaultItem
        {
            Id = import.Id ?? Guid.NewGuid().ToString("N")[..12],
            Type = import.Type ?? "password",
            Title = import.Title ?? "",
            Username = import.Username ?? "",
            Password = import.Password ?? "",
            Url = import.Url ?? "",
            Content = import.Content ?? "",
            Cardholder = import.Cardholder ?? "",
            Number = import.Number ?? "",
            Expiry = import.Expiry ?? "",
            Cvv = import.Cvv ?? "",
            Notes = import.Notes ?? "",
            OtpSecret = import.OtpSecret ?? "",
            UpdatedAt = import.UpdatedAt,
            IsConflict = import.IsConflict,
            ConflictDate = import.ConflictDate,
            ConflictOriginalId = import.ConflictOriginalId,
        };
    }

    private static async Task<string?> ShowSaveFileDialogAsync(string profileName)
    {
        try
        {
            var fileName = $"ameen_backup_{profileName}_{DateTime.Now:yyyyMMdd_HHmmss}.ameen-backup";

            using var emptyStream = new MemoryStream();
            var fileSaverResult = await FileSaver.Default.SaveAsync(fileName, emptyStream, CancellationToken.None);

            if (fileSaverResult.IsSuccessful)
                return fileSaverResult.FilePath;

            return null;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BackupService] Save dialog failed: {ex.Message}");
            return null;
        }
    }

    private static async Task<string?> ShowOpenFileDialogAsync()
    {
        try
        {
            var customFileType = new FilePickerFileType(
                new Dictionary<DevicePlatform, IEnumerable<string>>
                {
                    { DevicePlatform.WinUI, new[] { ".ameen-backup" } },
                });

            var result = await FilePicker.Default.PickAsync(new PickOptions
            {
                PickerTitle = "اختر ملف النسخة الاحتياطية",
                FileTypes = customFileType,
            });

            return result?.FullPath;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BackupService] Open dialog failed: {ex.Message}");
            return null;
        }
    }

    private class VaultImportData
    {
        [JsonPropertyName("items")]
        public List<ImportItem> items { get; set; } = new();
    }

    private class ImportItem
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("type")] public string? Type { get; set; }
        [JsonPropertyName("title")] public string? Title { get; set; }
        [JsonPropertyName("username")] public string? Username { get; set; }
        [JsonPropertyName("password")] public string? Password { get; set; }
        [JsonPropertyName("url")] public string? Url { get; set; }
        [JsonPropertyName("content")] public string? Content { get; set; }
        [JsonPropertyName("cardholder")] public string? Cardholder { get; set; }
        [JsonPropertyName("number")] public string? Number { get; set; }
        [JsonPropertyName("expiry")] public string? Expiry { get; set; }
        [JsonPropertyName("cvv")] public string? Cvv { get; set; }
        [JsonPropertyName("notes")] public string? Notes { get; set; }
        [JsonPropertyName("otpSecret")] public string? OtpSecret { get; set; }
        [JsonPropertyName("updatedAt")] public DateTime UpdatedAt { get; set; }
        [JsonPropertyName("isConflict")] public bool IsConflict { get; set; }
        [JsonPropertyName("conflictDate")] public DateTime? ConflictDate { get; set; }
        [JsonPropertyName("conflictOriginalId")] public string? ConflictOriginalId { get; set; }
    }
}
