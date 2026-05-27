using System.Collections.ObjectModel;
using System.Text;
using System.Text.Json;
using Ameen.Windows.Models;
using Ameen.Windows.Services;

namespace Ameen.Windows.Pages;

public partial class VaultPage : ContentPage
{
    private readonly ObservableCollection<VaultItem> _allItems = new();
    private string _activeTab = "all";
    private string _searchQuery = "";
    private System.Timers.Timer? _otpTimer;
    private bool _isClosing;
    private readonly Dictionary<string, Label> _otpLabels = new();
    private readonly Dictionary<string, Label> _otpTimers = new();
    private VaultItem? _resolvingConflictLocal;
    private VaultItem? _resolvingConflictRemote;

    public VaultPage()
    {
        InitializeComponent();
        LoadDemoData();
        App.Current.UpdateTrayRecentItems(_allItems.ToList());
        App.Current.StartExtensionServer(_allItems.ToList());
        RenderAll();
        App.Current.UnlockVault();
        StartOtpTimer();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        if (!_isClosing)
        {
            StopOtpTimer();
            App.Current.AutoLock.OnAppBackground();
            App.Current.Clipboard.OnAppBackground();
            App.Current.StopExtensionServer();
        }
    }

    private void LoadDemoData()
    {
        _allItems.Clear();
        _allItems.Add(new VaultItem { Type = "password", Title = "Gmail", Username = "ahmed@gmail.com", Password = "Kx9#mP2!vLq7", Url = "https://mail.google.com", Notes = "\u0627\u0644\u0628\u0631\u064a\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u0623\u0633\u0627\u0633\u064A" });
        _allItems.Add(new VaultItem { Type = "password", Title = "Twitter", Username = "@ahmed_s", Password = "Tw33t!Pass2024", Url = "https://twitter.com", OtpSecret = "JBSWY3DPEHPK3PXP" });
        _allItems.Add(new VaultItem { Type = "password", Title = "GitHub", Username = "ahmed-dev", Password = "Gh!C0d3#Secure", Url = "https://github.com", Notes = "\u062D\u0633\u0627\u0628 \u0627\u0644\u0639\u0645\u0644" });
        _allItems.Add(new VaultItem { Type = "password", Title = "Netflix", Username = "ahmed@mail.com", Password = "Netflix2024!", Url = "https://netflix.com" });
        _allItems.Add(new VaultItem { Type = "password", Title = "AWS Console", Username = "admin@company.com", Password = "AWSc0ns0le#StronG!2024", Url = "https://aws.amazon.com", Notes = "\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 - \u0645\u0647\u0645 \u062C\u062F\u0627\u064B" });
        _allItems.Add(new VaultItem { Type = "note", Title = "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0634\u062E\u0635\u064A\u0629", Content = "\u062A\u0630\u0643\u064A\u0631: \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0645\u0631\u0648\u0631 \u0643\u0644 3 \u0623\u0634\u0647\u0631. \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0629." });
        _allItems.Add(new VaultItem { Type = "card", Title = "\u0628\u0637\u0627\u0642\u0629 \u0645\u062F\u0649 \u0627\u0644\u0628\u0646\u0643\u064A\u0629", Cardholder = "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F", Number = "4532015112830366", Expiry = "12/26", Cvv = "742", Notes = "\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629" });
    }

    private List<VaultItem> GetFiltered()
    {
        var filtered = _allItems.AsEnumerable();
        switch (_activeTab)
        {
            case "password": filtered = filtered.Where(i => i.Type == "password"); break;
            case "note": filtered = filtered.Where(i => i.Type == "note"); break;
            case "card": filtered = filtered.Where(i => i.Type == "card"); break;
        }
        if (!string.IsNullOrWhiteSpace(_searchQuery))
        {
            var q = _searchQuery.Trim().ToLower();
            filtered = filtered.Where(i =>
                (i.Title?.ToLower().Contains(q) ?? false) ||
                (i.Username?.ToLower().Contains(q) ?? false) ||
                (i.Url?.ToLower().Contains(q) ?? false) ||
                (i.Content?.ToLower().Contains(q) ?? false) ||
                (i.Cardholder?.ToLower().Contains(q) ?? false) ||
                (i.Notes?.ToLower().Contains(q) ?? false));
        }
        return filtered.ToList();
    }

