using System.Diagnostics;
using System.Text;
using Ameen.Windows.Models;

namespace Ameen.Windows.Services;

public enum CsvFormat
{
    Unknown,
    Chrome,
    Firefox,
    Edge,
    Safari,
    Ameen,
}

public class CsvImportResult
{
    public List<VaultItem> Items { get; set; } = new();
    public CsvFormat DetectedFormat { get; set; }
    public int TotalRows { get; set; }
    public int ImportedRows { get; set; }
    public int SkippedRows { get; set; }
}

public class CsvImportService
{
    /// <summary>
    /// Import vault items from a CSV file by auto-detecting the format.
    /// </summary>
    public async Task<CsvImportResult> ImportFromFileAsync()
    {
        try
        {
            var result = await FilePicker.Default.PickAsync(new PickOptions
            {
                PickerTitle = "اختر ملف CSV للاستيراد",
                FileTypes = new FilePickerFileType(new Dictionary<DevicePlatform, IEnumerable<string>>
                {
                    { DevicePlatform.WinUI, new[] { ".csv" } },
                }),
            });

            if (result == null)
            {
                Debug.WriteLine("[CsvImportService] File picker cancelled.");
                return new CsvImportResult();
            }

            var csvText = await File.ReadAllTextAsync(result.FullPath, Encoding.UTF8);
            return ParseCsv(csvText);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[CsvImportService] Import failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Parse CSV text and convert to VaultItem list.
    /// </summary>
    public CsvImportResult ParseCsv(string csvText)
    {
        var result = new CsvImportResult();

        try
        {
            var lines = csvText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            if (lines.Length < 2)
            {
                Debug.WriteLine("[CsvImportService] CSV has no data rows.");
                return result;
            }

            // Detect format from header
            var headerFields = SplitCsvLine(lines[0]);
            var format = DetectFormat(headerFields);
            result.DetectedFormat = format;

            if (format == CsvFormat.Unknown)
            {
                Debug.WriteLine("[CsvImportService] Unknown CSV format.");
                return result;
            }

            var now = DateTime.Now;

            for (int i = 1; i < lines.Length; i++)
            {
                result.TotalRows++;
                var fields = SplitCsvLine(lines[i]);
                if (fields.Length == 0) continue;

                var item = MapToVaultItem(fields, headerFields, format, now);
                if (item != null)
                {
                    result.Items.Add(item);
                    result.ImportedRows++;
                }
                else
                {
                    result.SkippedRows++;
                }
            }

            Debug.WriteLine($"[CsvImportService] Imported {result.ImportedRows} items ({format}), skipped {result.SkippedRows}.");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[CsvImportService] Parse error: {ex.Message}");
            throw;
        }

        return result;
    }

    private static CsvFormat DetectFormat(string[] headers)
    {
        var normalized = headers.Select(h => h.Trim().ToLowerInvariant().Replace(" ", "_")).ToArray();
        var key = string.Join("_", normalized);

        return key switch
        {
            "name_url_username_password" => CsvFormat.Chrome,
            "url_username_password_httprealm_formactionorigin_guid_timecreated_timepasswordchanged" => CsvFormat.Firefox,
            "name_url_username_password_note" => CsvFormat.Edge,
            "title_url_username_password_otpauth" => CsvFormat.Safari,
            "id_type_title_username_password_url_content_cardholder_number_expiry_cvv_notes_otpsecret" => CsvFormat.Ameen,
            _ => CsvFormat.Unknown,
        };
    }

    private static VaultItem? MapToVaultItem(
        string[] fields,
        string[] headers,
        CsvFormat format,
        DateTime now)
    {
        string GetField(string name)
        {
            var n = name.ToLowerInvariant().Replace(" ", "_");
            var idx = Array.FindIndex(headers, h => h.Trim().ToLowerInvariant().Replace(" ", "_") == n);
            return idx >= 0 && idx < fields.Length ? fields[idx].Trim() : string.Empty;
        }

        string title = string.Empty;
        string username = string.Empty;
        string password = string.Empty;
        string url = string.Empty;
        string notes = string.Empty;
        string otpSecret = string.Empty;

        switch (format)
        {
            case CsvFormat.Chrome:
                title = GetField("name");
                url = GetField("url");
                username = GetField("username");
                password = GetField("password");
                break;
            case CsvFormat.Firefox:
                url = GetField("url");
                username = GetField("username");
                password = GetField("password");
                title = string.IsNullOrEmpty(url) ? username : url;
                break;
            case CsvFormat.Edge:
                title = GetField("name");
                url = GetField("url");
                username = GetField("username");
                password = GetField("password");
                notes = GetField("note");
                break;
            case CsvFormat.Safari:
                title = GetField("title");
                url = GetField("url");
                username = GetField("username");
                password = GetField("password");
                otpSecret = GetField("otpauth");
                break;
            case CsvFormat.Ameen:
                title = GetField("title");
                username = GetField("username");
                password = GetField("password");
                url = GetField("url");
                notes = GetField("notes");
                otpSecret = GetField("otpsecret");
                break;
        }

        if (string.IsNullOrEmpty(title) && string.IsNullOrEmpty(username) &&
            string.IsNullOrEmpty(password) && string.IsNullOrEmpty(url))
            return null;

        return new VaultItem
        {
            Id = Guid.NewGuid().ToString("N")[..12],
            Type = "password",
            Title = !string.IsNullOrEmpty(title) ? title : (!string.IsNullOrEmpty(url) ? url : "مستورد"),
            Username = username,
            Password = password,
            Url = url,
            Notes = notes,
            OtpSecret = otpSecret,
            UpdatedAt = now,
        };
    }

    /// <summary>
    /// Split a CSV line into fields, handling quoted values.
    /// </summary>
    private static string[] SplitCsvLine(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char ch = line[i];

            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    current.Append(ch);
                }
            }
            else
            {
                if (ch == '"')
                {
                    inQuotes = true;
                }
                else if (ch == ',')
                {
                    fields.Add(current.ToString().Trim());
                    current.Clear();
                }
                else
                {
                    current.Append(ch);
                }
            }
        }

        fields.Add(current.ToString().Trim());
        return fields.ToArray();
    }
}
