// Models/ApiModels.cs
// DTOs mirroring the companion REST API (Go) response shapes.
// Kept flat / record-style for easy JSON deserialization via System.Text.Json.

using System.Text.Json.Serialization;

namespace MindVault.Desktop.Models;

/// <summary>Library — top-level container for all user data.</summary>
public record Library(
    [property: JsonPropertyName("id")]          string Id,
    [property: JsonPropertyName("name")]        string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("createdAt")]   long CreatedAt,
    [property: JsonPropertyName("updatedAt")]   long UpdatedAt,
    [property: JsonPropertyName("isEncrypted")] bool IsEncrypted,
    [property: JsonPropertyName("passwordSalt")]string? PasswordSalt
);

/// <summary>Session — snapshot of open tabs at a point in time.</summary>
public record Session(
    [property: JsonPropertyName("id")]          string Id,
    [property: JsonPropertyName("libraryId")]   string LibraryId,
    [property: JsonPropertyName("name")]        string Name,
    [property: JsonPropertyName("notes")]       string Notes,
    [property: JsonPropertyName("createdAt")]   long CreatedAt,
    [property: JsonPropertyName("updatedAt")]   long UpdatedAt
);

/// <summary>Tab — individual saved tab record.</summary>
public record Tab(
    [property: JsonPropertyName("id")]          string Id,
    [property: JsonPropertyName("libraryId")]   string LibraryId,
    [property: JsonPropertyName("sessionId")]   string? SessionId,
    [property: JsonPropertyName("url")]         string Url,
    [property: JsonPropertyName("title")]       string Title,
    [property: JsonPropertyName("favIconUrl")]  string? FavIconUrl,
    [property: JsonPropertyName("savedAt")]     long SavedAt,
    [property: JsonPropertyName("notes")]       string Notes,
    [property: JsonPropertyName("colour")]      string? Colour
);

/// <summary>SearchResult — full-text search hit from the companion.</summary>
public record SearchResult(
    [property: JsonPropertyName("entityType")] string EntityType,
    [property: JsonPropertyName("entityId")]   string EntityId,
    [property: JsonPropertyName("title")]      string Title,
    [property: JsonPropertyName("url")]        string Url,
    [property: JsonPropertyName("snippet")]    string Snippet
);

/// <summary>HealthResponse — GET /health response.</summary>
public record HealthResponse(
    [property: JsonPropertyName("status")]  string Status,
    [property: JsonPropertyName("version")] string Version
);

/// <summary>Companion connection settings.</summary>
public class CompanionSettings
{
    public string BaseUrl { get; set; } = "http://127.0.0.1:47821";
    public string Token   { get; set; } = string.Empty;
}
