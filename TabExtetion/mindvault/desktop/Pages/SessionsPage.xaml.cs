// Pages/SessionsPage.xaml.cs
using MindVault.Desktop.ViewModels;

namespace MindVault.Desktop.Pages;

[QueryProperty(nameof(LibraryId),   "libraryId")]
[QueryProperty(nameof(LibraryName), "libraryName")]
public partial class SessionsPage : ContentPage
{
    private readonly SessionsViewModel _vm;

    public string LibraryId
    {
        set { _vm.LibraryId = value; }
    }

    public string LibraryName
    {
        set
        {
            _vm.LibraryName = Uri.UnescapeDataString(value ?? string.Empty);
            Title = _vm.LibraryName;
        }
    }

    public SessionsPage(SessionsViewModel vm)
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

    private async void OnOpenTabsClicked(object sender, EventArgs e)
    {
        if (_vm.SelectedSession is null) return;
        await Shell.Current.GoToAsync(
            $"{nameof(TabsPage)}?libraryId={_vm.LibraryId}&sessionId={_vm.SelectedSession.Id}");
    }
}
