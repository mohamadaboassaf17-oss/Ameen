using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Ameen.Windows.Services;
using Xunit;

namespace Ameen.Windows.Tests;

public class KdbxImportServiceTests
{
    private readonly KdbxImportService _service = new();

    [Fact]
    public void ReadKdbx_BadMagicSig1_ThrowsInvalidOperationException()
    {
        var bytes = new byte[12];
        BitConverter.GetBytes(0xDEADBEEF).CopyTo(bytes, 0);
        BitConverter.GetBytes(0xB54BFB67).CopyTo(bytes, 4);
        BitConverter.GetBytes(0x00030001).CopyTo(bytes, 8);

        var ex = Assert.Throws<InvalidOperationException>(() => _service.ReadKdbx(bytes, "password"));
        Assert.Contains("KDBX", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ReadKdbx_BadMagicSig2_ThrowsInvalidOperationException()
    {
        var bytes = new byte[12];
        BitConverter.GetBytes(0x9AA2D903).CopyTo(bytes, 0);
        BitConverter.GetBytes(0xDEADBEEF).CopyTo(bytes, 4);
        BitConverter.GetBytes(0x00030001).CopyTo(bytes, 8);

        var ex = Assert.Throws<InvalidOperationException>(() => _service.ReadKdbx(bytes, "password"));
        Assert.Contains("KDBX", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ReadKdbx_UnsupportedVersion_ThrowsInvalidOperationException()
    {
        var bytes = new byte[12];
        BitConverter.GetBytes(0x9AA2D903).CopyTo(bytes, 0);
        BitConverter.GetBytes(0xB54BFB67).CopyTo(bytes, 4);
        BitConverter.GetBytes(0xDEADBEEF).CopyTo(bytes, 8);

        var ex = Assert.Throws<InvalidOperationException>(() => _service.ReadKdbx(bytes, "password"));
        Assert.Contains("Unsupported", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ReadKdbx_FileTooSmall_ThrowsInvalidOperationException()
    {
        var bytes = new byte[5];

        var ex = Assert.Throws<InvalidOperationException>(() => _service.ReadKdbx(bytes, "password"));
        Assert.Contains("small", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void QuarterRound_CorrectlyTransformsState()
    {
        var m = typeof(KdbxImportService).GetMethod("QuarterRound", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(m);

        uint[] state = { 0x00000001, 0x00000000, 0x00000000, 0x00000000 };

        m.Invoke(null, new object[] { state, 0, 1, 2, 3 });

        // After QR(0,1,2,3):
        // b ^= rotate(a+d, 7), c ^= rotate(b+a, 9), d ^= rotate(c+b, 13), a ^= rotate(d+c, 18)
        Assert.NotEqual(0u, state[1]);
        Assert.NotEqual(0u, state[2]);
        Assert.NotEqual(0u, state[3]);
        Assert.NotEqual(1u, state[0]); // a changed
    }

    [Fact]
    public void QuarterRound_RepeatedDoublesPreserveDeterminism()
    {
        var m = typeof(KdbxImportService).GetMethod("QuarterRound", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(m);

        uint[] state1 = { 0x11111111, 0x22222222, 0x33333333, 0x44444444 };
        uint[] state2 = { 0x11111111, 0x22222222, 0x33333333, 0x44444444 };

        m.Invoke(null, new object[] { state1, 0, 1, 2, 3 });
        m.Invoke(null, new object[] { state2, 0, 1, 2, 3 });

        Assert.Equal(state1, state2);
    }

    [Fact]
    public void RotateLeft_RotatesCorrectly()
    {
        var m = typeof(KdbxImportService).GetMethod("RotateLeft", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(m);

        var result = m.Invoke(null, new object[] { 0x80000001u, 1 });

        Assert.Equal(0x00000003u, (uint)result!);
    }

    [Fact]
    public void GzipDecompress_RoundTrip_ReturnsOriginalData()
    {
        var method = typeof(KdbxImportService).GetMethod("GzipDecompress", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var original = Encoding.UTF8.GetBytes("Hello KDBX compressed data stream here!");
        byte[] compressed;
        using (var output = new MemoryStream())
        {
            using (var gzip = new GZipStream(output, CompressionMode.Compress))
            {
                gzip.Write(original, 0, original.Length);
            }
            compressed = output.ToArray();
        }

        var decompressed = (byte[])method.Invoke(null, new object[] { compressed })!;

        Assert.Equal(original, decompressed);
    }

    [Fact]
    public void GzipDecompress_EmptyData_ReturnsEmpty()
    {
        var method = typeof(KdbxImportService).GetMethod("GzipDecompress", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        byte[] compressed;
        using (var output = new MemoryStream())
        {
            using (var gzip = new GZipStream(output, CompressionMode.Compress))
            {
                gzip.Write(Array.Empty<byte>(), 0, 0);
            }
            compressed = output.ToArray();
        }

        var decompressed = (byte[])method.Invoke(null, new object[] { compressed })!;

        Assert.Empty(decompressed);
    }
}
