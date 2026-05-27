namespace Ameen.Windows.Models;

public class BiometricState
{
    public bool IsAvailable { get; set; }
    public bool IsKeyStored { get; set; }
    public bool RequiresMasterPassword { get; set; }
    public byte[]? EncryptedVaultKey { get; set; }
    public byte[]? Iv { get; set; }
    public string? StatusMessage { get; set; }
    public string? ErrorMessage { get; set; }
}
