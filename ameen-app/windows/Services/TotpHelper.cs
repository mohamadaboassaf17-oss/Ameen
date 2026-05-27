using System;
using System.Security.Cryptography;

namespace Ameen.Windows.Services;

public static class TotpHelper
{
    public static string GenerateCode(string base32Secret, int digits = 6, int period = 30)
    {
        if (string.IsNullOrWhiteSpace(base32Secret))
            return new string('0', digits);

        var key = Base32Decode(base32Secret);
        var counter = (long)(DateTimeOffset.UtcNow.ToUnixTimeSeconds() / period);
        var counterBytes = BitConverter.GetBytes(counter);
        if (BitConverter.IsLittleEndian)
            Array.Reverse(counterBytes);

        using var hmac = new HMACSHA1(key);
        var hash = hmac.ComputeHash(counterBytes);

        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24)
                   | ((hash[offset + 1] & 0xFF) << 16)
                   | ((hash[offset + 2] & 0xFF) << 8)
                   | (hash[offset + 3] & 0xFF);

        var otp = binary % (int)Math.Pow(10, digits);
        return otp.ToString($"D{digits}");
    }

    public static int GetRemainingSeconds(int period = 30)
    {
        var elapsed = (int)(DateTimeOffset.UtcNow.ToUnixTimeSeconds() % period);
        return period - elapsed;
    }

    private static byte[] Base32Decode(string base32)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        base32 = base32.Trim().TrimEnd('=').ToUpperInvariant();

        var bits = 0;
        var current = 0;
        var result = new System.Collections.Generic.List<byte>();

        foreach (var c in base32)
        {
            var idx = alphabet.IndexOf(c);
            if (idx < 0)
                continue;

            current = (current << 5) | idx;
            bits += 5;

            if (bits >= 8)
            {
                bits -= 8;
                result.Add((byte)(current >> bits));
                current &= (1 << bits) - 1;
            }
        }

        return result.ToArray();
    }
}
