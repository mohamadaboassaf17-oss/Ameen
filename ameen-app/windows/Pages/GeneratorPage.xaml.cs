using System;
using System.Security.Cryptography;
using System.Text;

namespace Ameen.Windows.Pages;

public partial class GeneratorPage : ContentPage
{
    private static readonly string[] ArabicWords = new[]
    {
        "قمر", "شمس", "نجم", "بحر", "جبل", "وردة", "ريح", "سحاب", "مطر", "نهر",
        "ليل", "نور", "أمل", "حلم", "حب", "سلام", "حرية", "قوة", "شجاعة", "حكمة",
        "صبر", "وفاء", "صدق", "عدل", "كرم", "علم", "فن", "شعر", "موسيقى", "كتاب",
        "قلم", "ورق", "حديقة", "شجرة", "زهرة", "فراشة", "طائر", "سماء", "أرض", "نار",
        "ماء", "هواء", "ذهب", "فضة", "لؤلؤ", "مرجان", "ياقوت", "زمرد", "ألماس", "عقيق",
        "فجر", "غروب", "شروق", "ظل", "ضوء", "طريق", "سفر", "بيت", "باب", "نافذة",
        "سر", "مفتاح", "كنز", "خريطة", "قصة", "حكاية", "ذكرى", "لحن", "صوت", "صدى",
        "عطر", "نسيم", "موج", "شاطئ", "جزيرة", "واحة", "صحراء", "غابة", "سهل", "وادي",
        "ربيع", "صيف", "خريف", "شتاء", "زمن", "عمر", "يوم", "ساعة", "دقيقة", "لحظة",
        "قلب", "روح", "عقل", "فكر", "ذاكرة", "خيال", "إبداع", "شغف", "طموح", "هدف"
    };

    private static readonly string[] EnglishWords = new[]
    {
        "moon", "sun", "star", "ocean", "mountain", "flower", "wind", "cloud", "rain", "river",
        "night", "light", "hope", "dream", "love", "peace", "freedom", "power", "courage", "wisdom",
        "patience", "loyalty", "truth", "justice", "generous", "knowledge", "art", "poetry", "music", "book",
        "pen", "paper", "garden", "tree", "rose", "butterfly", "bird", "sky", "earth", "fire",
        "water", "air", "gold", "silver", "pearl", "coral", "ruby", "emerald", "diamond", "agate",
        "dawn", "sunset", "sunrise", "shadow", "glow", "path", "journey", "home", "door", "window",
        "secret", "key", "treasure", "map", "story", "tale", "memory", "melody", "sound", "echo",
        "fragrance", "breeze", "wave", "shore", "island", "oasis", "desert", "forest", "plain", "valley",
        "spring", "summer", "autumn", "winter", "time", "age", "day", "hour", "minute", "moment",
        "heart", "soul", "mind", "thought", "memory2", "imagine", "create", "passion", "ambition", "goal"
    };

    private bool _isPasswordMode = true;

    public GeneratorPage()
    {
        InitializeComponent();
    }

    private void OnPasswordTabClicked(object sender, EventArgs e)
    {
        _isPasswordMode = true;
        PasswordPanel.IsVisible = true;
        PassphrasePanel.IsVisible = false;
        PasswordTabBtn.BackgroundColor = (Color)Application.Current!.Resources["PrimaryColor"];
        PasswordTabBtn.TextColor = Colors.White;
        PassphraseTabBtn.BackgroundColor = (Color)Application.Current!.Resources["SurfaceColor"];
        PassphraseTabBtn.TextColor = (Color)Application.Current!.Resources["TextSecondary"];
    }

    private void OnPassphraseTabClicked(object sender, EventArgs e)
    {
        _isPasswordMode = false;
        PasswordPanel.IsVisible = false;
        PassphrasePanel.IsVisible = true;
        PassphraseTabBtn.BackgroundColor = (Color)Application.Current!.Resources["PrimaryColor"];
        PassphraseTabBtn.TextColor = Colors.White;
        PasswordTabBtn.BackgroundColor = (Color)Application.Current!.Resources["SurfaceColor"];
        PasswordTabBtn.TextColor = (Color)Application.Current!.Resources["TextSecondary"];
    }

    private void OnLengthChanged(object sender, ValueChangedEventArgs e)
    {
        LengthLabel.Text = ((int)e.NewValue).ToString();
    }

    private void OnWordCountChanged(object sender, ValueChangedEventArgs e)
    {
        WordCountLabel.Text = ((int)e.NewValue).ToString();
    }

    private void OnGenerateClicked(object sender, EventArgs e)
    {
        if (_isPasswordMode)
            GeneratePassword();
        else
            GeneratePassphrase();
    }

