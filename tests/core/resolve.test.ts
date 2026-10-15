import { describe, it, expect } from 'vitest';
import { normalizeMerchant, guessCategory } from '../../src/core/merchant';
import { mapPaymentMethod, resolveTxDateTime, matchKeyFor } from '../../src/core/resolve';
import type { Category, PaymentMethod } from '../../src/core/model';
import { UNCATEGORIZED_ID } from '../../src/core/model';

const cat = (id: string, name: string, archived = false): Category => ({ id, name, kind: 'expense', sortOrder: 0, archived });
const pm = (id: string, name: string, matchKeys: string[], archived = false): PaymentMethod =>
  ({ id, name, kind: 'card', matchKeys, sortOrder: 0, archived });

describe('merchant', () => {
  it('normalizes spacing, case, corp marks', () => {
    expect(normalizeMerchant('(주) 스타벅스 강남점')).toBe('스타벅스강남점');
    expect(normalizeMerchant('GS25 역삼점')).toBe(normalizeMerchant('gs25역삼점'));
    expect(normalizeMerchant(undefined)).toBeUndefined();
    expect(normalizeMerchant('  ')).toBeUndefined();
  });
  it('guesses category by keyword when category exists', () => {
    const cats = [cat('c1', '카페'), cat('c2', '편의점')];
    expect(guessCategory('스타벅스', cats)).toBe('c1');
    expect(guessCategory('GS25역삼점', cats)).toBe('c2');
    expect(guessCategory('알수없는가게', cats)).toBe(UNCATEGORIZED_ID);
    expect(guessCategory('스타벅스', [cat('c1', '카페', true)])).toBe(UNCATEGORIZED_ID);
    expect(guessCategory(undefined, cats)).toBe(UNCATEGORIZED_ID);
  });
});

describe('mapPaymentMethod', () => {
  const methods = [pm('p1', '가나카드', ['가나카드*1234']), pm('p2', '다라카드', ['다라카드']), pm('p3', '옛카드', ['옛카드'], true)];
  it('prefers name+last4, then name', () => {
    expect(mapPaymentMethod(methods, '가나카드', '1234')?.id).toBe('p1');
    expect(mapPaymentMethod(methods, '가나카드', '9999')).toBeUndefined();
    expect(mapPaymentMethod(methods, '다라카드', '5678')?.id).toBe('p2');
    expect(mapPaymentMethod(methods, '다라 카드')?.id).toBe('p2');
  });
  it('ignores archived and missing name', () => {
    expect(mapPaymentMethod(methods, '옛카드')).toBeUndefined();
    expect(mapPaymentMethod(methods, undefined, '1234')).toBeUndefined();
  });
  it('matchKeyFor', () => {
    expect(matchKeyFor('가나카드', '1234')).toBe('가나카드*1234');
    expect(matchKeyFor('마바페이')).toBe('마바페이');
  });
});

describe('resolveTxDateTime', () => {
  const recv = new Date(2026, 9, 15, 12, 31).getTime();
  it('uses explicit time with receive year', () => {
    expect(resolveTxDateTime({ month: 10, day: 15, hour: 12, minute: 30 }, recv)).toEqual({
      date: '2026-10-15', time: '12:30', at: new Date(2026, 9, 15, 12, 30).getTime(), fromReceipt: false, uncertain: false,
    });
  });
  it('year boundary: 12/31 23:58 received 1/1 00:05 belongs to previous year', () => {
    const r = resolveTxDateTime({ month: 12, day: 31, hour: 23, minute: 58 }, new Date(2027, 0, 1, 0, 5).getTime());
    expect(r.date).toBe('2026-12-31');
    expect(r.uncertain).toBe(false);
  });
  it('falls back to receive time', () => {
    const r = resolveTxDateTime({}, recv);
    expect(r).toMatchObject({ date: '2026-10-15', time: '12:31', fromReceipt: true, uncertain: false });
  });
  it('marks delayed delivery (>24h) uncertain', () => {
    const r = resolveTxDateTime({ month: 10, day: 13, hour: 9, minute: 0 }, recv);
    expect(r.date).toBe('2026-10-13');
    expect(r.uncertain).toBe(true);
  });
  it('invalid date falls back to receive time and is uncertain', () => {
    const r = resolveTxDateTime({ month: 2, day: 30, hour: 1, minute: 0 }, recv);
    expect(r).toMatchObject({ date: '2026-10-15', fromReceipt: true, uncertain: true });
  });
});
