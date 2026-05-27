using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace Ameen.Windows.Services;

public class SyncService : IDisposable
{
    public string Fingerprint { get; private set; } = "";
    public string PublicKeyBase64 { get; private set; } = "";

    private TcpListener? _listener;
    private ECDiffieHellman? _ecdh;

    public SyncService()
    {
        _ecdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var pubKey = _ecdh.PublicKey.ExportSubjectPublicKeyInfo();
        PublicKeyBase64 = Convert.ToBase64String(pubKey);

        var hash = SHA256.HashData(pubKey);
        Fingerprint = Convert.ToHexString(hash[..6]);
    }

    public int StartServer()
    {
        _listener = new TcpListener(IPAddress.Any, 0);
        _listener.Start();
        return ((IPEndPoint)_listener.LocalEndpoint).Port;
    }

    public async Task<SyncConnection> AcceptClientAsync()
    {
        var client = await _listener!.AcceptTcpClientAsync();
        return await PerformHandshakeAsync(client, isServer: true);
    }

    public async Task<SyncConnection> ConnectAsync(
        string host, int port, string serverPublicKeyB64, string expectedFingerprint)
    {
        var serverPubBytes = Convert.FromBase64String(serverPublicKeyB64);
        var hash = SHA256.HashData(serverPubBytes);
        var computedFp = Convert.ToHexString(hash[..6]);
        if (!string.Equals(computedFp, expectedFingerprint, StringComparison.OrdinalIgnoreCase))
            throw new SecurityException("بصمة المفتاح غير متطابقة — هجوم وسيط محتمل!");

        var client = new TcpClient();
        await client.ConnectAsync(host, port);
        return await PerformHandshakeAsync(client, isServer: false);
    }

    private async Task<SyncConnection> PerformHandshakeAsync(TcpClient client, bool isServer)
    {
        var stream = client.GetStream();

        var myPubB64 = Convert.ToBase64String(_ecdh!.PublicKey.ExportSubjectPublicKeyInfo());
        var myLine = Encoding.UTF8.GetBytes(myPubB64 + "\n");
        await stream.WriteAsync(myLine);

        var theirPubB64 = await ReadLineAsync(stream);
        if (string.IsNullOrEmpty(theirPubB64))
            throw new InvalidOperationException("فشل استلام المفتاح العام للجهاز الآخر");

        var theirPubBytes = Convert.FromBase64String(theirPubB64);
        using var theirEcdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        theirEcdh.ImportSubjectPublicKeyInfo(theirPubBytes, out _);

        var sharedSecret = _ecdh.DeriveKeyMaterial(theirEcdh.PublicKey);
        var aesKey = SHA256.HashData(sharedSecret);

        return new SyncConnection(client, aesKey);
    }

    private static async Task<string?> ReadLineAsync(NetworkStream stream)
    {
        var buf = new List<byte>();
        var byteBuf = new byte[1];
        while (true)
        {
            var read = await stream.ReadAsync(byteBuf);
            if (read == 0) break;
            if (byteBuf[0] == '\n') break;
            buf.Add(byteBuf[0]);
        }
        return buf.Count > 0 ? Encoding.UTF8.GetString(buf.ToArray()) : null;
    }

    public void Stop()
    {
        _listener?.Stop();
    }

    public void Dispose()
    {
        Stop();
        _ecdh?.Dispose();
    }
}

public class SyncConnection : IDisposable
{
    private readonly TcpClient _client;
    private readonly byte[] _aesKey;
    private readonly NetworkStream _stream;

    public SyncConnection(TcpClient client, byte[] aesKey)
    {
        _client = client;
        _aesKey = aesKey;
        _stream = client.GetStream();
    }

    public async Task SendAsync(byte[] data)
    {
        using var aes = new AesGcm(_aesKey);
        var iv = new byte[12];
        RandomNumberGenerator.Fill(iv);
        var ciphertext = new byte[data.Length];
        var tag = new byte[16];
        aes.Encrypt(iv, data, ciphertext, tag);

        var msg = new byte[1 + 12 + 4 + ciphertext.Length + 16];
        msg[0] = 12;
        Array.Copy(iv, 0, msg, 1, 12);
        BitConverter.TryWriteBytes(msg.AsSpan(13), ciphertext.Length + 16);
        Array.Copy(ciphertext, 0, msg, 17, ciphertext.Length);
        Array.Copy(tag, 0, msg, 17 + ciphertext.Length, 16);

        await _stream.WriteAsync(msg);
        await _stream.FlushAsync();
    }

    public async Task<byte[]> ReceiveAsync()
    {
        var header = new byte[17];
        await ReadExactAsync(_stream, header, 0, 17);

        var iv = header[1..13];
        var payloadLen = BitConverter.ToInt32(header, 13);

        var payload = new byte[payloadLen];
        await ReadExactAsync(_stream, payload, 0, payloadLen);

        var ciphertext = payload[..^16];
        var tag = payload[^16..];

        using var aes = new AesGcm(_aesKey);
        var plaintext = new byte[ciphertext.Length];
        aes.Decrypt(iv, ciphertext, tag, plaintext);
        return plaintext;
    }

    private static async Task<int> ReadExactAsync(NetworkStream stream, byte[] buffer, int offset, int count)
    {
        int totalRead = 0;
        while (totalRead < count)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset + totalRead, count - totalRead));
            if (read == 0) throw new EndOfStreamException("أُغلِق الاتصال");
            totalRead += read;
        }
        return totalRead;
    }

    public void Dispose() => _client.Dispose();
}
