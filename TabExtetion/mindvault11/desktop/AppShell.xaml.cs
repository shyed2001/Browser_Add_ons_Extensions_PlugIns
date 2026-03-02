using MindVault.Desktop.Pages;

namespace MindVault.Desktop;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();

        // Register deep-link routes (not in flyout)
        Routing.RegisterRoute(nameof(SessionsPage), typeof(SessionsPage));
        Routing.RegisterRoute(nameof(TabsPage),     typeof(TabsPage));
    }
}
