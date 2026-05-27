using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace Ameen.Windows.Models;

public class VaultItem : INotifyPropertyChanged
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string Type { get; set; } = "password";

    public string Title { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string Url { get; set; } = "";
    public string Content { get; set; } = "";
    public string Cardholder { get; set; } = "";
    public string Number { get; set; } = "";
    public string Expiry { get; set; } = "";
    public string Cvv { get; set; } = "";
    public string Notes { get; set; } = "";
    public string OtpSecret { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    public bool IsConflict { get; set; }
    public DateTime? ConflictDate { get; set; }
    public string? ConflictOriginalId { get; set; }

    public bool HasConflict => IsConflict;

    private bool _isExpanded;
    public bool IsExpanded
    {
        get => _isExpanded;
        set { _isExpanded = value; OnPropertyChanged(); }
    }

    public string TypeEmoji => Type switch
    {
        "password" => "🔑",
        "note" => "📝",
        "card" => "💳",
        _ => "🔑"
    };

    public string TypeArabic => Type switch
    {
        "password" => "كلمة مرور",
        "note" => "ملاحظة",
        "card" => "بطاقة",
        _ => "كلمة مرور"
    };

    public string Subtitle
    {
        get
        {
            if (Type == "password" && !string.IsNullOrEmpty(Username))
                return Username;
            if (Type == "card" && !string.IsNullOrEmpty(Number) && Number.Length >= 4)
                return "•••• " + Number[^4..];
            if (Type == "note" && !string.IsNullOrEmpty(Content))
                return Content.Length > 60 ? Content[..57] + "..." : Content;
            return "";
        }
    }

    public bool IsPassword => Type == "password";
    public bool IsNote => Type == "note";
    public bool IsCard => Type == "card";

    public bool HasOtp => !string.IsNullOrEmpty(OtpSecret);

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
