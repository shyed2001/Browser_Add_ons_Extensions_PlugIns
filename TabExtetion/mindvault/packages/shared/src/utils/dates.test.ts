import { describe, it, expect } from 'vitest';
import { parseLocaleTimestamp, parseTimestampsArray, toDateSlice, formatDisplayDate } from './dates';

const FALLBACK = 1706000000000; // known fallback for testing

describe('parseLocaleTimestamp — v1.1 locale string parsing', () => {
  it('parses US locale string (M/D/YYYY, H:MM:SS AM/PM)', () => {
    const result = parseLocaleTimestamp('2/22/2026, 10:30:45 AM', FALLBACK);
    const d = new Date(result);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(1); // February = 1
    expect(d.getUTCDate()).toBe(22);
  });

  it('parses ISO-style string directly', () => {
    const result = parseLocaleTimestamp('2026-02-22T10:30:45', FALLBACK);
    expect(result).toBeGreaterThan(0);
    expect(result).not.toBe(FALLBACK);
  });

  it('parses UK locale DD/MM/YYYY format', () => {
    const result = parseLocaleTimestamp('22/02/2026, 10:30:45', FALLBACK);
    // Should parse to some valid date
    expect(result).toBeGreaterThan(0);
  });

  it('returns fallback for empty string', () => {
    expect(parseLocaleTimestamp('', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for clearly invalid string', () => {
    expect(parseLocaleTimestamp('not-a-date', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for undefined-like value', () => {
    expect(parseLocaleTimestamp(null as unknown as string, FALLBACK)).toBe(FALLBACK);
  });
});

describe('parseTimestampsArray', () => {
  it('returns [fallback] for empty array', () => {
    expect(parseTimestampsArray([], FALLBACK)).toEqual([FALLBACK]);
  });

  it('parses array of US locale strings and sorts ascending', () => {
    const result = parseTimestampsArray(
      ['2/22/2026, 10:30:45 AM', '2/21/2026, 3:15:20 PM'],
      FALLBACK
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toBeLessThan(result[1] as number);
  });

  it('handles mixed valid/invalid strings using fallback for invalid', () => {
    const result = parseTimestampsArray(['2/22/2026, 10:30:45 AM', 'bad-date'], FALLBACK);
    expect(result).toHaveLength(2);
  });
});

describe('toDateSlice', () => {
  it('formats unix ms as YYYY-MM-DD', () => {
    // 2026-02-22T00:00:00.000Z
    const unixMs = Date.UTC(2026, 1, 22);
    expect(toDateSlice(unixMs)).toBe('2026-02-22');
  });

  it('zero-pads month and day', () => {
    const unixMs = Date.UTC(2026, 0, 5); // Jan 5
    expect(toDateSlice(unixMs)).toBe('2026-01-05');
  });
});

describe('formatDisplayDate', () => {
  it('returns a non-empty string', () => {
    const result = formatDisplayDate(Date.UTC(2026, 1, 22, 10, 30));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