    private void RenderAll()
    {
        App.Current.AutoLock.ResetTimer();
        var filtered = GetFiltered();
        PasswordCount.Text = _allItems.Count(i => i.Type == "password").ToString();
        NoteCount.Text = _allItems.Count(i => i.Type == "note").ToString();
        CardCount.Text = _allItems.Count(i => i.Type == "card").ToString();
        EmptyLabel.IsVisible = filtered.Count == 0;
        _otpLabels.Clear();
        _otpTimers.Clear();
        ItemsContainer.Children.Clear();
        foreach (var item in filtered)
            ItemsContainer.Children.Add(BuildItemView(item));
        UpdateConflictBanner();
        App.Current.UpdateTrayRecentItems(_allItems.ToList());
        App.Current.UpdateExtensionVaultData(_allItems.ToList());
    }

    private View BuildItemView(VaultItem item)
    {
        var bg = item.IsConflict
            ? Color.FromArgb("#FFF8E1")
            : (Color)Application.Current!.Resources["SurfaceColor"];
        var primary = (Color)Application.Current!.Resources["PrimaryColor"];
        var textPri = item.IsConflict
            ? Color.FromArgb("#333333")
            : (Color)Application.Current!.Resources["TextPrimary"];
        var textSec = item.IsConflict
            ? Color.FromArgb("#666666")
            : (Color)Application.Current!.Resources["TextSecondary"];
        var success = (Color)Application.Current!.Resources["SuccessColor"];
        var err = (Color)Application.Current!.Resources["ErrorColor"];

        var frame = new Frame
        {
            Margin = new Thickness(0, 4), Padding = 0, CornerRadius = 10,
            BackgroundColor = bg, HasShadow = false,
            BorderColor = item.IsConflict ? Color.FromArgb("#E65100") : Colors.Transparent
        };

        var root = new VerticalStackLayout();

        if (item.IsConflict)
        {
            var conflictBadge = new Label
            {
                Text = "⚠️ متعارض",
                TextColor = Color.FromArgb("#E65100"),
                FontSize = 12,
                FontAttributes = FontAttributes.Bold,
                Padding = new Thickness(12, 6, 12, 0)
            };
            root.Children.Add(conflictBadge);
        }

        var header = new Grid
        {
            ColumnDefinitions = { new ColumnDefinition(36), new ColumnDefinition(GridLength.Star), new ColumnDefinition(38), new ColumnDefinition(38), new ColumnDefinition(38) },
            Padding = new Thickness(12, 10), ColumnSpacing = 8
        };

        header.Add(new Label { Text = item.TypeEmoji, FontSize = 18, VerticalTextAlignment = TextAlignment.Center }, 0);

        var titleStack = new VerticalStackLayout { Spacing = 2, VerticalOptions = LayoutOptions.Center };
        titleStack.Children.Add(new Label { Text = item.Title, FontSize = 15, FontAttributes = FontAttributes.Bold, TextColor = textPri, LineBreakMode = LineBreakMode.TailTruncation });
        titleStack.Children.Add(new Label { Text = item.Subtitle, FontSize = 12, TextColor = textSec, LineBreakMode = LineBreakMode.TailTruncation });
        header.Add(titleStack, 1);

        var copyHeaderBtn = new Button { Text = "\uD83D\uDCCB", FontSize = 14, BackgroundColor = Colors.Transparent, TextColor = textSec, WidthRequest = 38, HeightRequest = 38, Padding = 0 };
        copyHeaderBtn.Clicked += async (_, _) =>
        {
            App.Current.AutoLock.ResetTimer();
            var t = item.Type switch { "password" => item.Password, "card" => item.Number, _ => item.Content };
            if (!string.IsNullOrWhiteSpace(t))
            {
                await App.Current.Clipboard.CopyToClipboard(t);
                App.Current.Clipboard.ScheduleBackgroundClear();
                await DisplayAlert("\u062A\u0645", "\u062A\u0645 \u0627\u0644\u0646\u0633\u062E \u0625\u0644\u0649 \u0627\u0644\u062D\u0627\u0641\u0638\u0629", "\u0645\u0648\u0627\u0641\u0642");
            }
        };
        header.Add(copyHeaderBtn, 2);

        var editBtn = new Button { Text = "\u270E", FontSize = 14, BackgroundColor = Colors.Transparent, TextColor = textSec, WidthRequest = 38, HeightRequest = 38, Padding = 0 };
        editBtn.Clicked += async (_, _) => { await OpenEditPage(item); };
        header.Add(editBtn, 3);

        var delBtn = new Button { Text = "\uD83D\uDDD1", FontSize = 14, BackgroundColor = Colors.Transparent, TextColor = err, WidthRequest = 38, HeightRequest = 38, Padding = 0 };
        delBtn.Clicked += async (_, _) =>
        {
            var ok = await DisplayAlert("\u062A\u0623\u0643\u064A\u062F", $"\u0647\u0644 \u0623\u0646\u062A \u0645\u062A\u0623\u0643\u062F \u0645\u0646 \u062D\u0630\u0641 \"{item.Title}\"\u061F", "\u062D\u0630\u0641", "\u0625\u0644\u063A\u0627\u0621");
            if (ok) { _allItems.Remove(item); RenderAll(); }
        };
        header.Add(delBtn, 4);

        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) =>
        {
            if (item.IsConflict)
            {
                ShowConflictResolver(item);
                return;
            }
            item.IsExpanded = !item.IsExpanded;
            RenderAll();
        };
        header.GestureRecognizers.Add(tap);

