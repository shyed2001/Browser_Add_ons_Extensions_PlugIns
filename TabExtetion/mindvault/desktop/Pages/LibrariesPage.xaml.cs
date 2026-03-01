// Pages/LibrariesPage.xaml.cs
using MindVault.Desktop.ViewModels;

namespace MindVault.Desktop.Pages;

public partial class LibrariesPage : ContentPage
{
    private readonly LibrariesViewModel _vm;

    public LibrariesPage(LibrariesViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _vm.LoadCommand.ExecuteAsync(null);
    }

    private async void OnOpenSessionsClicked(object sender, EventArgs e)
    {
        if (_vm.SelectedLibrary is null) return;
        await Shell.Current.GoToAsync(
            $"{nameof(SessionsPage)}?libraryId={_vm.SelectedLibrary.Id}&libraryName={Uri.EscapeDataString(_vm.SelectedLibrary.Name)}");
    }
}
