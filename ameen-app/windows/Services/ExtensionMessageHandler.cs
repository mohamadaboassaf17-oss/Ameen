using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ameen.Windows.Models;

namespace Ameen.Windows.Services;

public class ExtensionMessageHandler
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private List<VaultItem> _vaultItems = new();

    public void SetVaultData(List<VaultItem> items)
    {
        _vaultItems = items;
    }

    public ExtensionResponse Handle(ExtensionRequest request)
    {
        try
        {
            return request.Type switch
            {
                "ping" => HandlePing(request),
                "get_vault" => HandleGetVault(request),
                "get_item" => HandleGetItem(request),
                "search_items" => HandleSearchItems(request),
                "generate_otp" => HandleGenerateOtp(request),
                "generate_password" => HandleGeneratePassword(request),
                _ => new ExtensionResponse
                {
                    Id = request.Id,
                    Type = "error",
                    Error = $"نوع الطلب غير معروف: {request.Type}"
                }
            };
        }
        catch (Exception ex)
        {
            return new ExtensionResponse
            {
                Id = request.Id,
                Type = "error",
                Error = $"خطأ داخلي: {ex.Message}"
            };
        }
    }

    private ExtensionResponse HandlePing(ExtensionRequest request)
    {
        return new ExtensionResponse { Id = request.Id, Type = "pong" };
    }

    private ExtensionResponse HandleGetVault(ExtensionRequest request)
    {
        var data = JsonSerializer.Serialize(
            _vaultItems.Select(item => new
            {
                item.Id,
                item.Type,
                item.Title,
                item.Username,
                item.Password,
                item.Url,
                item.Content,
                item.Cardholder,
                item.Number,
                item.Expiry,
                item.Cvv,
                item.Notes,
                item.OtpSecret,
                item.UpdatedAt,
                item.IsConflict,
                item.ConflictDate,
                item.ConflictOriginalId
            }),
            _jsonOptions);

        return new ExtensionResponse { Id = request.Id, Type = "vault", Data = data };
    }

    private ExtensionResponse HandleGetItem(ExtensionRequest request)
    {
        var payload = JsonSerializer.Deserialize<GetItemPayload>(request.Payload ?? "{}", _jsonOptions);
        if (payload == null || string.IsNullOrEmpty(payload.ItemId))
            return new ExtensionResponse { Id = request.Id, Type = "error", Error = "معرّف العنصر مطلوب" };

        var item = _vaultItems.FirstOrDefault(i => i.Id == payload.ItemId);
        if (item == null)
            return new ExtensionResponse { Id = request.Id, Type = "error", Error = "العنصر غير موجود" };

        var data = JsonSerializer.Serialize(new
        {
            item.Id,
            item.Type,
            item.Title,
            item.Username,
            item.Password,
            item.Url,
            item.Content,
            item.Cardholder,
            item.Number,
            item.Expiry,
            item.Cvv,
            item.Notes,
            item.OtpSecret,
            item.UpdatedAt,
            item.IsConflict,
            item.ConflictDate,
            item.ConflictOriginalId
        }, _jsonOptions);

        return new ExtensionResponse { Id = request.Id, Type = "item", Data = data };
    }

    private ExtensionResponse HandleSearchItems(ExtensionRequest request)
    {
        var payload = JsonSerializer.Deserialize<SearchPayload>(request.Payload ?? "{}", _jsonOptions);
        var query = payload?.Query ?? "";

        List<VaultItem> results;
        if (string.IsNullOrWhiteSpace(query))
        {
            results = _vaultItems.ToList();
        }
        else
        {
            var q = query.Trim();
            results = _vaultItems.Where(i =>
                (i.Title?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (i.Username?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (i.Url?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (i.Notes?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false)
            ).ToList();
        }

        var data = JsonSerializer.Serialize(
            results.Select(item => new
            {
                item.Id,
                item.Type,
                item.Title,
                item.Username,
                item.Password,
                item.Url,
                item.Content,
                item.Cardholder,
                item.Number,
                item.Expiry,
                item.Cvv,
                item.Notes,
                item.OtpSecret,
                item.UpdatedAt,
                item.IsConflict,
                item.ConflictDate,
                item.ConflictOriginalId
            }),
            _jsonOptions);

        return new ExtensionResponse { Id = request.Id, Type = "search_results", Data = data };
    }

    private ExtensionResponse HandleGenerateOtp(ExtensionRequest request)
    {
        var payload = JsonSerializer.Deserialize<OtpPayload>(request.Payload ?? "{}", _jsonOptions);
        if (payload == null || string.IsNullOrEmpty(payload.Secret))
            return new ExtensionResponse { Id = request.Id, Type = "error", Error = "المفتاح السري مطلوب" };

        var code = TotpHelper.GenerateCode(payload.Secret);
        var remaining = TotpHelper.GetRemainingSeconds();

        var data = JsonSerializer.Serialize(new { code, remaining }, _jsonOptions);
        return new ExtensionResponse { Id = request.Id, Type = "otp_code", Data = data };
    }

    private ExtensionResponse HandleGeneratePassword(ExtensionRequest request)
    {
        var payload = JsonSerializer.Deserialize<PasswordPayload>(request.Payload ?? "{}", _jsonOptions);
        int length = Math.Clamp(payload?.Length ?? 20, 4, 128);
        bool useSymbols = payload?.UseSymbols ?? true;
        bool useDigits = payload?.UseDigits ?? true;
        bool useUppercase = payload?.UseUppercase ?? true;
        bool useLowercase = payload?.UseLowercase ?? true;

        var password = GeneratePassword(length, useSymbols, useDigits, useUppercase, useLowercase);
        var data = JsonSerializer.Serialize(new { password }, _jsonOptions);
        return new ExtensionResponse { Id = request.Id, Type = "password", Data = data };
    }

    private static string GeneratePassword(int length, bool useSymbols, bool useDigits, bool useUppercase, bool useLowercase)
    {
        var chars = "";
        if (useLowercase) chars += "abcdefghijklmnopqrstuvwxyz";
        if (useUppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (useDigits) chars += "0123456789";
        if (useSymbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
        if (chars.Length == 0) chars = "abcdefghijklmnopqrstuvwxyz0123456789";

        var result = new char[length];
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        for (int i = 0; i < length; i++)
            result[i] = chars[bytes[i] % chars.Length];
        return new string(result);
    }
}
