using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ameen.Windows.Models;

namespace Ameen.Windows.Services;

public class WebSocketServer : IDisposable
{
    public string Fingerprint { get; private set; } = "";
    public string PublicKeyBase64 { get; private set; } = "";
    public bool IsRunning { get; private set; }

    public event Action<string>? PairRequested;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private TcpListener? _listener;
    private ECDiffieHellman? _ecdh;
    private readonly ExtensionMessageHandler _handler;
    private CancellationTokenSource? _cts;
    private readonly SemaphoreSlim _connectionLock = new(1, 1);
    private TaskCompletionSource<bool>? _pairConfirmationTcs;

    public WebSocketServer(ExtensionMessageHandler handler)
    {
        _handler = handler;
        _ecdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var pubKey = _ecdh.PublicKey.ExportSubjectPublicKeyInfo();
        PublicKeyBase64 = Convert.ToBase64String(pubKey);
        var hash = SHA256.HashData(pubKey);
        Fingerprint = Convert.ToHexString(hash[..6]);
    }

    public void Start()
    {
        if (IsRunning) return;
        _cts = new CancellationTokenSource();
        _listener = new TcpListener(IPAddress.Loopback, 9738);
        _listener.Start();
        IsRunning = true;
        _ = Task.Run(() => ListenLoopAsync(_cts.Token));
    }

    public void Stop()
    {
        if (!IsRunning) return;
        _cts?.Cancel();
        try { _listener?.Stop(); } catch { }
        IsRunning = false;
    }

    public void ConfirmPair(bool confirmed)
    {
        _pairConfirmationTcs?.TrySetResult(confirmed);
    }

    public void Dispose()
    {
        Stop();
        _cts?.Dispose();
        _ecdh?.Dispose();
        _connectionLock.Dispose();
    }

    private async Task ListenLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var client = await _listener!.AcceptTcpClientAsync(ct);
                _ = HandleClientAsync(client, ct);
            }
            catch (OperationCanceledException) { break; }
            catch (ObjectDisposedException) { break; }
            catch (SocketException) { break; }
            catch (Exception ex)
            {
                Debug.WriteLine($"خطأ في الاستماع: {ex.Message}");
            }
        }
    }

    private async Task HandleClientAsync(TcpClient client, CancellationToken ct)
    {
        if (!await _connectionLock.WaitAsync(0, ct))
        {
            try { client.Dispose(); } catch { }
            return;
        }

        bool isPaired = false;

        try
        {
            var stream = client.GetStream();

            var myPubB64 = Convert.ToBase64String(_ecdh!.PublicKey.ExportSubjectPublicKeyInfo());
            var myLine = Encoding.UTF8.GetBytes(myPubB64 + "\n");
            await stream.WriteAsync(myLine, ct);
            await stream.FlushAsync(ct);

            var theirPubB64 = await ReadLineAsync(stream, ct);
            if (string.IsNullOrEmpty(theirPubB64))
                return;

            var theirPubBytes = Convert.FromBase64String(theirPubB64);
            using var theirEcdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
            theirEcdh.ImportSubjectPublicKeyInfo(theirPubBytes, out _);

            var peerFingerprint = Convert.ToHexString(SHA256.HashData(theirPubBytes)[..6]);

            var sharedSecret = _ecdh.DeriveKeyMaterial(theirEcdh.PublicKey);
            var aesKey = SHA256.HashData(sharedSecret);

            while (!ct.IsCancellationRequested)
            {
                byte[] plaintext;
                try
                {
                    plaintext = await ReceiveEncryptedAsync(stream, aesKey, ct);
                }
                catch (EndOfStreamException) { break; }
                catch (IOException) { break; }
                catch (SocketException) { break; }

                var requestJson = Encoding.UTF8.GetString(plaintext);
                var request = JsonSerializer.Deserialize<ExtensionRequest>(requestJson, _jsonOptions);
                if (request == null) continue;

                ExtensionResponse response;

                if (request.Type == "pair")
                {
                    _pairConfirmationTcs = new TaskCompletionSource<bool>();
                    PairRequested?.Invoke(peerFingerprint);

                    try
                    {
                        isPaired = await _pairConfirmationTcs.Task.WaitAsync(TimeSpan.FromSeconds(120), ct);
                    }
                    catch (TimeoutException)
                    {
                        isPaired = false;
                    }

                    response = isPaired
                        ? new ExtensionResponse { Id = request.Id, Type = "paired" }
                        : new ExtensionResponse { Id = request.Id, Type = "error", Error = "تم رفض الاقتران" };
                }
                else if (!isPaired)
                {
                    response = new ExtensionResponse
                    {
                        Id = request.Id,
                        Type = "error",
                        Error = "يجب إقران الإضافة أولاً"
                    };
                }
                else
                {
                    response = _handler.Handle(request);
                }

                var responseJson = JsonSerializer.Serialize(response, _jsonOptions);
                var responseBytes = Encoding.UTF8.GetBytes(responseJson);

                try
                {
                    await SendEncryptedAsync(stream, aesKey, responseBytes, ct);
                }
                catch (IOException) { break; }
                catch (SocketException) { break; }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Debug.WriteLine($"خطأ في معالجة العميل: {ex.Message}");
        }
        finally
        {
            try { client.Dispose(); } catch { }
            _connectionLock.Release();
        }
    }

    private static async Task<byte[]> ReceiveEncryptedAsync(NetworkStream stream, byte[] aesKey, CancellationToken ct)
    {
        var header = new byte[17];
        await ReadExactAsync(stream, header, 0, 17, ct);

        var iv = header[1..13];
        var payloadLen = BitConverter.ToInt32(header, 13);

        var payload = new byte[payloadLen];
        await ReadExactAsync(stream, payload, 0, payloadLen, ct);

        var ciphertext = payload[..^16];
        var tag = payload[^16..];

        using var aes = new AesGcm(aesKey);
        var plaintext = new byte[ciphertext.Length];
        aes.Decrypt(iv, ciphertext, tag, plaintext);
        return plaintext;
    }

    private static async Task SendEncryptedAsync(NetworkStream stream, byte[] aesKey, byte[] data, CancellationToken ct)
    {
        using var aes = new AesGcm(aesKey);
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

        await stream.WriteAsync(msg, ct);
        await stream.FlushAsync(ct);
    }

    private static async Task<string?> ReadLineAsync(NetworkStream stream, CancellationToken ct)
    {
        var buf = new List<byte>();
        var byteBuf = new byte[1];
        while (true)
        {
            var read = await stream.ReadAsync(byteBuf.AsMemory(), ct);
            if (read == 0) break;
            if (byteBuf[0] == '\n') break;
            buf.Add(byteBuf[0]);
        }
        return buf.Count > 0 ? Encoding.UTF8.GetString(buf.ToArray()) : null;
    }

    private static async Task<int> ReadExactAsync(NetworkStream stream, byte[] buffer, int offset, int count, CancellationToken ct)
    {
        int totalRead = 0;
        while (totalRead < count)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset + totalRead, count - totalRead), ct);
            if (read == 0) throw new EndOfStreamException("أُغلِق الاتصال");
            totalRead += read;
        }
        return totalRead;
    }
}
