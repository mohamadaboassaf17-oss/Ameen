using Ameen.Windows.Models;

namespace Ameen.Windows.Pages;

public partial class AddEditItemPage : ContentPage
{
    private VaultItem? _existingItem;
    private string _selectedType = "password";
    private string _generatedPassword = "";

    public event EventHandler<VaultItem>? ItemSaved;

    public AddEditItemPage(VaultItem? existingItem = null)
    {
        InitializeComponent();
        _existingItem = existingItem;

        MessagingCenter.Subscribe<GeneratorPage, string>(this, "PasswordGenerated", (_, password) =>
        {
            _generatedPassword = password;
            PasswordEntry.Text = password;
        });

        if (existingItem != null)
        {
            PageTitle.Text = "تعديل عنصر";
            TitleEntry.Text = existingItem.Title;
            NotesEditor.Text = existingItem.Notes;
            OtpSecretEntry.Text = existingItem.OtpSecret;

            switch (existingItem.Type)
            {
                case "password":
                    TypePicker.SelectedIndex = 0;
                    UsernameEntry.Text = existingItem.Username;
                    PasswordEntry.Text = existingItem.Password;
                    UrlEntry.Text = existingItem.Url;
                    break;
                case "note":
                    TypePicker.SelectedIndex = 1;
                    ContentEditor.Text = existingItem.Content;
                    break;
                case "card":
                    TypePicker.SelectedIndex = 2;
                    CardholderEntry.Text = existingItem.Cardholder;
                    NumberEntry.Text = existingItem.Number;
                    ExpiryEntry.Text = existingItem.Expiry;
                    CvvEntry.Text = existingItem.Cvv;
                    break;
            }
        }
        else
        {
            TypePicker.SelectedIndex = 0;
        }
    }

    private void OnTypeChanged(object sender, EventArgs e)
    {
        _selectedType = TypePicker.SelectedIndex switch
        {
            0 => "password",
            1 => "note",
            2 => "card",
            _ => "password"
        };

        PasswordFields.IsVisible = _selectedType == "password";
        NoteFields.IsVisible = _selectedType == "note";
        CardFields.IsVisible = _selectedType == "card";
    }

    private async void OnGeneratePasswordClicked(object sender, EventArgs e)
    {
        await Navigation.PushModalAsync(new GeneratorPage());
    }

    private async void OnSaveClicked(object sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(TitleEntry.Text))
        {
            await DisplayAlert("تنبيه", "الرجاء إدخال عنوان للعنصر", "موافق");
            return;
        }

        var item = _existingItem ?? new VaultItem();
        item.Title = TitleEntry.Text.Trim();
        item.Type = _selectedType;
        item.Notes = NotesEditor.Text?.Trim() ?? "";
        item.OtpSecret = OtpSecretEntry.Text?.Trim() ?? "";

        switch (_selectedType)
        {
            case "password":
                item.Username = UsernameEntry.Text?.Trim() ?? "";
                item.Password = PasswordEntry.Text ?? "";
                item.Url = UrlEntry.Text?.Trim() ?? "";
                item.Content = "";
                item.Cardholder = "";
                item.Number = "";
                item.Expiry = "";
                item.Cvv = "";
                break;
            case "note":
                item.Content = ContentEditor.Text?.Trim() ?? "";
                item.Username = "";
                item.Password = "";
                item.Url = "";
                item.Cardholder = "";
                item.Number = "";
                item.Expiry = "";
                item.Cvv = "";
                break;
            case "card":
                item.Cardholder = CardholderEntry.Text?.Trim() ?? "";
                item.Number = NumberEntry.Text?.Trim() ?? "";
                item.Expiry = ExpiryEntry.Text?.Trim() ?? "";
                item.Cvv = CvvEntry.Text ?? "";
                item.Username = "";
                item.Password = "";
                item.Url = "";
                item.Content = "";
                break;
        }

        ItemSaved?.Invoke(this, item);
        MessagingCenter.Unsubscribe<GeneratorPage, string>(this, "PasswordGenerated");
        await Navigation.PopModalAsync();
    }

    private async void OnCancelClicked(object sender, EventArgs e)
    {
        MessagingCenter.Unsubscribe<GeneratorPage, string>(this, "PasswordGenerated");
        await Navigation.PopModalAsync();
    }
}
