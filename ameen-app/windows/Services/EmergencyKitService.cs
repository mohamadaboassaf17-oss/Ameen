using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace Ameen.Windows.Services;

/// <summary>
/// Encapsulates an Emergency Kit data payload.
/// </summary>
public class EmergencyKitData
{
    /// <summary>Profile display name</summary>
    public string ProfileName { get; set; } = string.Empty;
    /// <summary>Generated backup passphrase for recovery</summary>
    public string BackupPassphrase { get; set; } = string.Empty;
    /// <summary>When the kit was created</summary>
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    /// <summary>Hex-encoded wrapped key data for machine recovery (optional)</summary>
    public string? WrappedKeyJson { get; set; }
}

/// <summary>
/// Generates and prints the Emergency Kit PDF document.
/// </summary>
public class EmergencyKitService
{
    /// <summary>
    /// Generate a cryptographically secure backup passphrase.
    /// Produces 6 groups of 4 uppercase hex digits separated by hyphens.
    /// Example: "A4F7-B29E-C801-DD43-EE92-1BFC"
    /// </summary>
    public static string GenerateBackupPassphrase()
    {
        try
        {
            var bytes = RandomNumberGenerator.GetBytes(12);
            var groups = new List<string>();
            for (int i = 0; i < bytes.Length; i += 2)
            {
                groups.Add($"{bytes[i]:X2}{bytes[i + 1]:X2}");
            }
            return string.Join("-", groups);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmergencyKitService] Passphrase generation failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Create an Emergency Kit data object.
    /// </summary>
    public EmergencyKitData CreateKit(string profileName)
    {
        try
        {
            var kit = new EmergencyKitData
            {
                ProfileName = profileName,
                BackupPassphrase = GenerateBackupPassphrase(),
                CreatedAt = DateTime.Now,
            };

            Debug.WriteLine($"[EmergencyKitService] Emergency Kit created for: {profileName}");
            return kit;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmergencyKitService] Kit creation failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Generate the Emergency Kit as an HTML string (RTL, Arabic, print-optimized).
    /// </summary>
    public string GenerateKitHtml(EmergencyKitData kit)
    {
        try
        {
            var html = new StringBuilder();
            html.AppendLine("<!DOCTYPE html>");
            html.AppendLine("<html dir='rtl' lang='ar'>");
            html.AppendLine("<head>");
            html.AppendLine("<meta charset='UTF-8'>");
            html.AppendLine("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
            html.AppendLine("<title>طقم الطوارئ — أمين</title>");
            html.AppendLine("<style>");
            html.AppendLine("  @media print { body { margin: 0; } .no-print { display: none; } }");
            html.AppendLine("  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; ");
            html.AppendLine("         direction: rtl; text-align: right; max-width: 700px; margin: 40px auto; ");
            html.AppendLine("         padding: 20px; color: #1a1a1a; background: #fff; }");
            html.AppendLine("  .header { text-align: center; margin-bottom: 30px; }");
            html.AppendLine("  .header h1 { font-size: 28px; margin: 0; color: #1565C0; }");
            html.AppendLine("  .header .subtitle { font-size: 14px; color: #666; margin-top: 4px; }");
            html.AppendLine("  .warning { background: #FFF3E0; border-left: 4px solid #E65100; ");
            html.AppendLine("             padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; }");
            html.AppendLine("  .passphrase-box { background: #F5F5F5; border: 2px dashed #1565C0; ");
            html.AppendLine("                    padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }");
            html.AppendLine("  .passphrase { font-family: 'Consolas', 'Courier New', monospace; ");
            html.AppendLine("               font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #0D47A1; }");
            html.AppendLine("  .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }");
            html.AppendLine("  .info-table td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }");
            html.AppendLine("  .info-table td:first-child { font-weight: bold; color: #555; width: 140px; }");
            html.AppendLine("  .instructions { margin: 30px 0; line-height: 1.8; }");
            html.AppendLine("  .instructions ol { padding-right: 20px; }");
            html.AppendLine("  .footer { text-align: center; font-size: 11px; color: #999; margin-top: 40px; ");
            html.AppendLine("            border-top: 1px solid #e0e0e0; padding-top: 16px; }");
            html.AppendLine("  .print-btn { display: block; width: 200px; margin: 20px auto; padding: 12px; ");
            html.AppendLine("              background: #1565C0; color: white; border: none; border-radius: 6px; ");
            html.AppendLine("              font-size: 16px; cursor: pointer; }");
            html.AppendLine("</style>");
            html.AppendLine("</head>");
            html.AppendLine("<body>");

            html.AppendLine("<div class='header'>");
            html.AppendLine("  <h1>&#x1F510; أمين — طقم الطوارئ</h1>");
            html.AppendLine($"  <div class='subtitle'>تم إنشاؤه بتاريخ: {kit.CreatedAt:yyyy/MM/dd HH:mm}</div>");
            html.AppendLine("</div>");

            html.AppendLine("<div class='warning'>");
            html.AppendLine("  &#x26A0;&#xFE0F; <strong>تحذير أمني:</strong> احتفظ بهذا المستند في مكان آمن جداً. ");
            html.AppendLine("  أي شخص يطلع على كلمة مرور الطوارئ يمكنه الوصول إلى جميع بيانات خزنتك. ");
            html.AppendLine("  يُنصح بالاحتفاظ به في مكان مادي آمن (خزنة، درج مقفل) وليس على جهاز الكمبيوتر.");
            html.AppendLine("</div>");

            html.AppendLine("<table class='info-table'>");
            html.AppendLine($"  <tr><td>الملف الشخصي</td><td>{EscapeHtml(kit.ProfileName)}</td></tr>");
            html.AppendLine($"  <tr><td>تاريخ الإنشاء</td><td>{kit.CreatedAt:yyyy/MM/dd}</td></tr>");
            html.AppendLine($"  <tr><td>التطبيق</td><td>أمين (Ameen) — مدير كلمات المرور</td></tr>");
            html.AppendLine("</table>");

            html.AppendLine("<h2 style='margin-top: 30px;'>&#x1F511; كلمة مرور الطوارئ</h2>");
            html.AppendLine("<p>اكتب كلمة المرور هذه بالضبط (بما في ذلك الشرطات) واحتفظ بها عند الحاجة لاستعادة خزنتك.</p>");
            html.AppendLine("<div class='passphrase-box'>");
            html.AppendLine($"  <div class='passphrase'>{EscapeHtml(kit.BackupPassphrase)}</div>");
            html.AppendLine("</div>");

            html.AppendLine("<div class='instructions'>");
            html.AppendLine("  <h2>&#x1F4CB; تعليمات الاستخدام</h2>");
            html.AppendLine("  <ol>");
            html.AppendLine("    <li><strong>اطبع هذا المستند</strong> واحتفظ بالنسخة المطبوعة في مكان آمن.</li>");
            html.AppendLine("    <li>إذا نسيت كلمة المرور الرئيسية، افتح تطبيق أمين واختر <strong>\"استعادة بخزنة الطوارئ\"</strong>.</li>");
            html.AppendLine("    <li>أدخل <strong>كلمة مرور الطوارئ</strong> الموضحة أعلاه.</li>");
            html.AppendLine("    <li>سيقوم التطبيق بفك تشفير خزنتك وسيُطلب منك تعيين كلمة مرور رئيسية جديدة.</li>");
            html.AppendLine("    <li>بعد الاستعادة، <strong>اصنع طقم طوارئ جديد</strong> لأن كلمة المرور القديمة لن تعمل.</li>");
            html.AppendLine("    <li>احذف هذا الطقم القديم فوراً بعد إنشاء الطقم الجديد.</li>");
            html.AppendLine("  </ol>");
            html.AppendLine("</div>");

            html.AppendLine("<div class='instructions'>");
            html.AppendLine("  <h2>&#x1F6E1;&#xFE0F; ملاحظات أمنية</h2>");
            html.AppendLine("  <ul>");
            html.AppendLine("    <li>جميع بيانات خزنتك مشفرة محلياً على جهازك فقط — لا توجد خوادم سحابية.</li>");
            html.AppendLine("    <li>كلمة مرور الطوارئ تمنح وصولاً كاملاً — تعامل معها كأهم سر لديك.</li>");
            html.AppendLine("    <li>لا تشارك كلمة مرور الطوارئ مع أي شخص.</li>");
            html.AppendLine("    <li>لا تخزن كلمة مرور الطوارئ في ملفات رقمية غير مشفرة.</li>");
            html.AppendLine("  </ul>");
            html.AppendLine("</div>");

            html.AppendLine("<button class='print-btn no-print' onclick='window.print()'>&#x1F5A8;&#xFE0F; طباعة الطقم</button>");

            html.AppendLine("<div class='footer'>");
            html.AppendLine("  أمين (Ameen) — مدير كلمات مرور مجاني ومفتوح المصدر | Zero-Knowledge Architecture");
            html.AppendLine("</div>");

            html.AppendLine("</body>");
            html.AppendLine("</html>");

            return html.ToString();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmergencyKitService] HTML generation failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Save the Emergency Kit HTML to a temporary file and open in browser for printing.
    /// </summary>
    public async Task<string?> SaveAndOpenKitAsync(EmergencyKitData kit)
    {
        try
        {
            var html = GenerateKitHtml(kit);
            var fileName = $"Ameen_EmergencyKit_{kit.ProfileName}_{kit.CreatedAt:yyyyMMdd}.html";
            var tempPath = Path.Combine(Path.GetTempPath(), fileName);

            await File.WriteAllTextAsync(tempPath, html, Encoding.UTF8);

            Debug.WriteLine($"[EmergencyKitService] Emergency Kit saved to: {tempPath}");

            try
            {
                System.Diagnostics.Process.Start(new ProcessStartInfo
                {
                    FileName = tempPath,
                    UseShellExecute = true,
                });
            }
            catch
            {
                Debug.WriteLine("[EmergencyKitService] Could not open browser — file saved to temp.");
            }

            return tempPath;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmergencyKitService] SaveAndOpen failed: {ex.Message}");
            throw;
        }
    }

    private static string EscapeHtml(string text)
    {
        return text
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;");
    }
}
