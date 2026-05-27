using Ameen.Windows.Services;

namespace Ameen.Windows.Pages;

public partial class PairingPage : ContentPage
{
    private readonly string _ownFingerprint;
    private readonly string _remoteFingerprint;
    private readonly SyncConnection? _connection;

    public bool Confirmed { get; private set; }
    public SyncConnection? Connection => _connection;

    public PairingPage(string ownFingerprint, string remoteFingerprint, SyncConnection? connection = null)
    {
        InitializeComponent();
        _ownFingerprint = ownFingerprint;
        _remoteFingerprint = remoteFingerprint;
        _connection = connection;

        OwnFingerprintLabel.Text = FormatFingerprint(ownFingerprint);
        RemoteFingerprintLabel.Text = FormatFingerprint(remoteFingerprint);
    }

    private async void OnConfirmClicked(object sender, EventArgs e)
    {
        Confirmed = true;
        await Navigation.PopModalAsync(true);
    }

    private async void OnCancelClicked(object sender, EventArgs e)
    {
        _connection?.Dispose();
        Confirmed = false;
        await Navigation.PopModalAsync(false);
    }

    private static string FormatFingerprint(string fp)
    {
        if (fp.Length != 12) return fp;
        return string.Join(" ", Enumerable.Range(0, 6).Select(i => fp.Substring(i * 2, 2)));
    }
}
