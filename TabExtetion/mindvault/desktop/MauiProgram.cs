using Microsoft.Extensions.Logging;
using MindVault.Desktop.Services;
using MindVault.Desktop.ViewModels;
using MindVault.Desktop.Pages;

namespace MindVault.Desktop;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // ---- Companion HTTP Client ------------------------------------------------
        // Read token from %LOCALAPPDATA%\MindVault\token (written by companion daemon)
        var token = TokenStore.ReadToken() ?? string.Empty;

        builder.Services.AddHttpClient<CompanionApiClient>(client =>
        {
            client.BaseAddress = new Uri("http://127.0.0.1:47821");
            client.DefaultRequestHeaders.Add("X-MindVault-Token", token);
            client.Timeout = TimeSpan.FromSeconds(10);
        });

        // ---- Pages & ViewModels --------------------------------------------------
        builder.Services.AddSingleton<LibrariesViewModel>();
        builder.Services.AddTransient<SessionsViewModel>();
        builder.Services.AddTransient<TabsViewModel>();

        builder.Services.AddSingleton<LibrariesPage>();
        builder.Services.AddTransient<SessionsPage>();
        builder.Services.AddTransient<TabsPage>();
        builder.Services.AddSingleton<SettingsPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
