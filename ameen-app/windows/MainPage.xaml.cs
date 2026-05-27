using Ameen.Windows.Services;
using Ameen.Windows.Models;
using Ameen.Windows.Pages;
using System;

namespace Ameen.Windows;

public partial class MainPage : ContentPage
{
    private readonly WindowsHelloService _helloService;
    private readonly WindowsAccountIsolationService _isolationService;
    private readonly KeyDerivationService _keyDerivation;
    private BiometricState _state = new();

    private const string STORED_SALT_KEY = "ameen_vault_salt";
    private const string STORED_VERIFY_KEY = "ameen_verify_hash";
    private const string STORED_ENC_KEY = "ameen_encrypted_key";
    private const string STORED_ENC_IV = "ameen_encrypted_iv";

    public MainPage()
    {
        InitializeComponent();
        _helloService = new WindowsHelloService();
        _isolationService = new WindowsAccountIsolationService();
        _keyDerivation = new KeyDerivationService();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            _state.IsAvailable = await _helloService.IsWindowsHelloAvailableAsync();
            _state.IsKeyStored = await _helloService.IsKeyStoredAsync();
            _state.RequiresMasterPassword = !_state.IsKeyStored;

            if (!_state.IsAvailable)
            {
                StatusLabel.Text = "Windows Hello غير مفعّل. الرجاء تفعيله من إعدادات ويندوز.";
                return;
            }

            if (_state.RequiresMasterPassword)
            {
                StatusLabel.Text = "يُرجى إدخال كلمة المرور الرئيسية (مطلوبة بعد إعادة التشغيل)";
                MasterPasswordEntry.IsVisible = true;
                UnlockButton.IsVisible = true;
            }
            else
            {
                StatusLabel.Text = "استخدم Windows Hello لفتح الخزنة";
                WindowsHelloButton.IsVisible = true;
            }
        }
        catch (Exception ex)
        {
            ErrorLabel.Text = $"خطأ: {ex.Message}";
        }
    }

    private async void OnWindowsHelloClicked(object sender, EventArgs e)
    {
        try
        {
            ErrorLabel.Text = "";
            SuccessLabel.Text = "";

            var encKeyB64 = Preferences.Default.Get<string?>(STORED_ENC_KEY, null);
            var ivB64 = Preferences.Default.Get<string?>(STORED_ENC_IV, null);

            if (string.IsNullOrEmpty(encKeyB64) || string.IsNullOrEmpty(ivB64))
            {
                StatusLabel.Text = "يُرجى إدخال كلمة المرور الرئيسية أولاً";
                MasterPasswordEntry.IsVisible = true;
                UnlockButton.IsVisible = true;
                WindowsHelloButton.IsVisible = false;
                return;
            }

            var encKey = Convert.FromBase64String(encKeyB64);
            var iv = Convert.FromBase64String(ivB64);

            var (success, vaultKey, error) = await _helloService.UnwrapVaultKeyAsync(encKey, iv);

            if (success)
            {
                await Navigation.PushModalAsync(new VaultPage());
            }
            else
            {
                ErrorLabel.Text = error;
            }
        }
        catch (Exception ex)
        {
            ErrorLabel.Text = $"فشل التحقق: {ex.Message}";
        }
    }

    private async void OnUnlockClicked(object sender, EventArgs e)
    {
        try
        {
            ErrorLabel.Text = "";
            SuccessLabel.Text = "";

            var password = MasterPasswordEntry.Text;
            if (string.IsNullOrWhiteSpace(password))
            {
                ErrorLabel.Text = "الرجاء إدخال كلمة المرور";
                return;
            }

            var saltB64 = Preferences.Default.Get<string?>(STORED_SALT_KEY, null);
            var verifyB64 = Preferences.Default.Get<string?>(STORED_VERIFY_KEY, null);

            if (string.IsNullOrEmpty(saltB64))
            {
                var salt = _keyDerivation.GenerateSalt();
                var result = await _keyDerivation.DeriveKey(password, salt);

                Preferences.Set(STORED_SALT_KEY, Convert.ToBase64String(salt));
                Preferences.Set(STORED_VERIFY_KEY, Convert.ToBase64String(result.VerificationHash));

                var (createSuccess, createError) = await _helloService.CreateKeyCredentialAsync();
                if (!createSuccess)
                {
                    ErrorLabel.Text = createError;
                    return;
                }

                var (wrapSuccess, encryptedKey, iv, wrapError) = await _helloService.WrapVaultKeyAsync(result.VaultKey);
                if (!wrapSuccess)
                {
                    ErrorLabel.Text = wrapError;
                    return;
                }

                Preferences.Set(STORED_ENC_KEY, Convert.ToBase64String(encryptedKey));
                Preferences.Set(STORED_ENC_IV, Convert.ToBase64String(iv));

                SuccessLabel.Text = "تم إنشاء الخزنة بنجاح";
                MasterPasswordEntry.Text = string.Empty;
                await Navigation.PushModalAsync(new VaultPage());
            }
            else
            {
                var salt = Convert.FromBase64String(saltB64);
                var expectedHash = Convert.FromBase64String(verifyB64!);

                var isValid = await _keyDerivation.VerifyKey(password, salt, expectedHash);

                if (!isValid)
                {
                    ErrorLabel.Text = "كلمة المرور غير صحيحة";
                    return;
                }

                MasterPasswordEntry.Text = string.Empty;
                await Navigation.PushModalAsync(new VaultPage());
            }
        }
        catch (Exception ex)
        {
            ErrorLabel.Text = $"خطأ: {ex.Message}";
        }
    }
}
