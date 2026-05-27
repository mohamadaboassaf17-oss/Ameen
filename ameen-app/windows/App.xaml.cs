using Ameen.Windows.Services;
using Ameen.Windows.Models;

namespace Ameen.Windows;

public partial class App : Application
{
    public readonly TrayIconService Tray = new();
    public readonly ClipboardService Clipboard = new();
    public readonly ExtensionMessageHandler ExtensionHandler = new();
    public readonly AutoLockService AutoLock;
    private bool _isVaultLocked = true;

    private WebSocketServer? _extensionServer;

    public static new App Current => (App)Application.Current!;

    public App()
    {
        InitializeComponent();
        AutoLock = new AutoLockService(() => MainThread.BeginInvokeOnMainThread(LockVault));
        InitializeTray();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var window = new Window(new AppShell())
        {
            Title = "Ameen — Windows",
            MinimumWidth = 400,
            MinimumHeight = 600
        };

        window.Activated += (_, _) =>
        {
            if (!_isVaultLocked) AutoLock.OnAppForeground();
        };
        window.Deactivated += (_, _) =>
        {
            AutoLock.OnAppBackground();
            Clipboard.OnAppBackground();
        };

        window.Created += (_, _) =>
        {
            try
            {
                var nativeWindow = window.Handler?.PlatformView as Microsoft.UI.Xaml.Window;
                if (nativeWindow != null)
                {
                    var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(nativeWindow);
                    ScreenCaptureProtectionService.EnableProtection(hwnd);
                }
            }
            catch { /* protection is best-effort on older Windows versions */ }
        };

        window.Destroying += (_, _) =>
        {
            AutoLock.StopTimer();
            Tray.Dispose();
        };
        return window;
    }

    /// <summary>
    /// Returns the current Windows user identity for account isolation checks.
    /// Used when adding family members to ensure true account separation per PRD §3.2.
    /// </summary>
    public string GetCurrentWindowsUser()
    {
        return System.Security.Principal.WindowsIdentity.GetCurrent().Name;
    }

    public void LockVault()
    {
        if (_isVaultLocked) return;
        _isVaultLocked = true;
        AutoLock.StopTimer();
        Tray.ShowLockState(true);

        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                var window = Windows.OfType<Window>().FirstOrDefault();
                var nav = window?.Page?.Navigation;
                if (nav != null)
                {
                    while (nav.ModalStack.Count > 0)
                        await nav.PopModalAsync(false);
                }
            }
            catch { }
        });
    }

    public void UnlockVault()
    {
        if (!_isVaultLocked) return;
        _isVaultLocked = false;
        AutoLock.StartTimer();
        Tray.ShowLockState(false);
    }

    public void UpdateTrayRecentItems(List<VaultItem> vaultItems)
    {
        var items = new List<QuickCopyItem>();
        foreach (var vi in vaultItems.Take(10))
        {
            var otp = "";
            if (!string.IsNullOrWhiteSpace(vi.OtpSecret))
            {
                otp = TotpHelper.GenerateCode(vi.OtpSecret);
            }

            items.Add(new QuickCopyItem
            {
                Title = vi.Title,
                Username = vi.Username ?? "",
                Password = vi.Password ?? "",
                OtpCode = otp
            });
        }
        Tray.UpdateRecentItems(items);
    }

    public void StartExtensionServer(List<VaultItem> items)
    {
        StopExtensionServer();
        _extensionServer = new WebSocketServer(ExtensionHandler);
        _extensionServer.PairRequested += OnExtensionPairRequested;
        ExtensionHandler.SetVaultData(items);
        _extensionServer.Start();
    }

    public void StopExtensionServer()
    {
        if (_extensionServer != null)
        {
            _extensionServer.PairRequested -= OnExtensionPairRequested;
            _extensionServer.Stop();
            _extensionServer.Dispose();
            _extensionServer = null;
        }
    }

    public void UpdateExtensionVaultData(List<VaultItem> items)
    {
        ExtensionHandler.SetVaultData(items);
    }

    private void OnExtensionPairRequested(string fingerprint)
    {
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                var window = Windows.OfType<Window>().FirstOrDefault();
                var page = window?.Page;
                if (page != null)
                {
                    var confirmed = await page.DisplayAlert(
                        "تأكيد الاقتران",
                        $"بصمة الإضافة: {fingerprint}\n\nهل تريد السماح لهذه الإضافة بالاتصال؟",
                        "سماح", "رفض");
                    _extensionServer?.ConfirmPair(confirmed);
                }
                else
                {
                    _extensionServer?.ConfirmPair(false);
                }
            }
            catch
            {
                _extensionServer?.ConfirmPair(false);
            }
        });
    }

    private void InitializeTray()
    {
        Tray.ShowRequested += OnTrayShowRequested;
        Tray.LockRequested += OnTrayLockRequested;
        Tray.QuickCopyRequested += OnTrayQuickCopy;
        Tray.Initialize();
    }

    private void OnTrayShowRequested()
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            try
            {
                var window = Windows.OfType<Window>().FirstOrDefault();
                var nativeWindow = window?.Handler?.PlatformView as Microsoft.UI.Xaml.Window;
                nativeWindow?.Activate();
            }
            catch
            {
            }
        });
    }

    private void OnTrayLockRequested()
    {
        LockVault();
        Tray.ShowBalloonTip("أمين", "تم قفل الخزنة بنجاح");
    }

    private async void OnTrayQuickCopy(string title, string value, QuickCopyField field)
    {
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                await Clipboard.CopyToClipboard(value);
                Clipboard.ClearClipboardAfterDelay(30);

                var fieldName = field switch
                {
                    QuickCopyField.Username => "اسم المستخدم",
                    QuickCopyField.Password => "كلمة المرور",
                    QuickCopyField.Otp => "OTP",
                    _ => "القيمة"
                };

                Tray.ShowBalloonTip(title, $"تم نسخ {fieldName} — سيتم المسح بعد ٣٠ ثانية");
            }
            catch
            {
            }
        });
    }
}
