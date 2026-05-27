using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace Ameen.Windows.Services;

public class DiscoveryService : IDisposable
{
    private const int DiscoveryPort = 5355;
    private UdpClient? _udpClient;
    private CancellationTokenSource? _cts;

    public async Task<DiscoveredPeer?> DiscoverAsync(int timeoutMs = 5000)
    {
        _cts = new CancellationTokenSource();
        _udpClient = new UdpClient();
        _udpClient.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.Broadcast, true);
        _udpClient.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReceiveTimeout, timeoutMs);

        var request = Encoding.UTF8.GetBytes("AMEEN_DISCOVER");
        await _udpClient.SendAsync(request, new IPEndPoint(IPAddress.Broadcast, DiscoveryPort));

        try
        {
            var remoteEndPoint = new IPEndPoint(IPAddress.Any, 0);
            var response = await _udpClient.ReceiveAsync(_cts.Token);
            var json = Encoding.UTF8.GetString(response.Buffer);

            var peer = JsonSerializer.Deserialize<DiscoveredPeer>(json);
            if (peer != null)
            {
                peer.Host = ((IPEndPoint)response.RemoteEndPoint).Address.ToString();
                return peer;
            }
        }
        catch (OperationCanceledException) { }
        catch (SocketException) { }

        return null;
    }

    public void Dispose()
    {
        _cts?.Cancel();
        _udpClient?.Dispose();
    }
}

public class DiscoveredPeer
{
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string Fingerprint { get; set; } = "";
    public string PublicKey { get; set; } = "";
}
