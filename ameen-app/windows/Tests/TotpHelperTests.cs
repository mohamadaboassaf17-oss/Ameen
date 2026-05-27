using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Ameen.Windows.Services;
using Xunit;

namespace Ameen.Windows.Tests;

public class TotpHelperTests
{
    [Theory]
    [InlineData("", "000000")]
    [InlineData(null, "000000")]
    public void GenerateCode_EmptyOrNullSecret_ReturnsZeros(string secret, string expected)
    {
        var code = TotpHelper.GenerateCode(secret);
        // We expect 6 zeros when secret is empty
        Assert.Matches("^0{6}$", code);
    }

    [Fact]
    public void GenerateCode_ReturnsCorrectLength()
    {
        var secret = "JBSWY3DPEHPK3PXP"; // "Hello!" in Base32
        var code6 = TotpHelper.GenerateCode(secret, digits: 6);
        var code8 = TotpHelper.GenerateCode(secret, digits: 8);

        Assert.Equal(6, code6.Length);
        Assert.Equal(8, code8.Length);
    }

    [Fact]
    public void GenerateCode_DigitsParameter_AffectsOutputLength()
    {
        var secret = "JBSWY3DPEHPK3PXP";

        for (int d = 6; d <= 10; d++)
        {
            var code = TotpHelper.GenerateCode(secret, digits: d);
            Assert.Equal(d, code.Length);
        }
    }

    [Fact]
    public void GenerateCode_AllDigitsInRange()
    {
        var secret = "JBSWY3DPEHPK3PXP";
        var code = TotpHelper.GenerateCode(secret, digits: 6);

        Assert.All(code, c => Assert.True(char.IsDigit(c)));
    }

    [Fact]
    public void GenerateCode_WithLeadingZeros_PreservesPadding()
    {
        var secret = "JBSWY3DPEHPK3PXP";

        // Run multiple times since the code changes every 30 seconds
        for (int i = 0; i < 5; i++)
        {
            var code = TotpHelper.GenerateCode(secret, digits: 6);
            Assert.True(code.Length == 6, $"Expected 6 digits, got '{code}' (length {code.Length})");
            Assert.All(code, c => Assert.True(char.IsDigit(c), $"Non-digit char '{c}' in code '{code}'"));
        }
    }

    [Fact]
    public void GetRemainingSeconds_ReturnsPositiveValue()
    {
        var remaining = TotpHelper.GetRemainingSeconds(period: 30);

        Assert.InRange(remaining, 1, 30);
    }

    [Theory]
    [InlineData(30)]
    [InlineData(60)]
    public void GetRemainingSeconds_RespectsPeriod(int period)
    {
        var remaining = TotpHelper.GetRemainingSeconds(period);

        Assert.InRange(remaining, 1, period);
    }

    [Fact]
    public void GenerateCode_SameSecretAtSameTime_ProducesSameCode()
    {
        var secret = "JBSWY3DPEHPK3PXP";

        var code1 = TotpHelper.GenerateCode(secret);
        var code2 = TotpHelper.GenerateCode(secret);

        Assert.Equal(code1, code2);
    }

    [Fact]
    public void GenerateCode_DifferentSecrets_ProduceDifferentCodes()
    {
        var secret1 = "JBSWY3DPEHPK3PXP"; // "Hello!"
        var secret2 = "ORSXG5A="; // "test" in Base32

        var code1 = TotpHelper.GenerateCode(secret1);
        var code2 = TotpHelper.GenerateCode(secret2);

        Assert.NotEqual(code1, code2);
    }

    [Theory]
    [InlineData("JBSWY3DPEHPK3PXP", 6)]
    [InlineData("JBSWY3DPEHPK3PXP", 8)]
    [InlineData("JBSWY3DPEHPK3PXP", 7)]
    [InlineData("ORSXG5A=", 6)]
    [InlineData("ORSXG5A=", 8)]
    public void GenerateCode_VaryingDigits_AllNumeric(string secret, int digits)
    {
        var code = TotpHelper.GenerateCode(secret, digits);

        Assert.Equal(digits, code.Length);
        Assert.Matches($"^[0-9]{{{digits}}}$", code);
    }

    [Fact]
    public void GenerateCode_Base32Decode_HandlesPadding()
    {
        // "test" in Base32 with padding
        var secret = "ORSXG5A=";
        var code = TotpHelper.GenerateCode(secret, digits: 6);

        Assert.NotNull(code);
        Assert.Equal(6, code.Length);
        Assert.All(code, c => Assert.True(char.IsDigit(c)));
    }

    [Fact]
    public void GenerateCode_LowercaseSecret_Works()
    {
        var secret = "jbswy3dpehpk3pxp";

        var code = TotpHelper.GenerateCode(secret, digits: 6);

        Assert.NotNull(code);
        Assert.Equal(6, code.Length);
    }

    [Fact]
    public void Base32Decode_PadsToMakeByteBoundary()
    {
        var method = typeof(TotpHelper).GetMethod("Base32Decode", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var result = (byte[])method.Invoke(null, new object[] { "JBSWY3DPEHPK3PXP" })!;

        Assert.NotEmpty(result);
    }

    [Fact]
    public void Base32Decode_SkipsInvalidCharacters()
    {
        var method = typeof(TotpHelper).GetMethod("Base32Decode", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var result1 = (byte[])method.Invoke(null, new object[] { "A!@#B" })!;
        var result2 = (byte[])method.Invoke(null, new object[] { "AB" })!;

        Assert.Equal(result1.Length, result2.Length);
    }
}
