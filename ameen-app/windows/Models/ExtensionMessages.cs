namespace Ameen.Windows.Models;

public class ExtensionRequest
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public string? Payload { get; set; }
}

public class ExtensionResponse
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public string? Data { get; set; }
    public string? Error { get; set; }
}

public class GetItemPayload
{
    public string ItemId { get; set; } = "";
}

public class SearchPayload
{
    public string Query { get; set; } = "";
}

public class OtpPayload
{
    public string Secret { get; set; } = "";
}

public class PasswordPayload
{
    public int Length { get; set; } = 20;
    public bool UseSymbols { get; set; } = true;
    public bool UseDigits { get; set; } = true;
    public bool UseUppercase { get; set; } = true;
    public bool UseLowercase { get; set; } = true;
}
