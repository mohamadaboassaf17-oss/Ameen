using System;
using Microsoft.Maui.Dispatching;

namespace Ameen.Windows.Services;

public class AutoLockService
{
    private readonly Action _onLock;
    private IDispatcherTimer? _timer;
    private bool _lockFired;

    public AutoLockService(Action onLock)
    {
        _onLock = onLock ?? throw new ArgumentNullException(nameof(onLock));
    }

    public void StartTimer()
    {
        var minutes = Preferences.Default.Get("auto_lock_minutes", 5);
        if (minutes <= 0) return;

        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher == null) return;

        StopTimer();
        _lockFired = false;

        _timer = dispatcher.CreateTimer();
        _timer.Interval = TimeSpan.FromMinutes(minutes);
        _timer.Tick += (_, _) =>
        {
            _lockFired = true;
            _onLock();
        };
        _timer.Start();
    }

    public void ResetTimer()
    {
        if (_lockFired) return;
        StartTimer();
    }

    public void StopTimer()
    {
        _timer?.Stop();
        _timer = null;
    }

    public void OnAppBackground()
    {
        var lockOnBackground = Preferences.Default.Get("auto_lock_on_background", true);
        if (lockOnBackground && !_lockFired)
        {
            _lockFired = true;
            StopTimer();
            _onLock();
        }
    }

    public void OnAppForeground()
    {
        if (!_lockFired)
        {
            ResetTimer();
        }
    }

    public void SetLockMinutes(int minutes)
    {
        Preferences.Default.Set("auto_lock_minutes", minutes);
        if (minutes <= 0)
        {
            StopTimer();
        }
        else
        {
            StartTimer();
        }
    }
}
