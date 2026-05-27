using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace Ameen.Windows.Services;

public record DerivationResult(byte[] VaultKey, byte[] VerificationHash);

public class KeyDerivationService
{
    private const int VaultKeyLength = 32;
    private const int VerificationHashLength = 32;
    private const int TotalLength = VaultKeyLength + VerificationHashLength;

    public async Task<DerivationResult> DeriveKey(string password, byte[] salt)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password));
        argon2.Salt = salt;
        argon2.DegreeOfParallelism = 4;
        argon2.MemorySize = 65536;
        argon2.Iterations = 3;

        var hash = await argon2.GetBytesAsync(TotalLength);

        var vaultKey = new byte[VaultKeyLength];
        var verificationHash = new byte[VerificationHashLength];
        Array.Copy(hash, 0, vaultKey, 0, VaultKeyLength);
        Array.Copy(hash, VaultKeyLength, verificationHash, 0, VerificationHashLength);

        return new DerivationResult(vaultKey, verificationHash);
    }

    public async Task<bool> VerifyKey(string password, byte[] salt, byte[] expectedVerificationHash)
    {
        var result = await DeriveKey(password, salt);
        return CryptographicOperations.FixedTimeEquals(result.VerificationHash, expectedVerificationHash);
    }

    public byte[] GenerateSalt()
    {
        var salt = new byte[32];
        RandomNumberGenerator.Fill(salt);
        return salt;
    }
}
