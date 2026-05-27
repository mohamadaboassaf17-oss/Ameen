using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace Ameen.Windows.Services;

public class TrayIconService : IDisposable
{
    private NotifyIcon? _notifyIcon;
    private ContextMenuStrip? _contextMenu;
    private ToolStripMenuItem? _quickCopyMenu;
    private ToolStripMenuItem? _lockItem;
    private Thread? _messagePumpThread;

    public event Action? LockRequested;
    public event Action? ShowRequested;
    public event Action<string, string, QuickCopyField>? QuickCopyRequested;

    public void Initialize()
    {
        _messagePumpThread = new Thread(RunMessagePump)
        {
            IsBackground = true,
            Name = "Ameen-TrayIcon"
        };
        _messagePumpThread.SetApartmentState(ApartmentState.STA);
        _messagePumpThread.Start();
    }

    private void RunMessagePump()
    {
        try
        {
            _contextMenu = new ContextMenuStrip();

            var showItem = new ToolStripMenuItem("فتح أمين");
            showItem.Click += (_, _) => ShowRequested?.Invoke();
            _contextMenu.Items.Add(showItem);

            _contextMenu.Items.Add(new ToolStripSeparator());

            _lockItem = new ToolStripMenuItem("قفل الخزنة 🔒");
            _lockItem.Click += (_, _) => LockRequested?.Invoke();
            _contextMenu.Items.Add(_lockItem);

            _contextMenu.Items.Add(new ToolStripSeparator());

            _quickCopyMenu = new ToolStripMenuItem("نسخ سريع");
            _quickCopyMenu.Enabled = false;
            _contextMenu.Items.Add(_quickCopyMenu);

            _contextMenu.Items.Add(new ToolStripSeparator());

            var exitItem = new ToolStripMenuItem("خروج");
            exitItem.Click += (_, _) => Environment.Exit(0);
            _contextMenu.Items.Add(exitItem);

            _notifyIcon = new NotifyIcon
            {
                Icon = CreateProgrammaticIcon(),
                Text = "أمين — Ameen",
                ContextMenuStrip = _contextMenu,
                Visible = true
            };
            _notifyIcon.DoubleClick += (_, _) => ShowRequested?.Invoke();

            Application.Run();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"خطأ في أيقونة العلبة: {ex.Message}");
            _notifyIcon?.Dispose();
            _notifyIcon = null;
            _contextMenu?.Dispose();
            _contextMenu = null;
        }
    }

    public void ShowLockState(bool isLocked)
    {
        if (_lockItem == null) return;
        _lockItem.Text = isLocked ? "الخزنة مقفلة 🔒" : "قفل الخزنة 🔒";
    }

    public void UpdateOtpDisplay(string otpCode)
    {
        if (_quickCopyMenu == null || !_quickCopyMenu.Enabled) return;

        var displayText = $"رمز التحقق: {otpCode}";

        foreach (ToolStripMenuItem itemMenu in _quickCopyMenu.DropDownItems)
        {
            foreach (ToolStripMenuItem subItem in itemMenu.DropDownItems)
            {
                if (subItem.Text.StartsWith("رمز التحقق:"))
                {
                    subItem.Text = displayText;
                }
            }
        }
    }

    public void UpdateRecentItems(List<QuickCopyItem> items)
    {
        if (_quickCopyMenu == null) return;

        _quickCopyMenu.DropDownItems.Clear();
        _quickCopyMenu.Enabled = items.Count > 0;

        foreach (var item in items)
        {
            var itemMenu = new ToolStripMenuItem(item.Title);

            if (!string.IsNullOrWhiteSpace(item.Username))
            {
                var copyUser = new ToolStripMenuItem("نسخ اسم المستخدم");
                copyUser.Click += (_, _) =>
                    QuickCopyRequested?.Invoke(item.Title, item.Username, QuickCopyField.Username);
                itemMenu.DropDownItems.Add(copyUser);
            }

            if (!string.IsNullOrWhiteSpace(item.Password))
            {
                var copyPass = new ToolStripMenuItem("نسخ كلمة المرور");
                copyPass.Click += (_, _) =>
                    QuickCopyRequested?.Invoke(item.Title, item.Password, QuickCopyField.Password);
                itemMenu.DropDownItems.Add(copyPass);
            }

            if (!string.IsNullOrWhiteSpace(item.OtpCode))
            {
                var copyOtp = new ToolStripMenuItem("رمز التحقق");
                copyOtp.Click += (_, _) =>
                    QuickCopyRequested?.Invoke(item.Title, item.OtpCode, QuickCopyField.Otp);
                itemMenu.DropDownItems.Add(copyOtp);
            }

            _quickCopyMenu.DropDownItems.Add(itemMenu);
        }
    }

    public void ShowBalloonTip(string title, string text)
    {
        try
        {
            _notifyIcon?.ShowBalloonTip(3000, title, text, ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"خطأ في إشعار العلبة: {ex.Message}");
        }
    }

    public void Dispose()
    {
        try
        {
            _notifyIcon?.Dispose();
            _notifyIcon = null;
            _contextMenu?.Dispose();
            _contextMenu = null;
            Application.ExitThread();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"خطأ في تنظيف أيقونة العلبة: {ex.Message}");
        }
    }

    private static Icon CreateProgrammaticIcon()
    {
        var bitmap = new Bitmap(32, 32);
        using var g = Graphics.FromImage(bitmap);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Color.Transparent);

        using var circleBrush = new SolidBrush(Color.FromArgb(0, 122, 204));
        g.FillEllipse(circleBrush, 0, 0, 32, 32);

        using var font = new Font("Segoe UI", 18, FontStyle.Bold, GraphicsUnit.Pixel);
        using var textBrush = new SolidBrush(Color.White);
        using var sf = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center
        };
        g.DrawString("A", font, textBrush, new RectangleF(0, 0, 32, 32), sf);

        var hIcon = bitmap.GetHicon();
        var icon = (Icon)Icon.FromHandle(hIcon).Clone();
        DestroyIcon(hIcon);
        bitmap.Dispose();
        return icon;
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern bool DestroyIcon(IntPtr handle);
}

public class QuickCopyItem
{
    public string Title { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string OtpCode { get; set; } = "";
}

public enum QuickCopyField
{
    Username,
    Password,
    Otp
}
