using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Ameen.Windows.Services;

public class ClipboardService
{
    private IDispatcherTimer? _clearTimer;

    public int ClearDelaySeconds
    {
        get => Preferences.Default.Get("clipboard_clear_seconds", 30);
        set => Preferences.Default.Set("clipboard_clear_seconds", value);
    }

    public bool HasPendingClear => _clearTimer != null;

    public event Action? ClipboardAboutToClear;

    public async Task CopyToClipboard(string text)
    {
        await Clipboard.Default.SetTextAsync(text);
    }

    public void ClearClipboardAfterDelay(int seconds = 30)
    {
        ClearTimer();
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher == null) return;

        _clearTimer = dispatcher.CreateTimer();
        _clearTimer.Interval = TimeSpan.FromSeconds(seconds);
        _clearTimer.Tick += async (_, _) =>
        {
            await ClearClipboard();
            ClearTimer();
        };
        _clearTimer.Start();
    }

    public void ScheduleBackgroundClear()
    {
        var delay = ClearDelaySeconds;
        if (delay <= 0) return;
        ClearClipboardAfterDelay(delay);

        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher == null) return;

        var warningDelay = Math.Max(3, delay - 3);
        var warningTimer = dispatcher.CreateTimer();
        warningTimer.Interval = TimeSpan.FromSeconds(warningDelay);
        warningTimer.Tick += (_, _) =>
        {
            ClipboardAboutToClear?.Invoke();
            warningTimer.Stop();
        };
        warningTimer.Start();
    }

    public void OnAppBackground()
    {
        if (_clearTimer != null)
        {
            ClearTimer();
            Clipboard.Default.SetTextAsync(string.Empty);
        }
    }

    public async Task ClearClipboard()
    {
        ClearTimer();
        try
        {
            await Clipboard.Default.SetTextAsync(string.Empty);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"خطأ في مسح الحافظة: {ex.Message}");
        }
    }

    public void CancelAutoClear()
    {
        ClearTimer();
    }

    private void ClearTimer()
    {
        _clearTimer?.Stop();
        _clearTimer = null;
    }
}
