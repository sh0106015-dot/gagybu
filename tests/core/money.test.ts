import { describe, it, expect } from 'vitest';
import { parseWon, formatWon } from '../../src/core/money';

describe('money', () => {
  it('parses comma separated won', () => {
    expect(parseWon('12,000')).toBe(12000);
    expect(parseWon(' 8500 ')).toBe(8500);
  });
  it('rejects invalid', () => {
    expect(parseWon('')).toBeNull();
    expect(parseWon('12.5')).toBeNull();
    expect(parseWon('-100')).toBeNull();
    expect(parseWon('1,2a')).toBeNull();
  });
  it('formats', () => {
    expect(formatWon(1234567)).toBe('1,234,567원');
    expect(formatWon(-3000)).toBe('-3,000원');
  });
});
