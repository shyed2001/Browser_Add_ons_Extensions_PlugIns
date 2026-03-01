// Converters/ValueConverters.cs
// All value converters used across MAUI pages.

using System.Globalization;

namespace MindVault.Desktop.Converters;

/// <summary>Inverts a bool — used to hide ActivityIndicator when loading is false.</summary>
public class InvertedBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && !b;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && !b;
}

/// <summary>Returns true when the string is non-null and non-empty.</summary>
public class StringToBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => !string.IsNullOrWhiteSpace(value as string);

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

/// <summary>Returns true when the value is not null.</summary>
public class IsNotNullConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is not null;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

/// <summary>
/// Maps RGYB colour codes (R/G/Y/B) to MAUI Color.
/// Matches the v1.1 colour scheme preserved in the extension.
/// </summary>
public class ColourToColorConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => (value as string) switch
        {
            "R" => Color.FromArgb("#e74c3c"),   // Red
            "G" => Color.FromArgb("#2ecc71"),   // Green
            "Y" => Color.FromArgb("#f1c40f"),   // Yellow
            "B" => Color.FromArgb("#3498db"),   // Blue
            _   => Color.FromArgb("#bdc3c7"),   // Gray (no colour)
        };

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
