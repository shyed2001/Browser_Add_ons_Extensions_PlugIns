import { describe, it, expect } from 'vitest';
import {
  getRepeatIndicatorsHtml,
  getRepeatIndicatorLabel,
  getRepeatLevel,
  RGYB_CSS,
} from './rgyb';

describe('getRepeatIndicatorsHtml — RGYB system (v1.1 parity)', () => {
  it('returns empty string for 0 or negative repeatCount', () => {
    expect(getRepeatIndicatorsHtml(0)).toBe('');
    expect(getRepeatIndicatorsHtml(-1)).toBe('');
  });

  it('repeatCount=1 → single red tick', () => {
    const html = getRepeatIndicatorsHtml(1);
    expect(html).toContain(`class="${RGYB_CSS.TICK_R}"`);
    expect(html).toContain('✔');
    expect(html).not.toContain('★');
  });

  it('repeatCount=2 → red tick + yellow tick', () => {
    const html = getRepeatIndicatorsHtml(2);
    expect(html).toContain(`class="${RGYB_CSS.TICK_R}"`);
    expect(html).toContain(`class="${RGYB_CSS.TICK_Y}"`);
    expect(html).not.toContain('★');
  });

  it('repeatCount=3 → red + yellow + green ticks', () => {
    const html = getRepeatIndicatorsHtml(3);
    expect(html).toContain(`class="${RGYB_CSS.TICK_R}"`);
    expect(html).toContain(`class="${RGYB_CSS.TICK_Y}"`);
    expect(html).toContain(`class="${RGYB_CSS.TICK_G}"`);
    expect(html).not.toContain(`class="${RGYB_CSS.TICK_B}"`);
  });

  it('repeatCount=4 → red + yellow + green + blue ticks', () => {
    const html = getRepeatIndicatorsHtml(4);
    expect(html).toContain(`class="${RGYB_CSS.TICK_R}"`);
    expect(html).toContain(`class="${RGYB_CSS.TICK_Y}"`);
    expect(html).toContain(`class="${RGYB_CSS.TICK_G}"`);
    expect(html).toContain(`class="${RGYB_CSS.TICK_B}"`);
    expect(html).not.toContain('★');
  });

  it('repeatCount=5 → exactly 1 red star, no ticks', () => {
    const html = getRepeatIndicatorsHtml(5);
    expect(html).toContain(`class="${RGYB_CSS.STAR_RED}"`);
    expect(html).toContain('★');
    expect(html).not.toContain('✔');
    // Exactly 1 star
    const starCount = (html.match(/★/g) ?? []).length;
    expect(starCount).toBe(1);
  });

  it('repeatCount=6 → 1 red star + 1 red tick', () => {
    const html = getRepeatIndicatorsHtml(6);
    expect(html).toContain('★');
    expect(html).toContain('✔');
    expect(html).toContain(`class="${RGYB_CSS.TICK_R}"`);
    expect(html).not.toContain(`class="${RGYB_CSS.TICK_Y}"`);
  });

  it('repeatCount=9 → 1 red star + 4 ticks (R,Y,G,B)', () => {
    const html = getRepeatIndicatorsHtml(9);
    const starCount = (html.match(/★/g) ?? []).length;
    const tickCount = (html.match(/✔/g) ?? []).length;
    expect(starCount).toBe(1);
    expect(tickCount).toBe(4);
  });

  it('repeatCount=10 → exactly 2 red stars, no ticks', () => {
    const html = getRepeatIndicatorsHtml(10);
    const starCount = (html.match(/★/g) ?? []).length;
    const tickCount = (html.match(/✔/g) ?? []).length;
    expect(starCount).toBe(2);
    expect(tickCount).toBe(0);
  });

  it('repeatCount=11 → 2 red stars + 1 red tick', () => {
    const html = getRepeatIndicatorsHtml(11);
    const starCount = (html.match(/★/g) ?? []).length;
    const tickCount = (html.match(/✔/g) ?? []).length;
    expect(starCount).toBe(2);
    expect(tickCount).toBe(1);
  });

  it('repeatCount=15 → exactly 3 red stars, no ticks', () => {
    const html = getRepeatIndicatorsHtml(15);
    const starCount = (html.match(/★/g) ?? []).length;
    const tickCount = (html.match(/✔/g) ?? []).length;
    expect(starCount).toBe(3);
    expect(tickCount).toBe(0);
  });

  it('repeatCount=20 → 4 red stars, no ticks', () => {
    const html = getRepeatIndicatorsHtml(20);
    const starCount = (html.match(/★/g) ?? []).length;
    expect(starCount).toBe(4);
  });

  // Verify exact v1.1 formula: stars = floor(n/5), ticks = n%5
  it.each([
    [1, 0, 1],
    [2, 0, 2],
    [3, 0, 3],
    [4, 0, 4],
    [5, 1, 0],
    [6, 1, 1],
    [7, 1, 2],
    [8, 1, 3],
    [9, 1, 4],
    [10, 2, 0],
    [13, 2, 3],
    [25, 5, 0],
    [26, 5, 1],
  ])(
    'repeatCount=%i → %i stars and %i ticks',
    (count, expectedStars, expectedTicks) => {
      const html = getRepeatIndicatorsHtml(count);
      const starCount = (html.match(/★/g) ?? []).length;
      const tickCount = (html.match(/✔/g) ?? []).length;
      expect(starCount).toBe(expectedStars);
      expect(tickCount).toBe(expectedTicks);
    }
  );
});

describe('getRepeatIndicatorLabel', () => {
  it('returns empty for 0', () => expect(getRepeatIndicatorLabel(0)).toBe(''));
  it('1 → "1✔"', () => expect(getRepeatIndicatorLabel(1)).toBe('1✔'));
  it('5 → "1★"', () => expect(getRepeatIndicatorLabel(5)).toBe('1★'));
  it('7 → "1★ 2✔"', () => expect(getRepeatIndicatorLabel(7)).toBe('1★ 2✔'));
  it('10 → "2★"', () => expect(getRepeatIndicatorLabel(10)).toBe('2★'));
});

describe('getRepeatLevel', () => {
  it('1 → new', () => expect(getRepeatLevel(1)).toBe('new'));
  it('3 → low', () => expect(getRepeatLevel(3)).toBe('low'));
  it('7 → medium', () => expect(getRepeatLevel(7)).toBe('medium'));
  it('15 → high', () => expect(getRepeatLevel(15)).toBe('high'));
  it('20 → vault', () => expect(getRepeatLevel(20)).toBe('vault'));
});
