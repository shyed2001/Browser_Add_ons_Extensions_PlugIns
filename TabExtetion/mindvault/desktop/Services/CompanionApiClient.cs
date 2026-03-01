// Services/CompanionApiClient.cs
// Typed HTTP client for the companion daemon REST API at http://127.0.0.1:47821
// All methods return null on failure and set LastError so callers can display a message.

using System.Net.Http.Json;
using MindVault.Desktop.Models;
using MvTab = MindVault.Desktop.Models.Tab;

namespace MindVault.Desktop.Services;

/// <summary>
/// Wraps companion REST API calls. Injected as a singleton via MauiProgram DI.
/// </summary>
public class CompanionApiClient
{
    private readonly HttpClient _http;
    public string? LastError { get; private set; }

    public CompanionApiClient(HttpClient http)
    {
        _http = http;
    }

    // -------------------------------------------------------------------------
    // Health
    // -------------------------------------------------------------------------

    /// <summary>GET /health — returns null if daemon not running.</summary>
    public async Task<HealthResponse?> GetHealthAsync(CancellationToken ct = default)
    {
        try
        {
            LastError = null;
            return await _http.GetFromJsonAsync<HealthResponse>("/health", ct);
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Libraries
    // -------------------------------------------------------------------------

    public async Task<List<Library>?> GetLibrariesAsync(CancellationToken ct = default)
    {
        try
        {
            LastError = null;
            return await _http.GetFromJsonAsync<List<Library>>("/libraries", ct)
                   ?? new List<Library>();
        }
        catch (Exception ex) { LastError = ex.Message; return null; }
    }

    public async Task<Library?> GetLibraryAsync(string id, CancellationToken ct = default)
    {
        try
        {
            LastError = null;
            return await _http.GetFromJsonAsync<Library>($"/libraries/{id}", ct);
        }
        catch (Exception ex) { LastError = ex.Message; return null; }
    }

    // -------------------------------------------------------------------------
    // Sessions
    // -------------------------------------------------------------------------

    public async Task<List<Session>?> GetSessionsAsync(string libraryId, CancellationToken ct = default)
    {
        try
        {
            LastError = null;
            return await _http.GetFromJsonAsync<List<Session>>($"/libraries/{libraryId}/sessions", ct)
                   ?? new List<Session>();
        }
        catch (Exception ex) { LastError = ex.Message; return null; }
    }

    // -------------------------------------------------------------------------
    // Tabs
    // -------------------------------------------------------------------------

    public async Task<List<MvTab>?> GetTabsAsync(string libraryId, CancellationToken ct = default)
    {
        try
        {
            LastError = null;
            return await _http.GetFromJsonAsync<List<MvTab>>($"/libraries/{libraryId}/tabs", ct)
                   ?? new List<MvTab>();
        }
        catch (Exception ex) { LastError = ex.Message; return null; }
    }

    // -------------------------------------------------------------------------
    // Search
    // -------------------------------------------------------------------------

    public async Task<List<SearchResult>?> SearchAsync(string libraryId, string query, CancellationToken ct = default)
    {
        try
        {
            LastError = null;
            var url = $"/search?libId={Uri.EscapeDataString(libraryId)}&q={Uri.EscapeDataString(query)}";
            return await _http.GetFromJsonAsync<List<SearchResult>>(url, ct)
                   ?? new List<SearchResult>();
        }
        catch (Exception ex) { LastError = ex.Message; return null; }
    }
}
