using System.Text.Json;
using Ameen.Windows.Models;
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
            var source = new BitmapLuminanceSource(bitmap);
            var reader = new BarcodeReaderGeneric
            {
                AutoRotate = true,
                Options = new ZXing.Common.DecodingOptions
                {
                    TryHarder = true,
                    PossibleFormats = new[] { BarcodeFormat.QR_CODE }
                }
            };

            var decodeResult = reader.Decode(source);
            if (decodeResult == null) return null;

            return JsonSerializer.Deserialize<SyncPayload>(decodeResult.Text);
        }
        catch
        {
            return null;
        }
    }
}

file class BitmapLuminanceSource : LuminanceSource
{
    private readonly byte[] _luminances;

    public BitmapLuminanceSource(System.Drawing.Bitmap bitmap)
        : base(bitmap.Width, bitmap.Height)
    {
        _luminances = new byte[bitmap.Width * bitmap.Height];
        for (int y = 0; y < bitmap.Height; y++)
        {
            for (int x = 0; x < bitmap.Width; x++)
            {
                var pixel = bitmap.GetPixel(x, y);
                _luminances[y * bitmap.Width + x] = (byte)((pixel.R + pixel.G + pixel.B) / 3);
            }
        }
    }

    public override byte[] Matrix => _luminances;

    public override byte[] getRow(int y, byte[]? row)
    {
        row ??= new byte[Width];
        Array.Copy(_luminances, y * Width, row, 0, Width);
        return row;
    }
}
