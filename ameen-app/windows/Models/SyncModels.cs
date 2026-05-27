namespace Ameen.Windows.Models;

public class SyncResponseDto
{
    public string MessageType { get; set; } = "";
    public string VaultId { get; set; } = "";
    public List<SyncItemDto> Items { get; set; } = new();
    public int SyncedItemCount { get; set; }
    public int NewItemCount { get; set; }
    public int ConflictCount { get; set; }
}

public class SyncItemDto
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
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
    public int Revision { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsConflict { get; set; }
    public DateTime? ConflictDate { get; set; }
    public string? ConflictOriginalId { get; set; }
}
