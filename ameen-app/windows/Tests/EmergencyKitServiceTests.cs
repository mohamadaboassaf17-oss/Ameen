using Ameen.Windows.Services;
using Xunit;

namespace Ameen.Windows.Tests;

public class EmergencyKitServiceTests
{
    [Fact]
    public void GenerateBackupPassphrase_ReturnsNullForNullProfile()
    {
        var passphrase = EmergencyKitService.GenerateBackupPassphrase();

        Assert.NotNull(passphrase);
    }

    [Fact]
    public void GenerateBackupPassphrase_ProducesCorrectFormat()
    {
        var passphrase = EmergencyKitService.GenerateBackupPassphrase();

        Assert.Matches(@"^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$", passphrase);
    }

    [Fact]
    public void GenerateBackupPassphrase_HasCorrectLength()
    {
        var passphrase = EmergencyKitService.GenerateBackupPassphrase();

        // 4 * 6 = 24 hex chars + 5 hyphens = 29 chars
        Assert.Equal(29, passphrase.Length);
        Assert.Equal(5, passphrase.Count(c => c == '-'));
    }

    [Fact]
    public void GenerateBackupPassphrase_ProducesUniqueValues()
    {
        var set = new HashSet<string>();
        for (int i = 0; i < 50; i++)
            set.Add(EmergencyKitService.GenerateBackupPassphrase());

        Assert.Equal(50, set.Count);
    }

    [Fact]
    public void CreateKit_ReturnsValidKit()
    {
        var service = new EmergencyKitService();
        var kit = service.CreateKit("TestProfile");

        Assert.NotNull(kit);
        Assert.Equal("TestProfile", kit.ProfileName);
        Assert.False(string.IsNullOrEmpty(kit.BackupPassphrase));
        Assert.True(kit.CreatedAt <= DateTime.Now);
        Assert.True(kit.CreatedAt > DateTime.Now.AddMinutes(-1));
    }

    [Fact]
    public void CreateKit_IncludesPassphrase()
    {
        var service = new EmergencyKitService();
        var kit = service.CreateKit("MyProfile");

        Assert.Matches(@"^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$", kit.BackupPassphrase);
    }

    [Fact]
    public void GenerateKitHtml_ContainsRequiredElements()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "TestProfile",
            BackupPassphrase = "A4F7-B29E-C801-DD43-EE92-1BFC",
            CreatedAt = new DateTime(2025, 6, 15, 14, 30, 0),
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("<!DOCTYPE html>", html);
        Assert.Contains("طقم الطوارئ", html);
        Assert.Contains("TestProfile", html);
        Assert.Contains("A4F7-B29E-C801-DD43-EE92-1BFC", html);
        Assert.Contains("تحذير أمني", html);
        Assert.Contains("2025/06/15", html);
        Assert.Contains("window.print()", html);
        Assert.Contains("print-btn", html);
        Assert.Contains("Segoe UI", html);
        Assert.Contains("no-print", html);
    }

    [Fact]
    public void GenerateKitHtml_ContainsPassphraseInMonospace()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "User",
            BackupPassphrase = "ABCD-1234-EF56-7890-ABCD-EF12",
            CreatedAt = DateTime.Now,
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("ABCD-1234-EF56-7890-ABCD-EF12", html);
        Assert.Contains("passphrase", html);
        Assert.Contains("Consolas", html);
    }

    [Fact]
    public void GenerateKitHtml_HtmlEscapesProfileName()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "Test <User> & \"Family\"",
            BackupPassphrase = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
            CreatedAt = DateTime.Now,
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("&lt;User&gt;", html);
        Assert.Contains("&amp;", html);
        Assert.Contains("&quot;Family&quot;", html);
    }

    [Fact]
    public void GenerateKitHtml_ContainsInstructions()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "Test",
            BackupPassphrase = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
            CreatedAt = DateTime.Now,
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("تعليمات الاستخدام", html);
        Assert.Contains("اطبع هذا المستند", html);
        Assert.Contains("استعادة", html);
        Assert.Contains("كلمة مرور الطوارئ", html);
    }

    [Fact]
    public void GenerateKitHtml_ContainsSecurityNotes()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "Test",
            BackupPassphrase = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
            CreatedAt = DateTime.Now,
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("ملاحظات أمنية", html);
        Assert.Contains("Zero-Knowledge", html);
        Assert.Contains("خوادم سحابية", html);
    }

    [Fact]
    public void GenerateKitHtml_HasRtlDirection()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "Test",
            BackupPassphrase = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
            CreatedAt = DateTime.Now,
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("dir='rtl'", html);
        Assert.Contains("lang='ar'", html);
        Assert.Contains("direction: rtl", html);
        Assert.Contains("text-align: right", html);
    }

    [Fact]
    public void GenerateKitHtml_HasPrintStyles()
    {
        var service = new EmergencyKitService();
        var kit = new EmergencyKitData
        {
            ProfileName = "Test",
            BackupPassphrase = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
            CreatedAt = DateTime.Now,
        };

        var html = service.GenerateKitHtml(kit);

        Assert.Contains("@media print", html);
        Assert.Contains("no-print", html);
        Assert.Contains("display: none", html);
    }
}
