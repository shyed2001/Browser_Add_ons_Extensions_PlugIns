// ViewModels/LibrariesViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using MindVault.Desktop.Models;
using MindVault.Desktop.Services;

namespace MindVault.Desktop.ViewModels;

public partial class LibrariesViewModel : ObservableObject
{
    private readonly CompanionApiClient _api;

    [ObservableProperty] private bool _isLoading;
    [ObservableProperty] private string _statusMessage = "Connecting to companion...";
    [ObservableProperty] private bool _isConnected;
    [ObservableProperty] private Library? _selectedLibrary;

    public ObservableCollection<Library> Libraries { get; } = new();

    public LibrariesViewModel(CompanionApiClient api) => _api = api;

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        StatusMessage = "Connecting...";

        // Check health first
        var health = await _api.GetHealthAsync();
        if (health is null)
        {
            IsConnected = false;
            StatusMessage = $"Companion offline — {_api.LastError ?? "not reachable"}";
            IsLoading = false;
            return;
        }

        IsConnected = true;
        StatusMessage = $"Connected — companion {health.Version}";

        var libs = await _api.GetLibrariesAsync();
        if (libs is null)
        {
            StatusMessage = $"Failed to load libraries: {_api.LastError}";
            IsLoading = false;
            return;
        }

        Libraries.Clear();
        foreach (var lib in libs)
            Libraries.Add(lib);

        if (Libraries.Count == 0)
            StatusMessage = "No libraries found. Save some tabs in the extension first.";

        IsLoading = false;
    }
}
