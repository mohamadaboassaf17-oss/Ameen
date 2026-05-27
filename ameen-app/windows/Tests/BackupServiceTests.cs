using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ameen.Windows.Models;
using Ameen.Windows.Services;
using Xunit;

namespace Ameen.Windows.Tests;

public class BackupServiceTests
{
    private const int KeySize = 256;
    private const int IvSize = 12;
    private const int TagSize = 16;

    [Fact]
    public void EncryptDecrypt_RoundTrip_ReturnsSameVaultData()
    {
        var key = RandomNumberGenerator.GetBytes(KeySize / 8);
        var items = new List<VaultItem>
        {
            new() { Id = "abc123", Type = "password", Title = "GitHub", Username = "ameen@example.com", Password = "super-secret", Url = "https://github.com", Notes = "dev account" },
            new() { Id = "def456", Type = "card", Title = "Visa", Cardholder = "Ameen User", Number = "4111111111111111", Expiry = "12/28", Cvv = "123" },
        };

        var vaultJson = JsonSerializer.Serialize(new
        {
            version = 1,
            vaultId = "test-vault",
            items = items.Select(i => new
            {
                i.Id, i.Type, i.Title, i.Username, i.Password, i.Url,
                i.Content, i.Cardholder, i.Number, i.Expiry, i.Cvv,
                i.Notes, i.OtpSecret, i.UpdatedAt, i.IsConflict, i.ConflictDate, i.ConflictOriginalId,
            }).ToList()
        });

        var vaultBytes = Encoding.UTF8.GetBytes(vaultJson);

        using var aes = new AesGcm(key, TagSize);
        var iv = RandomNumberGenerator.GetBytes(IvSize);
        var ciphertext = new byte[vaultBytes.Length];
        var tag = new byte[TagSize];
        aes.Encrypt(iv, vaultBytes, ciphertext, tag);

        var manifest = new BackupManifest
        {
            Version = 1,
            ProfileName = "test-profile",
            VaultId = "test-vault",
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Iv = Convert.ToHexString(iv),
            Ciphertext = Convert.ToHexString(ciphertext),
            Tag = Convert.ToHexString(tag),
        };

        var manifestJson = JsonSerializer.Serialize(manifest);

        // Deserialize
        var deserializedManifest = JsonSerializer.Deserialize<BackupManifest>(manifestJson);
        Assert.NotNull(deserializedManifest);
        Assert.Equal(1, deserializedManifest.Version);
        Assert.Equal("test-profile", deserializedManifest.ProfileName);

        var decIv = Convert.FromHexString(deserializedManifest.Iv);
        var decCiphertext = Convert.FromHexString(deserializedManifest.Ciphertext);
        var decTag = Convert.FromHexString(deserializedManifest.Tag);

        using var decAes = new AesGcm(key, TagSize);
        var decrypted = new byte[decCiphertext.Length];
        decAes.Decrypt(decIv, decCiphertext, decTag, decrypted);

        var decJson = Encoding.UTF8.GetString(decrypted);

        Assert.Contains("abc123", decJson);
        Assert.Contains("GitHub", decJson);
        Assert.Contains("super-secret", decJson);
        Assert.Contains("test-vault", decJson);
    }

    [Fact]
    public void Manifest_Serialization_RoundTrip_PreservesAllFields()
    {
        var original = new BackupManifest
        {
            Version = 1,
            ProfileName = "family-profile",
            VaultId = "vault-guid-1234",
            CreatedAt = 1715462400000,
            Iv = "A1B2C3D4E5F6A7B8C9D0E1F2",
            Ciphertext = "ABCDEF0123456789ABCDEF0123456789",
            Tag = "TAG1234567890ABCD",
        };

        var json = JsonSerializer.Serialize(original);
        var deserialized = JsonSerializer.Deserialize<BackupManifest>(json);

        Assert.NotNull(deserialized);
        Assert.Equal(original.Version, deserialized.Version);
        Assert.Equal(original.ProfileName, deserialized.ProfileName);
        Assert.Equal(original.VaultId, deserialized.VaultId);
        Assert.Equal(original.CreatedAt, deserialized.CreatedAt);
        Assert.Equal(original.Iv, deserialized.Iv);
        Assert.Equal(original.Ciphertext, deserialized.Ciphertext);
        Assert.Equal(original.Tag, deserialized.Tag);
    }

    [Fact]
    public void Decrypt_WrongKey_ThrowsCryptographicException()
    {
        var correctKey = RandomNumberGenerator.GetBytes(KeySize / 8);
        var wrongKey = RandomNumberGenerator.GetBytes(KeySize / 8);

        var plaintext = Encoding.UTF8.GetBytes("secret vault content that needs protection");
        using var aes = new AesGcm(correctKey, TagSize);
        var iv = RandomNumberGenerator.GetBytes(IvSize);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];
        aes.Encrypt(iv, plaintext, ciphertext, tag);

        Assert.Throws<CryptographicException>(() =>
        {
            using var wrongAes = new AesGcm(wrongKey, TagSize);
            var result = new byte[ciphertext.Length];
            wrongAes.Decrypt(iv, ciphertext, tag, result);
        });
    }

    [Fact]
    public void Encrypt_DifferentIv_ProducesDifferentCiphertext()
    {
        var key = RandomNumberGenerator.GetBytes(KeySize / 8);
        var plaintext = Encoding.UTF8.GetBytes("test data");

        using var aes = new AesGcm(key, TagSize);
        var iv1 = RandomNumberGenerator.GetBytes(IvSize);
        var iv2 = RandomNumberGenerator.GetBytes(IvSize);
        var ct1 = new byte[plaintext.Length];
        var ct2 = new byte[plaintext.Length];
        var tag1 = new byte[TagSize];
        var tag2 = new byte[TagSize];

        aes.Encrypt(iv1, plaintext, ct1, tag1);
        aes.Encrypt(iv2, plaintext, ct2, tag2);

        Assert.NotEqual(Convert.ToHexString(ct1), Convert.ToHexString(ct2));
        Assert.NotEqual(Convert.ToHexString(tag1), Convert.ToHexString(tag2));
    }
}
