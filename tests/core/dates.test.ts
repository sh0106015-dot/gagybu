import { describe, it, expect } from 'vitest';
import { toDateKey, toTimeKey, monthKey, shiftMonth, txAt } from '../../src/core/dates';

describe('dates', () => {
  it('formats local date/time', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(toDateKey(d)).toBe('2026-01-05');
    expect(toTimeKey(d)).toBe('09:07');
  });
  it('month helpers', () => {
    expect(monthKey('2026-10-31')).toBe('2026-10');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('txAt builds local timestamp', () => {
    expect(txAt('2026-10-15', '12:30')).toBe(new Date(2026, 9, 15, 12, 30).getTime());
    expect(txAt('2026-10-15')).toBe(new Date(2026, 9, 15, 0, 0).getTime());
  });
});