    private void GeneratePassword()
    {
        var length = (int)LengthSlider.Value;
        var useUpper = UppercaseCheck.IsChecked;
        var useLower = LowercaseCheck.IsChecked;
        var useDigits = DigitsCheck.IsChecked;
        var useSymbols = SymbolsCheck.IsChecked;
        var avoidAmbiguous = AmbiguousCheck.IsChecked;

        var chars = new StringBuilder();
        if (useUpper) chars.Append(avoidAmbiguous ? "ABCDEFGHJKMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        if (useLower) chars.Append(avoidAmbiguous ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz");
        if (useDigits) chars.Append(avoidAmbiguous ? "23456789" : "0123456789");
        if (useSymbols) chars.Append("!@#$%^&*()-_=+[]{}|;:,.<>?");

        if (chars.Length == 0)
        {
            GeneratedOutput.Text = "الرجاء اختيار خيار واحد على الأقل";
            return;
        }

        var charSet = chars.ToString();
        var result = new char[length];
        var bytes = new byte[4];

        for (int i = 0; i < length; i++)
        {
            RandomNumberGenerator.Fill(bytes);
            var idx = BitConverter.ToUInt32(bytes, 0) % (uint)charSet.Length;
            result[i] = charSet[(int)idx];
        }

        GeneratedOutput.Text = new string(result);
        UpdatePasswordStrength(result);
    }

    private void GeneratePassphrase()
    {
        var wordCount = (int)WordCountSlider.Value;
        var separator = SeparatorPicker.SelectedItem?.ToString() ?? "-";
        var capitalize = CapitalizeCheck.IsChecked;
        var lang = LanguagePicker.SelectedIndex;

        var wordList = lang switch
        {
            0 => ArabicWords,
            1 => EnglishWords,
            _ => new[] { ArabicWords, EnglishWords }.SelectMany(w => w).ToArray()
        };

        var words = new string[wordCount];
        var bytes = new byte[4];

        for (int i = 0; i < wordCount; i++)
        {
            RandomNumberGenerator.Fill(bytes);
            var idx = (int)(BitConverter.ToUInt32(bytes, 0) % (uint)wordList.Length);
            var word = wordList[idx];
            words[i] = capitalize ? char.ToUpper(word[0]) + word[1..] : word;
        }

        GeneratedOutput.Text = string.Join(separator, words);
        StrengthLabel.Text = "قوة عبارة المرور: قوية";
        StrengthLabel.TextColor = (Color)Application.Current!.Resources["SuccessColor"];
        StrengthBar.Progress = 0.9;
        StrengthBar.ProgressColor = (Color)Application.Current!.Resources["SuccessColor"];
    }

    private void UpdatePasswordStrength(char[] password)
    {
        var score = 0;
        if (password.Length >= 12) score += 2;
        else if (password.Length >= 8) score++;

        if (password.Any(char.IsUpper)) score++;
        if (password.Any(char.IsLower)) score++;
        if (password.Any(char.IsDigit)) score++;
        if (password.Any(c => "!@#$%^&*()-_=+[]{}|;:,.<>?".Contains(c))) score++;

        var (label, colorKey, progress) = score switch
        {
            <= 2 => ("ضعيفة", "ErrorColor", 0.25),
            <= 4 => ("متوسطة", "TextSecondary", 0.5),
            <= 6 => ("جيدة", "SuccessColor", 0.75),
            _ => ("قوية جداً", "SuccessColor", 1.0)
        };

        StrengthLabel.Text = $"قوة كلمة المرور: {label}";
        StrengthLabel.TextColor = (Color)Application.Current!.Resources[colorKey];
        StrengthBar.Progress = progress;
        StrengthBar.ProgressColor = (Color)Application.Current!.Resources[colorKey];
    }

    private async void OnCopyClicked(object sender, EventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(GeneratedOutput.Text) &&
            GeneratedOutput.Text != "انقر على 'توليد' لإنشاء كلمة مرور" &&
            GeneratedOutput.Text != "الرجاء اختيار خيار واحد على الأقل")
        {
            await Clipboard.Default.SetTextAsync(GeneratedOutput.Text);
            await DisplayAlert("تم", "تم نسخ النص إلى الحافظة", "موافق");
        }
    }

    private async void OnUseClicked(object sender, EventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(GeneratedOutput.Text) &&
            GeneratedOutput.Text != "انقر على 'توليد' لإنشاء كلمة مرور" &&
            GeneratedOutput.Text != "الرجاء اختيار خيار واحد على الأقل")
        {
            MessagingCenter.Send(this, "PasswordGenerated", GeneratedOutput.Text);
            await Navigation.PopModalAsync();
        }
    }

    private async void OnCancelClicked(object sender, EventArgs e)
    {
        await Navigation.PopModalAsync();
    }
}
