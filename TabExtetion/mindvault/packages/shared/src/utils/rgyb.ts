// ============================================================
// MindVault — RGYB Repeat Indicator System
// Preserved exactly from v1.1. Thresholds confirmed:
//   5 saves = 1 Red Star (★)
//   Ticks cycle: 1=Red, 2=Yellow, 3=Green, 4=Blue, then reset
// ============================================================

/** CSS class names for RGYB indicators — match dashboard.css exactly */
export const RGYB_CSS = {
  STAR_RED: 'star-red',
  TICK_R: 'tick-r',
  TICK_Y: 'tick-y',
  TICK_G: 'tick-g',
  TICK_B: 'tick-b',
} as const;

/** Color values matching the CSS classes */
export const RGYB_COLORS = {
  STAR_RED: '#d32f2f',
  TICK_R: '#f44336',
  TICK_Y: '#ffeb3b',
  TICK_G: '#4caf50',
  TICK_B: '#2196f3',
} as const;

/** Tick classes in order: position 0=Red, 1=Yellow, 2=Green, 3=Blue */
const TICK_CLASSES = [
  RGYB_CSS.TICK_R,
  RGYB_CSS.TICK_Y,
  RGYB_CSS.TICK_G,
  RGYB_CSS.TICK_B,
] as const;

/**
 * Generate the RGYB HTML string for a given repeatCount.
 *
 * Algorithm (preserved from v1.1):
 *   stars = Math.floor(repeatCount / 5)  → number of ★ (each = 5 saves)
 *   ticks = repeatCount % 5              → remainder ticks (0-4)
 *
 * Examples:
 *   1  → ✔ (red)
 *   2  → ✔✔ (red, yellow)
 *   3  → ✔✔✔ (red, yellow, green)
 *   4  → ✔✔✔✔ (red, yellow, green, blue)
 *   5  → ★ (red star)
 *   6  → ★✔ (red star + red tick)
 *   10 → ★★ (two red stars)
 *   11 → ★★✔ (two red stars + red tick)
 */
export function getRepeatIndicatorsHtml(repeatCount: number): string {
  if (repeatCount <= 0) return '';

  const stars = Math.floor(repeatCount / 5);
  const ticks = repeatCount % 5;

  let html = '';

  for (let i = 0; i < stars; i++) {
    html += `<span class="${RGYB_CSS.STAR_RED}">★</span>`;
  }

  for (let i = 0; i < ticks && i < 4; i++) {
    html += `<span class="${TICK_CLASSES[i]}">✔</span>`;
  }

  return html;
}

/**
 * Get a plain-text label for the repeat count (for accessibility / export).
 * e.g. repeatCount=7 → "1★ 2✔"
 */
export function getRepeatIndicatorLabel(repeatCount: number): string {
  if (repeatCount <= 0) return '';
  const stars = Math.floor(repeatCount / 5);
  const ticks = repeatCount % 5;
  const parts: string[] = [];
  if (stars > 0) parts.push(`${stars}★`);
  if (ticks > 0) parts.push(`${ticks}✔`);
  return parts.join(' ');
}

/**
 * Get the "level" descriptor for a repeat count — useful for filtering/sorting.
 */
export function getRepeatLevel(repeatCount: number): 'new' | 'low' | 'medium' | 'high' | 'vault' {
  if (repeatCount <= 1) return 'new';
  if (repeatCount <= 4) return 'low';
  if (repeatCount <= 9) return 'medium';
  if (repeatCount <= 19) return 'high';
  return 'vault';
}
