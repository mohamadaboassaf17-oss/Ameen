using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Ameen.Windows.Services;

public static class ScreenCaptureProtectionService
{
    private const uint WDA_NONE = 0x00000000;
    private const uint WDA_MONITOR = 0x00000001;

    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint dwAffinity);

    public static bool EnableProtection(IntPtr hwnd)
    {
        try
        {
            return SetWindowDisplayAffinity(hwnd, WDA_MONITOR);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"فشل تفعيل حماية التقاط الشاشة: {ex.Message}");
            return false;
        }
    }

    public static bool DisableProtection(IntPtr hwnd)
    {
        try
        {
            return SetWindowDisplayAffinity(hwnd, WDA_NONE);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"فشل إلغاء حماية التقاط الشاشة: {ex.Message}");
            return false;
        }
    }

    public static List<string> IsScreenRecording()
    {
        var detected = new List<string>();
        var knownRecorders = new[]
        {
            "obs64", "obs32", "obs",
            "slobs", "slobs64",
            "bdcam", "bdcam64",
            "GameBar", "GameBarFTServer",
            "Discord", "discord",
            "xsplit.core", "xsplit",
            "streamlabs", "Streamlabs Desktop",
            "fraps", "fraps64",
            "bandicam", "bdcap64",
            "action", "action_x64"
        };

        foreach (var name in knownRecorders)
        {
            try
            {
                var processes = Process.GetProcessesByName(name);
                if (processes.Length > 0)
                {
                    detected.Add(name);
                }
            }
            catch
            {
            }
        }

        return detected;
    }

    public static string ShowCaptureWarning()
    {
        return "⚠️ تحذير: قد يكون هناك برنامج لتسجيل الشاشة يعمل حاليًا. يرجى إغلاقه قبل عرض البيانات الحساسة.";
    }
}
