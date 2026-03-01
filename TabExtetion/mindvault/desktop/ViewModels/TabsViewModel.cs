// ViewModels/TabsViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using MindVault.Desktop.Models;
using MindVault.Desktop.Services;
using MvTab = MindVault.Desktop.Models.Tab;

namespace MindVault.Desktop.ViewModels;

public partial class TabsViewModel : ObservableObject
{
    private readonly CompanionApiClient _api;

    [ObservableProperty] private bool _isLoading;
    [ObservableProperty] private string _statusMessage = string.Empty;
    [ObservableProperty] private string _libraryId = string.Empty;
    [ObservableProperty] private string _searchQuery = string.Empty;
    [ObservableProperty] private MvTab? _selectedTab;

    public ObservableCollection<MvTab> Tabs        { get; } = new();
    public ObservableCollection<MvTab> FilteredTabs { get; } = new();

    public TabsViewModel(CompanionApiClient api) => _api = api;

    [RelayCommand]
    public async Task LoadAsync(string libraryId)
    {
        LibraryId = libraryId;
        IsLoading = true;
        Tabs.Clear();
        FilteredTabs.Clear();

        var tabs = await _api.GetTabsAsync(libraryId);
        if (tabs is null)
        {
            StatusMessage = $"Failed to load tabs: {_api.LastError}";
            IsLoading = false;
            return;
        }

        foreach (var t in tabs)
        {
            Tabs.Add(t);
            FilteredTabs.Add(t);
        }

        StatusMessage = $"{tabs.Count} tab{(tabs.Count == 1 ? "" : "s")}";
        IsLoading = false;
    }

    [RelayCommand]
    public async Task SearchAsync()
    {
        if (string.IsNullOrWhiteSpace(SearchQuery))
        {
            // Reset to full list
            FilteredTabs.Clear();
            foreach (var t in Tabs)
                FilteredTabs.Add(t);
            return;
        }

        IsLoading = true;
        var results = await _api.SearchAsync(LibraryId, SearchQuery);
        if (results is null)
        {
            StatusMessage = $"Search failed: {_api.LastError}";
            IsLoading = false;
            return;
        }

        // Map search results back to Tab objects for display
        FilteredTabs.Clear();
        var ids = results.Select(r => r.EntityId).ToHashSet();
        foreach (var t in Tabs.Where(t => ids.Contains(t.Id)))
            FilteredTabs.Add(t);

        StatusMessage = $"{FilteredTabs.Count} result{(FilteredTabs.Count == 1 ? "" : "s")} for \"{SearchQuery}\"";
        IsLoading = false;
    }
}
