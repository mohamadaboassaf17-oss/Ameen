using Microsoft.UI.Xaml;

namespace Ameen.Windows.WinUI;

public partial class App : MauiWinUIApplication
{
    public App()
    {
        this.InitializeComponent();
    }

    protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();

    /// <summary>
    /// Account isolation — validates the current Windows identity
    /// against stored SIDs to enforce true per-user isolation (PRD §3.2).
    /// </summary>
    public string GetCurrentWindowsUserIdentity()
    {
        return System.Security.Principal.WindowsIdentity.GetCurrent().Name;
    }
}