        root.Children.Add(header);

        if (item.IsExpanded)
        {
            var details = new VerticalStackLayout { Spacing = 8, Padding = new Thickness(12, 0, 12, 12) };
            details.Children.Add(new BoxView { HeightRequest = 1, Color = textSec, Opacity = 0.2 });

            if (item.Type == "password")
            {
                details.Children.Add(BuildFieldRow("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", item.Username, false, textPri, textSec, primary));
                details.Children.Add(BuildFieldRow("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", item.Password, true, textPri, textSec, primary));
                details.Children.Add(BuildFieldRow("\u0627\u0644\u0631\u0627\u0628\u0637", item.Url, false, textPri, textSec, primary));
            }
            else if (item.Type == "note")
            {
                details.Children.Add(new Label { Text = item.Content, TextColor = textPri, FontSize = 14, LineBreakMode = LineBreakMode.WordWrap });
            }
            else if (item.Type == "card")
            {
                details.Children.Add(BuildFieldRow("\u0627\u0633\u0645 \u062D\u0627\u0645\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0629", item.Cardholder, false, textPri, textSec, primary));
                details.Children.Add(BuildFieldRow("\u0631\u0642\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629", item.Number, true, textPri, textSec, primary));
                details.Children.Add(BuildFieldRow("\u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629", item.Expiry, false, textPri, textSec, primary));
                details.Children.Add(BuildFieldRow("\u0631\u0645\u0632 \u0627\u0644\u0623\u0645\u0627\u0646", item.Cvv, true, textPri, textSec, primary));
            }

            if (!string.IsNullOrWhiteSpace(item.Notes))
            {
                details.Children.Add(new BoxView { HeightRequest = 1, Color = textSec, Opacity = 0.2 });
                details.Children.Add(new Label { Text = "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", TextColor = textSec, FontSize = 12 });
                details.Children.Add(new Label { Text = item.Notes, TextColor = textPri, FontSize = 13, LineBreakMode = LineBreakMode.WordWrap });
            }

            if (!string.IsNullOrWhiteSpace(item.OtpSecret))
            {
                details.Children.Add(new BoxView { HeightRequest = 1, Color = textSec, Opacity = 0.2 });
                details.Children.Add(new Label { Text = "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 (OTP)", TextColor = textSec, FontSize = 12 });

                var otpCode = TotpHelper.GenerateCode(item.OtpSecret);
                var otpLabel = new Label
                {
                    Text = otpCode.Length == 6 ? otpCode.Insert(3, " ") : otpCode,
                    FontSize = 24, FontAttributes = FontAttributes.Bold,
                    TextColor = success, FontFamily = "Consolas",
                };
                _otpLabels[item.Id] = otpLabel;
                details.Children.Add(otpLabel);

                var remaining = TotpHelper.GetRemainingSeconds();
                var timerLabel = new Label
                {
                    Text = remaining + " \u062B\u0627\u0646\u064A\u0629",
                    FontSize = 12, TextColor = textSec,
                };
                _otpTimers[item.Id] = timerLabel;
                details.Children.Add(timerLabel);

                var copyOtpBtn = new Button
                {
                    Text = "\u0646\u0633\u062E \u0627\u0644\u0631\u0645\u0632",
                    BackgroundColor = primary, TextColor = Colors.White,
                    CornerRadius = 6, HeightRequest = 34, FontSize = 13,
                    Margin = new Thickness(0, 2, 0, 0)
                };
                copyOtpBtn.Clicked += async (_, _) =>
                {
                    var code = TotpHelper.GenerateCode(item.OtpSecret);
                    await App.Current.Clipboard.CopyToClipboard(code);
                    App.Current.Clipboard.ScheduleBackgroundClear();
                    await DisplayAlert("\u062A\u0645", "\u062A\u0645 \u0646\u0633\u062E \u0631\u0645\u0632 OTP \u0625\u0644\u0649 \u0627\u0644\u062D\u0627\u0641\u0638\u0629", "\u0645\u0648\u0627\u0641\u0642");
                };
                details.Children.Add(copyOtpBtn);
            }
            root.Children.Add(details);
        }

