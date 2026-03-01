// ============================================================
// MindVault — Date Utilities
// Critical: handles parsing of v1.1 locale-string timestamps
// ============================================================

/**
 * Convert a v1.1 locale string timestamp to unix milliseconds.
 *
 * v1.1 stored: new Date().toLocaleString()
 * Examples:
 *   US:  "2/22/2026, 10:30:45 AM"
 *   UK:  "22/02/2026, 10:30:45"
 *   ISO: "2026-02-22T10:30:45" (already parseable)
 *
 * Strategy:
 *   1. Try Date.parse() — works for most locale formats Chrome produces
 *   2. Try manual DD/MM/YYYY HH:MM:SS parsing for UK/EU formats
 *   3. Fallback: return the provided fallback timestamp (migration time)
 */
export function parseLocaleTimestamp(localeString: string, fallback: number): number {
  if (!localeString || typeof localeString !== 'string') return fallback;

  // Attempt 1: direct parse (handles ISO and US locale strings)
  const direct = Date.parse(localeString);
  if (!isNaN(direct) && direct > 0) return direct;

  // Attempt 2: handle DD/MM/YYYY, HH:MM:SS [AM/PM] format (UK/EU locales)
  // e.g. "22/02/2026, 10:30:45" or "22/02/2026 10:30:45"
  const ddmmyyyy =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i.exec(
      localeString.trim()
    );
  if (ddmmyyyy) {
    const [, dd, mm, yyyy, hh, min, sec, ampm] = ddmmyyyy;
    let hour = parseInt(hh ?? '0', 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }
    const parsed = Date.UTC(
      parseInt(yyyy ?? '0', 10),
      parseInt(mm ?? '1', 10) - 1,
      parseInt(dd ?? '1', 10),
      hour,
      parseInt(min ?? '0', 10),
      parseInt(sec ?? '0', 10)
    );
    if (!isNaN(parsed)) return parsed;
  }

  // Fallback: use provided fallback (e.g. migration timestamp)
  return fallback;
}

/**
 * Parse all timestamps from a v1.1 record's timestamps array.
 * Returns an array of unix ms values, sorted ascending.
 */
export function parseTimestampsArray(timestamps: string[], fallback: number): number[] {
  if (!Array.isArray(timestamps) || timestamps.length === 0) return [fallback];

  const parsed = timestamps.map((ts) => parseLocaleTimestamp(ts, fallback));
  return parsed.sort((a, b) => a - b);
}

/**
 * Format a unix ms timestamp as YYYY-MM-DD string (for history date-slice indexing).
 */
export function toDateSlice(unixMs: number): string {
  const d = new Date(unixMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a unix ms timestamp as a human-readable local string for display.
 * Uses a consistent format: "DD MMM YYYY HH:MM"
 */
export function formatDisplayDate(unixMs: number): string {
  return new Date(unixMs).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
