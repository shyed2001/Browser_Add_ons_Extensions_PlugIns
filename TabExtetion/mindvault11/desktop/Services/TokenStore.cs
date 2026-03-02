// Services/TokenStore.cs
// Reads the companion auth token from %LOCALAPPDATA%\MindVault\token
// (same file written by companion/internal/auth/token.go).

namespace MindVault.Desktop.Services;

public static class TokenStore
{
    private static readonly string TokenPath =
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MindVault", "token");

    /// <summary>
    /// Reads the companion shared-secret token.
    /// Returns null if the token file does not exist (companion not installed).
    /// </summary>
    public static string? ReadToken()
    {
        try
        {
            if (!File.Exists(TokenPath)) return null;
            return File.ReadAllText(TokenPath).Trim();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Returns true when the companion appears to be installed.</summary>
    public static bool IsCompanionInstalled() => File.Exists(TokenPath);
}