        frame.Content = root;
        return frame;
    }

    private View BuildFieldRow(string label, string value, bool isSecret, Color textPri, Color textSec, Color primary)
    {
        var row = new Frame
        {
            BackgroundColor = Color.FromArgb("#2A2A2A"), CornerRadius = 6,
            Padding = new Thickness(10, 8), HasShadow = false, Margin = 0
        };

        var grid = new Grid
        {
            ColumnDefinitions = { new ColumnDefinition(GridLength.Star), new ColumnDefinition(36), new ColumnDefinition(36) },
            ColumnSpacing = 4
        };

        var valStack = new VerticalStackLayout { Spacing = 2 };
        valStack.Children.Add(new Label { Text = label, TextColor = textSec, FontSize = 11 });
        valStack.Children.Add(new Label { Text = isSecret ? new string('\u2022', Math.Min(value.Length, 16)) : value, TextColor = textPri, FontSize = 14, FontFamily = "Consolas", LineBreakMode = LineBreakMode.CharacterWrap });
        grid.Add(valStack, 0);

        var revealBtn = new Button { Text = "\uD83D\uDC41", FontSize = 14, BackgroundColor = Colors.Transparent, TextColor = textSec, WidthRequest = 36, HeightRequest = 36, Padding = 0 };
        revealBtn.Clicked += (_, _) =>
        {
            App.Current.AutoLock.ResetTimer();
            var valLabel = (Label)((VerticalStackLayout)grid.Children[0]).Children[1];
            bool isCurrentlyHidden = valLabel.Text.Contains('\u2022');
            if (isCurrentlyHidden && isSecret)
            {
                var recorders = ScreenCaptureProtectionService.IsScreenRecording();
                if (recorders.Count > 0)
                {
                    MainThread.BeginInvokeOnMainThread(async () =>
                    {
                        await DisplayAlert("تحذير أمني", ScreenCaptureProtectionService.ShowCaptureWarning(), "حسنًا");
                    });
                }
            }
            valLabel.Text = isCurrentlyHidden ? value : (isSecret ? new string('\u2022', Math.Min(value.Length, 16)) : value);
        };
        grid.Add(revealBtn, 1);

        var copyBtn = new Button { Text = "\uD83D\uDCCB", FontSize = 14, BackgroundColor = Colors.Transparent, TextColor = textSec, WidthRequest = 36, HeightRequest = 36, Padding = 0 };
        copyBtn.Clicked += async (_, _) =>
        {
            App.Current.AutoLock.ResetTimer();
            if (!string.IsNullOrWhiteSpace(value))
            {
                await App.Current.Clipboard.CopyToClipboard(value);
                App.Current.Clipboard.ScheduleBackgroundClear();
                await DisplayAlert("\u062A\u0645", "\u062A\u0645 \u0627\u0644\u0646\u0633\u062E", "\u0645\u0648\u0627\u0641\u0642");
            }
        };
        grid.Add(copyBtn, 2);

        row.Content = grid;
        return row;
    }

    private async Task OpenEditPage(VaultItem item)
    {
        var editPage = new AddEditItemPage(item);
        editPage.ItemSaved += (_, updated) =>
        {
            var idx = _allItems.IndexOf(item);
            if (idx >= 0) { _allItems[idx] = updated; RenderAll(); }
        };
        await Navigation.PushModalAsync(editPage);
    }

    private void OnTabClicked(object sender, EventArgs e)
    {
        var btn = (Button)sender;
        _activeTab = btn.Text switch
        {
            "\u0627\u0644\u0643\u0644" => "all",
            "\uD83D\uDD11 \u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0645\u0631\u0648\u0631" => "password",
            "\uD83D\uDCDD \u0645\u0644\u0627\u062D\u0638\u0627\u062A" => "note",
            "\uD83D\uDCB3 \u0628\u0637\u0627\u0642\u0627\u062A" => "card",
            _ => "all"
        };

        var active = (Color)Application.Current!.Resources["PrimaryColor"];
        var iBg = (Color)Application.Current!.Resources["SurfaceColor"];
        var iFg = (Color)Application.Current!.Resources["TextSecondary"];

        TabAll.BackgroundColor = iBg; TabAll.TextColor = iFg;
        TabPasswords.BackgroundColor = iBg; TabPasswords.TextColor = iFg;
        TabNotes.BackgroundColor = iBg; TabNotes.TextColor = iFg;
        TabCards.BackgroundColor = iBg; TabCards.TextColor = iFg;

        switch (_activeTab)
        {
            case "all": TabAll.BackgroundColor = active; TabAll.TextColor = Colors.White; break;
            case "password": TabPasswords.BackgroundColor = active; TabPasswords.TextColor = Colors.White; break;
            case "note": TabNotes.BackgroundColor = active; TabNotes.TextColor = Colors.White; break;
            case "card": TabCards.BackgroundColor = active; TabCards.TextColor = Colors.White; break;
        }
        App.Current.AutoLock.ResetTimer();
        RenderAll();
    }

    private void OnSearchTextChanged(object sender, TextChangedEventArgs e)
    {
        _searchQuery = e.NewTextValue ?? "";
        App.Current.AutoLock.ResetTimer();
        RenderAll();
    }

    private async void OnAddClicked(object sender, EventArgs e)
    {
        App.Current.AutoLock.ResetTimer();
        var addPage = new AddEditItemPage();
        addPage.ItemSaved += (_, newItem) => { _allItems.Add(newItem); RenderAll(); };
        await Navigation.PushModalAsync(addPage);
    }

    private async void OnHealthClicked(object sender, EventArgs e)
    {
        App.Current.AutoLock.ResetTimer();
        await Navigation.PushModalAsync(new HealthPage(_allItems.ToList()));
    }

    private async void OnLockClicked(object sender, EventArgs e)
    {
        _isClosing = true;
        StopOtpTimer();
        _allItems.Clear();
        App.Current.Tray.UpdateRecentItems(new List<QuickCopyItem>());
        App.Current.LockVault();
        await Navigation.PopModalAsync();
    }

    private async void OnMenuClicked(object sender, EventArgs e)
    {
        App.Current.AutoLock.ResetTimer();
        var action = await DisplayActionSheet(
            "خيارات الخزنة",
            "إلغاء",
            null,
            "📤 تصدير الخزنة",
            "📥 استيراد من ملف",
            "📥 استيراد من CSV",
            "📥 استيراد من KeePass",
            "🆘 طقم الطوارئ");

        switch (action)
        {
            case "📤 تصدير الخزنة":
                await ExportVault();
                break;
            case "📥 استيراد من ملف":
                await ImportFromBackup();
                break;
            case "📥 استيراد من CSV":
                await ImportFromCsv();
                break;
            case "📥 استيراد من KeePass":
                await ImportFromKdbx();
                break;
            case "🆘 طقم الطوارئ":
                await GenerateEmergencyKit();
                break;
        }
    }

    private async Task ExportVault()
    {
        try
        {
            // For now, use a hardcoded demo key (in production this comes from the actual vault key)
            var demoKey = new byte[32];
            new Random().NextBytes(demoKey);

            var backupService = new BackupService();
            var filePath = await backupService.ExportVaultAsync(
                _allItems.ToList(),
                demoKey,
                UserLabel.Text.Replace("— ", ""),
                "demo-vault-id");

            if (!string.IsNullOrEmpty(filePath))
                await DisplayAlert("تم", $"تم تصدير {_allItems.Count} عنصر بنجاح", "موافق");
        }
        catch (Exception ex)
        {
            await DisplayAlert("خطأ", $"فشل التصدير: {ex.Message}", "موافق");
        }
    }

    private async Task ImportFromBackup()
    {
        try
        {
            var demoKey = new byte[32];
            new Random().NextBytes(demoKey);

            var backupService = new BackupService();
            var items = await backupService.ImportVaultAsync(demoKey);

            if (items != null && items.Count > 0)
            {
                var merge = await DisplayAlert("استيراد",
                    $"تم العثور على {items.Count} عنصر. هل تريد الدمج مع الخزنة الحالية؟\nاختيار \"لا\" سيستبدل جميع العناصر.",
                    "دمج", "استبدال");

                if (merge)
                {
                    foreach (var item in items)
                    {
                        if (!_allItems.Any(i => i.Id == item.Id))
                            _allItems.Add(item);
                    }
                }
                else
                {
                    _allItems.Clear();
                    foreach (var item in items)
                        _allItems.Add(item);
                }

                RenderAll();
                await DisplayAlert("تم", $"تم استيراد {items.Count} عنصر بنجاح", "موافق");
            }
        }
        catch (Exception ex)
        {
            await DisplayAlert("خطأ", $"فشل الاستيراد: {ex.Message}", "موافق");
        }
    }

    private async Task ImportFromCsv()
    {
        try
        {
            var csvService = new CsvImportService();
            var result = await csvService.ImportFromFileAsync();

            if (result.Items.Count == 0)
            {
                await DisplayAlert("تنبيه",
                    result.DetectedFormat == CsvFormat.Unknown
                        ? "لم يتم التعرف على تنسيق ملف CSV."
                        : "لم يتم العثور على عناصر في الملف.",
                    "موافق");
                return;
            }

            var merge = await DisplayAlert("استيراد CSV",
                $"تم العثور على {result.ImportedRows} عنصر (تنسيق: {result.DetectedFormat}).\nتم تخطي {result.SkippedRows} صف.\n\nهل تريد الدمج مع الخزنة الحالية؟",
                "دمج", "استبدال");

            if (merge)
            {
                foreach (var item in result.Items)
                    _allItems.Add(item);
            }
            else
            {
                _allItems.Clear();
                foreach (var item in result.Items)
                    _allItems.Add(item);
            }

            RenderAll();
            await DisplayAlert("تم", $"تم استيراد {result.ImportedRows} عنصر بنجاح", "موافق");
        }
        catch (Exception ex)
        {
            await DisplayAlert("خطأ", $"فشل استيراد CSV: {ex.Message}", "موافق");
        }
    }

    private async Task ImportFromKdbx()
    {
        try
        {
            var kdbxService = new KdbxImportService();
            var filePath = await DisplayPromptAsync(
                "ملف KeePass",
                "الرجاء اختيار ملف .kdbx أولاً.\n\nأدخل مسار الملف يدوياً أو الصق المسار:",
                "موافق", "إلغاء",
                placeholder: "C:\\Users\\...\\database.kdbx");

            if (string.IsNullOrWhiteSpace(filePath)) return;

            var password = await DisplayPromptAsync(
                "كلمة مرور KeePass",
                "أدخل كلمة المرور الرئيسية لملف KeePass:",
                "موافق", "إلغاء",
                maxLength: 128);

            if (string.IsNullOrWhiteSpace(password)) return;

            var kdbxBytes = await File.ReadAllBytesAsync(filePath);
            var result = kdbxService.ReadKdbx(kdbxBytes, password);

            if (result.Items.Count == 0)
            {
                await DisplayAlert("تنبيه", "لم يتم العثور على عناصر في ملف KeePass.", "موافق");
                return;
            }

            var merge = await DisplayAlert("استيراد KeePass",
                $"تم العثور على {result.EntryCount} عنصر في قاعدة البيانات \"{result.DatabaseName}\".\n\nهل تريد الدمج مع الخزنة الحالية؟",
                "دمج", "استبدال");

            if (merge)
            {
                foreach (var item in result.Items)
                    _allItems.Add(item);
            }
            else
            {
                _allItems.Clear();
                foreach (var item in result.Items)
                    _allItems.Add(item);
            }

            RenderAll();
            await DisplayAlert("تم", $"تم استيراد {result.EntryCount} عنصر من KeePass بنجاح", "موافق");
        }
        catch (Exception ex)
        {
            await DisplayAlert("خطأ", $"فشل استيراد KeePass: {ex.Message}", "موافق");
        }
    }

    private async Task GenerateEmergencyKit()
    {
        try
        {
            var kitService = new EmergencyKitService();
            var profileName = UserLabel.Text.Replace("— ", "").Trim();
            var kit = kitService.CreateKit(profileName);
            var filePath = await kitService.SaveAndOpenKitAsync(kit);

            if (!string.IsNullOrEmpty(filePath))
            {
                await DisplayAlert("تم",
                    "تم إنشاء طقم الطوارئ وفتحه في المتصفح.\n\n" +
                    "الرجاء طباعة المستند والاحتفاظ به في مكان آمن.\n\n" +
                    $"كلمة مرور الطوارئ:\n{kit.BackupPassphrase}",
                    "موافق");
            }
        }
        catch (Exception ex)
        {
            await DisplayAlert("خطأ", $"فشل إنشاء طقم الطوارئ: {ex.Message}", "موافق");
        }
    }

    private async void OnSyncClicked(object sender, EventArgs e)
    {
        App.Current.AutoLock.ResetTimer();
        SyncButton.IsVisible = false;
        SyncProgress.IsVisible = true;
        SyncResultLabel.Text = "جارٍ البحث عن أجهزة...";

        try
        {
            var payload = await QrCodeScanner.ScanFromFileAsync();
            if (payload == null)
            {
                SyncResultLabel.Text = "لم يتم العثور على رمز QR صالح";
                return;
            }

            SyncResultLabel.Text = "جارٍ الاتصال...";
            var syncService = new SyncService();
            var connection = await syncService.ConnectAsync(
                payload.Ip, payload.Port, payload.Pk, payload.Fp);

            SyncResultLabel.Text = "";
            var pairingPage = new PairingPage(syncService.Fingerprint, payload.Fp, connection);
            await Navigation.PushModalAsync(pairingPage);

            if (!pairingPage.Confirmed)
            {
                SyncResultLabel.Text = "تم إلغاء الاقتران";
                return;
            }

            SyncResultLabel.Text = "جارٍ تبادل البيانات...";
            var myItems = JsonSerializer.Serialize(new
            {
                items = _allItems.Select(ConvertToSyncDto).ToList()
            });
            await connection.SendAsync(Encoding.UTF8.GetBytes(myItems));

            var response = await connection.ReceiveAsync();
            var responseJson = Encoding.UTF8.GetString(response);
            var merged = JsonSerializer.Deserialize<SyncResponseDto>(responseJson);

            if (merged != null)
            {
                _allItems.Clear();
                foreach (var item in merged.Items)
                {
                    _allItems.Add(ConvertToVaultItem(item));
                }

                var parts = new List<string>();
                if (merged.NewItemCount > 0)
                    parts.Add($"{merged.NewItemCount} عنصر جديد");
                if (merged.SyncedItemCount > 0)
                    parts.Add($"{merged.SyncedItemCount} مُحدَّث");
                if (merged.ConflictCount > 0)
                    parts.Add($"{merged.ConflictCount} تعارض");

                SyncResultLabel.Text = parts.Count > 0
                    ? "تمت المزامنة: " + string.Join("، ", parts)
                    : "تمت المزامنة — لا توجد تغييرات";
                App.Current.AutoLock.ResetTimer();
                RenderAll();
            }

            connection.Dispose();
        }
        catch (Exception ex)
        {
            SyncResultLabel.Text = $"فشلت المزامنة: {ex.Message}";
        }
        finally
        {
            SyncButton.IsVisible = true;
            SyncProgress.IsVisible = false;
        }
    }

    private static SyncItemDto ConvertToSyncDto(VaultItem item)
    {
        return new SyncItemDto
        {
            Id = item.Id,
            Type = item.Type,
            Title = item.Title,
            Username = item.Username,
            Password = item.Password,
            Url = item.Url,
            Content = item.Content,
            Cardholder = item.Cardholder,
            Number = item.Number,
            Expiry = item.Expiry,
            Cvv = item.Cvv,
            Notes = item.Notes,
            OtpSecret = item.OtpSecret,
            UpdatedAt = item.UpdatedAt,
            IsConflict = item.IsConflict,
            ConflictDate = item.ConflictDate,
            ConflictOriginalId = item.ConflictOriginalId
        };
    }

    private static VaultItem ConvertToVaultItem(SyncItemDto dto)
    {
        return new VaultItem
        {
            Id = dto.Id,
            Type = dto.Type,
            Title = dto.Title,
            Username = dto.Username,
            Password = dto.Password,
            Url = dto.Url,
            Content = dto.Content,
            Cardholder = dto.Cardholder,
            Number = dto.Number,
            Expiry = dto.Expiry,
            Cvv = dto.Cvv,
            Notes = dto.Notes,
            OtpSecret = dto.OtpSecret,
            UpdatedAt = dto.UpdatedAt,
            IsConflict = dto.IsConflict,
            ConflictDate = dto.ConflictDate,
            ConflictOriginalId = dto.ConflictOriginalId
        };
    }

    // ── Conflict resolution ──

    private void UpdateConflictBanner()
    {
        var conflictItems = _allItems.Where(i => i.IsConflict).ToList();
        bool hasConflicts = conflictItems.Count > 0;
        ConflictBanner.IsVisible = hasConflicts;
        if (hasConflicts)
        {
            var count = conflictItems.Count;
            ConflictBannerText.Text = count == 1
                ? "يوجد عنصر متعارض بحاجة إلى مراجعة"
                : $"يوجد {count} عناصر متعارضة بحاجة إلى مراجعة";
        }
    }

    private void OnConflictBannerClicked(object sender, EventArgs e)
    {
        var firstConflict = _allItems.FirstOrDefault(i => i.IsConflict);
        if (firstConflict != null)
            ShowConflictResolver(firstConflict);
    }

    private void ShowConflictResolver(VaultItem item)
    {
        var other = _allItems.FirstOrDefault(i =>
            i.IsConflict &&
            i.ConflictOriginalId == item.Id &&
            i.Id != item.Id);

        if (other == null) return;

        _resolvingConflictLocal = item;
        _resolvingConflictRemote = other;

        ConflictLocalInfo.Text = FormatItemPreview(item);
        ConflictRemoteInfo.Text = FormatItemPreview(other);
        ConflictOverlay.IsVisible = true;
    }

    private static string FormatItemPreview(VaultItem item)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"العنوان: {item.Title}");
        sb.AppendLine($"النوع: {item.TypeArabic}");
        sb.AppendLine($"آخر تعديل: {item.UpdatedAt:yyyy/MM/dd HH:mm}");

        if (item.Type == "password")
        {
            if (!string.IsNullOrEmpty(item.Username))
                sb.AppendLine($"اسم المستخدم: {item.Username}");
            if (!string.IsNullOrEmpty(item.Url))
                sb.AppendLine($"الرابط: {item.Url}");
        }
        else if (item.Type == "note")
        {
            if (!string.IsNullOrEmpty(item.Content))
            {
                var snippet = item.Content.Length > 80 ? item.Content[..80] + "..." : item.Content;
                sb.AppendLine($"المحتوى: {snippet}");
            }
        }
        else if (item.Type == "card")
        {
            if (!string.IsNullOrEmpty(item.Cardholder))
                sb.AppendLine($"حامل البطاقة: {item.Cardholder}");
            if (!string.IsNullOrEmpty(item.Number) && item.Number.Length >= 4)
                sb.AppendLine($"الرقم: ****{item.Number[^4..]}");
        }
        return sb.ToString();
    }

    private void OnKeepLocalClicked(object sender, EventArgs e)
    {
        if (_resolvingConflictLocal != null && _resolvingConflictRemote != null)
        {
            ResolveConflict(_resolvingConflictLocal, _resolvingConflictRemote);
        }
        ConflictOverlay.IsVisible = false;
    }

    private void OnKeepRemoteClicked(object sender, EventArgs e)
    {
        if (_resolvingConflictRemote != null && _resolvingConflictLocal != null)
        {
            ResolveConflict(_resolvingConflictRemote, _resolvingConflictLocal);
        }
        ConflictOverlay.IsVisible = false;
    }

    private void OnConflictDismissClicked(object sender, EventArgs e)
    {
        ConflictOverlay.IsVisible = false;
    }

    private void ResolveConflict(VaultItem winner, VaultItem loser)
    {
        winner.IsConflict = false;
        winner.ConflictDate = null;
        winner.ConflictOriginalId = null;
        _allItems.Remove(loser);
        UpdateConflictBanner();
        SyncResultLabel.Text = $"تم حل التعارض — تم الاحتفاظ بـ {winner.Title}";
        RenderAll();
    }

    // ── OTP ──

    private void StartOtpTimer()
    {
        _otpTimer?.Stop();
        _otpTimer = new System.Timers.Timer(1000);
        _otpTimer.Elapsed += (_, _) =>
        {
            MainThread.BeginInvokeOnMainThread(UpdateOtpLabels);
        };
        _otpTimer.Start();
    }

    private void UpdateOtpLabels()
    {
        foreach (var kvp in _otpLabels)
        {
            var item = _allItems.FirstOrDefault(i => i.Id == kvp.Key);
            if (item != null && item.IsExpanded)
            {
                var code = TotpHelper.GenerateCode(item.OtpSecret);
                kvp.Value.Text = code.Length == 6 ? code.Insert(3, " ") : code;
            }
        }
        foreach (var kvp in _otpTimers)
        {
            var remaining = TotpHelper.GetRemainingSeconds();
            kvp.Value.Text = remaining + " \u062B\u0627\u0646\u064A\u0629";
        }
    }

    private void StopOtpTimer()
    {
        _otpTimer?.Stop();
        _otpTimer?.Dispose();
        _otpTimer = null;
    }
}
