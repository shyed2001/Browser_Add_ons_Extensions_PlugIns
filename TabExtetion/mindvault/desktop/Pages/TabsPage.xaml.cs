// Pages/TabsPage.xaml.cs
using MindVault.Desktop.ViewModels;

namespace MindVault.Desktop.Pages;

[QueryProperty(nameof(LibraryId), "libraryId")]
[QueryProperty(nameof(SessionId), "sessionId")]
public partial class TabsPage : ContentPage
{
    private readonly TabsViewModel _vm;

    public string LibraryId { set => _vm.LibraryId = value; }
    public string SessionId { set { /* future: filter by session */ } }

    public TabsPage(TabsViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        if (!string.IsNullOrEmpty(_vm.LibraryId))
            await _vm.LoadCommand.ExecuteAsync(_vm.LibraryId);
    }
}
