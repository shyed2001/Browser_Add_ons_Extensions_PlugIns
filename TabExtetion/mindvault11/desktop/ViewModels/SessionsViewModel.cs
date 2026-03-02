// ViewModels/SessionsViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using MindVault.Desktop.Models;
using MindVault.Desktop.Services;

namespace MindVault.Desktop.ViewModels;

public partial class SessionsViewModel : ObservableObject
{
    private readonly CompanionApiClient _api;

    [ObservableProperty] private bool _isLoading;
    [ObservableProperty] private string _statusMessage = string.Empty;
    [ObservableProperty] private string _libraryId = string.Empty;
    [ObservableProperty] private string _libraryName = string.Empty;
    [ObservableProperty] private Session? _selectedSession;

    public ObservableCollection<Session> Sessions { get; } = new();

    public SessionsViewModel(CompanionApiClient api) => _api = api;

    [RelayCommand]
    public async Task LoadAsync(string libraryId)
    {
        LibraryId = libraryId;
        IsLoading = true;
        Sessions.Clear();

        var sessions = await _api.GetSessionsAsync(libraryId);
        if (sessions is null)
        {
            StatusMessage = $"Failed to load sessions: {_api.LastError}";
            IsLoading = false;
            return;
        }

        foreach (var s in sessions)
            Sessions.Add(s);

        StatusMessage = sessions.Count == 0
            ? "No sessions yet."
            : $"{sessions.Count} session{(sessions.Count == 1 ? "" : "s")}";
        IsLoading = false;
    }
}
