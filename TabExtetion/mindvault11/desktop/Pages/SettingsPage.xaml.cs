// Pages/SettingsPage.xaml.cs
using MindVault.Desktop.Services;

namespace MindVault.Desktop.Pages;

public partial class SettingsPage : ContentPage
{
    public SettingsPage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var tokenPath = Path.Combine(appData, "MindVault", "token");
        TokenPathLabel.Text = tokenPath;

        if (TokenStore.IsCompanionInstalled())
        {
            TokenStatusLabel.Text = "✓ Token found — companion is installed";
            TokenStatusLabel.TextColor = Colors.Green;
        }
        else
        {
            TokenStatusLabel.Text = "✗ Token not found — run install-windows.ps1 first";
            TokenStatusLabel.TextColor = Colors.Red;
        }
    }
}
