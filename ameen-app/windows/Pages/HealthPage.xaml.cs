using Ameen.Windows.Models;

namespace Ameen.Windows.Pages;

public partial class HealthPage : ContentPage
{
    private List<VaultItem> _items;

    public HealthPage(List<VaultItem> items)
    {
        InitializeComponent();
        _items = items;
        Analyze();
    }

    private void Analyze()
    {
        var passwords = _items.Where(i => i.Type == "password").ToList();
        var weakPasswords = passwords.Where(p => IsWeak(p.Password)).ToList();

        var duplicateGroups = passwords
            .GroupBy(p => p.Password)
            .Where(g => g.Count() > 1 && !string.IsNullOrEmpty(g.Key))
            .ToList();

        var duplicateCount = duplicateGroups.Sum(g => g.Count());

        TotalLabel.Text = passwords.Count.ToString();
        WeakLabel.Text = weakPasswords.Count.ToString();
        DuplicateLabel.Text = duplicateCount.ToString();

        var weakPenalty = passwords.Count > 0 ? (weakPasswords.Count * 30) / passwords.Count : 0;
        var duplicatePenalty = passwords.Count > 0 ? (duplicateCount * 30) / passwords.Count : 0;
        var score = Math.Max(0, 100 - weakPenalty - duplicatePenalty);

        ScoreLabel.Text = score.ToString();
        ScoreBar.Progress = score / 100.0;

        var (colorKey, description) = score switch
        {
            >= 80 => ("SuccessColor", "ممتاز!"),
            >= 60 => ("PrimaryColor", "جيد"),
            >= 40 => ("TextSecondary", "متوسط"),
            _ => ("ErrorColor", "ضعيف")
        };

        ScoreLabel.TextColor = (Color)Application.Current!.Resources[colorKey];
        ScoreBar.ProgressColor = (Color)Application.Current!.Resources[colorKey];
        ScoreDescription.Text = $"{description} ({score} من 100)";

        if (weakPasswords.Count > 0)
        {
            WeakHeader.IsVisible = true;
            foreach (var item in weakPasswords)
            {
                WeakList.Children.Add(new Label
                {
                    Text = $"🔑 {item.Title} — {item.Username}",
                    TextColor = (Color)Application.Current!.Resources["TextSecondary"],
                    FontSize = 13
                });
            }
        }

        if (duplicateGroups.Count > 0)
        {
            DuplicateHeader.IsVisible = true;
            foreach (var group in duplicateGroups)
            {
                var names = string.Join("، ", group.Select(i => i.Title));
                DuplicateList.Children.Add(new Label
                {
                    Text = $"⚠ {names} (مكررة {group.Count()} مرات)",
                    TextColor = (Color)Application.Current!.Resources["ErrorColor"],
                    FontSize = 13
                });
            }
        }
    }

    private static bool IsWeak(string password)
    {
        if (string.IsNullOrWhiteSpace(password)) return true;
        if (password.Length < 8) return true;

        var hasUpper = password.Any(char.IsUpper);
        var hasLower = password.Any(char.IsLower);
        var hasDigit = password.Any(char.IsDigit);
        var hasSymbol = password.Any(c => "!@#$%^&*()-_=+[]{}|;:,.<>?".Contains(c));

        var score = 0;
        if (hasUpper) score++;
        if (hasLower) score++;
        if (hasDigit) score++;
        if (hasSymbol) score++;
        if (password.Length >= 12) score++;

        return score < 3;
    }

    private async void OnCloseClicked(object sender, EventArgs e)
    {
        await Navigation.PopModalAsync();
    }
}
