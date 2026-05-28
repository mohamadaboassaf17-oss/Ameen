using System;
using System.Linq;
using System.Security.Cryptography;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Threading.Tasks;
using Windows.Security.Credentials;
using Windows.Security.Credentials.UI;
using Windows.Security.Cryptography;
using Windows.Security.Cryptography.Core;

namespace Ameen.Windows.Services;

public class WindowsHelloService
{
    private const string KeyCredentialName = "Ameen_VaultKey";

    public async Task<bool> IsWindowsHelloAvailableAsync()
    {
        try
        {
            if (!await KeyCredentialManager.IsSupportedAsync())
                return false;

            var availability = await UserConsentVerifier.CheckAvailabilityAsync();
            return availability == UserConsentVerifierAvailability.Available;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> IsKeyStoredAsync()
    {
        try
        {
            var vault = new PasswordVault();
            var credentials = vault.FindAllByResource(KeyCredentialName);
            return credentials.Count > 0;
        }
        catch
        {
            try
            {
                var openResult = await KeyCredentialManager.OpenAsync(KeyCredentialName);
                return openResult.Status == KeyCredentialStatus.Success;
            }
            catch
            {
                return false;
            }
        }
    }

    public async Task<(bool success, string errorMessage)> CreateKeyCredentialAsync()
    {
        try
        {
            var result = await KeyCredentialManager.RequestCreateAsync(
                KeyCredentialName,
                KeyCredentialCreationOption.ReplaceExisting);

            if (result.Status == KeyCredentialStatus.Success)
            {
                var vault = new PasswordVault();
                vault.Add(new PasswordCredential(KeyCredentialName, "Ameen", string.Empty));
                return (true, "تم إنشاء مفتاح الأمان بنجاح");
            }

            return (false, "تعذر إنشاء مفتاح الأمان. تأكد من تفعيل Windows Hello");
        }
        catch (Exception ex)
        {
            return (false, $"تعذر إنشاء مفتاح الأمان: {ex.Message}");
        }
    }

    public async Task<(bool success, byte[] encryptedKey, byte[] iv, string errorMessage)> WrapVaultKeyAsync(byte[] vaultKey)
    {
        try
        {
            var openResult = await KeyCredentialManager.OpenAsync(KeyCredentialName);
            if (openResult.Status != KeyCredentialStatus.Success)
                return (false, Array.Empty<byte>(), Array.Empty<byte>(),
                    "تعذر فتح مفتاح الأمان للتغليف");

            var credential = openResult.Credential;
            var publicKeyBlob = credential.RetrievePublicKey();
            var publicKeyBytes = publicKeyBlob.ToArray();

            using var rsa = RSA.Create();
            rsa.ImportRSAPublicKey(publicKeyBytes, out _);

            var iv = new byte[12];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(iv);

            var encryptedKey = rsa.Encrypt(vaultKey, RSAEncryptionPadding.OaepSHA256);

            return (true, encryptedKey, iv, string.Empty);
        }
        catch (Exception ex)
        {
            return (false, Array.Empty<byte>(), Array.Empty<byte>(),
                $"فشل تغليف المفتاح: {ex.Message}");
        }
    }

    public async Task<(bool success, byte[] vaultKey, string errorMessage)> UnwrapVaultKeyAsync(byte[] encryptedKey, byte[] iv)
    {
        try
        {
            var openResult = await KeyCredentialManager.OpenAsync(KeyCredentialName);
            if (openResult.Status != KeyCredentialStatus.Success)
            {
                if (openResult.Status == KeyCredentialStatus.UserCanceled)
                    return (false, Array.Empty<byte>(), "تم إلغاء العملية");
                return (false, Array.Empty<byte>(), "فشل التحقق من الهوية");
            }

            var credential = openResult.Credential;

            CngKey? cngKey = null;
            try
            {
                var publicKeyBlob = credential.RetrievePublicKey();
                var publicKeyBytes = publicKeyBlob.ToArray();
                cngKey = FindCngKeyByPublicKey(publicKeyBytes);
            }
            catch
            {
                cngKey = null;
            }

            if (cngKey == null)
            {
                cngKey = FindCngKeyByProvider(CngProvider.MicrosoftPlatformCryptoProvider)
                         ?? FindCngKeyByProvider(CngProvider.MicrosoftSoftwareKeyStorageProvider);
            }

            if (cngKey == null)
                return (false, Array.Empty<byte>(), "تعذر العثور على المفتاح الخاص في وحدة التخزين الآمنة");

            try
            {
                using var rsa = new RSACng(cngKey);
                var vaultKey = rsa.Decrypt(encryptedKey, RSAEncryptionPadding.OaepSHA256);
                return (true, vaultKey, string.Empty);
            }
            catch
            {
                return (false, Array.Empty<byte>(), "فشل فك تغليف المفتاح. قد يكون المفتاح غير متطابق");
            }
        }
        catch (Exception ex)
        {
            return (false, Array.Empty<byte>(), $"فشل فك التغليف: {ex.Message}");
        }
    }

    public async Task<(bool success, string errorMessage)> DeleteKeyCredentialAsync()
    {
        try
        {
            var vault = new PasswordVault();
            try
            {
                var creds = vault.FindAllByResource(KeyCredentialName);
                foreach (var cred in creds)
                {
                    vault.Remove(cred);
                }
            }
            catch
            {
            }

            var deleted = false;
            try
            {
                var openResult = await KeyCredentialManager.OpenAsync(KeyCredentialName);
                if (openResult.Status == KeyCredentialStatus.Success)
                {
                    await KeyCredentialManager.DeleteAsync(KeyCredentialName);
                    deleted = true;
                }
            }
            catch
            {
            }

            if (!deleted)
            {
                try
                {
                    var cngKey = CngKey.Open(KeyCredentialName);
                    cngKey.Delete();
                }
                catch
                {
                }
            }

            return (true, "تم حذف مفتاح الأمان بنجاح");
        }
        catch (Exception ex)
        {
            return (false, $"فشل حذف مفتاح الأمان: {ex.Message}");
        }
    }

    private CngKey? FindCngKeyByPublicKey(byte[] publicKeyBytes)
    {
        try
        {
            var providers = new[] { CngProvider.MicrosoftPlatformCryptoProvider, CngProvider.MicrosoftSoftwareKeyStorageProvider };
            foreach (var provider in providers)
            {
                try
                {
                    var key = CngKey.Open(KeyCredentialName, provider);
                    byte[] keyBlob;
                    try
                    {
                        keyBlob = key.Export(CngKeyBlobFormat.GenericPublicBlob);
                    }
                    catch
                    {
                        continue;
                    }

                    if (keyBlob.Length >= publicKeyBytes.Length)
                    {
                        var match = keyBlob.Skip(keyBlob.Length - publicKeyBytes.Length)
                                           .SequenceEqual(publicKeyBytes);
                        if (match)
                            return key;
                    }
                }
                catch
                {
                }
            }
        }
        catch
        {
        }
        return null;
    }

    private CngKey? FindCngKeyByProvider(CngProvider provider)
    {
        try
        {
            return CngKey.Open(KeyCredentialName, provider);
        }
        catch
        {
            return null;
        }
    }
}
