import { describe, it, expect } from 'vitest';
import { periodKey, periodRange, periodLabel, periodDates } from '../../src/core/period';

describe('period (month start day)', () => {
  it('start day 1 equals calendar month', () => {
    expect(periodKey('2026-10-01', 1)).toBe('2026-10');
    expect(periodKey('2026-10-31', 1)).toBe('2026-10');
    expect(periodRange('2026-10', 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodLabel('2026-10', 1)).toBe('2026년 10월');
  });
  it('start day 25 groups 25th to 24th under the starting month', () => {
    expect(periodKey('2026-10-25', 25)).toBe('2026-10');
    expect(periodKey('2026-11-24', 25)).toBe('2026-10');
    expect(periodKey('2026-10-24', 25)).toBe('2026-09');
    expect(periodKey('2027-01-05', 25)).toBe('2026-12');
    expect(periodRange('2026-12', 25)).toEqual({ from: '2026-12-25', to: '2027-01-24' });
    expect(periodLabel('2026-10', 25)).toBe('10/25 ~ 11/24');
  });
  it('lists every date in the period', () => {
    const d = periodDates('2026-02', 1);
    expect(d[0]).toBe('2026-02-01');
    expect(d).toHaveLength(28);
    expect(periodDates('2026-01', 25)).toHaveLength(31);
  });
});
