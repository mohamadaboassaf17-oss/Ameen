using System.Text.Json;
using ZXing;

namespace Ameen.Windows.Services;

public class QrCodeScanner
{
    public static async Task<SyncPayload?> ScanFromFileAsync()
    {
        try
        {
            var result = await FilePicker.Default.PickAsync(new PickOptions
            {
                PickerTitle = "اختر صورة رمز QR",
                FileTypes = new FilePickerFileType(new Dictionary<DevicePlatform, IEnumerable<string>>
                {
                    { DevicePlatform.WinUI, new[] { ".png", ".jpg", ".jpeg", ".bmp" } }
                })
            });

            if (result == null) return null;

            using var stream = await result.OpenReadAsync();
            using var bitmap = new System.Drawing.Bitmap(stream);
            var reader = new BarcodeReader
            {
                AutoRotate = true,
                Options = new ZXing.Common.DecodingOptions
                {
                    TryHarder = true,
                    PossibleFormats = new[] { BarcodeFormat.QR_CODE }
                }
            };

            var decodeResult = reader.Decode(bitmap);
            if (decodeResult == null) return null;

            return JsonSerializer.Deserialize<SyncPayload>(decodeResult.Text);
        }
        catch
        {
            return null;
        }
    }
}

public class SyncPayload
{
    public string Ip { get; set; } = "";
    public int Port { get; set; }
    public string Fp { get; set; } = "";
    public string Pk { get; set; } = "";
}
