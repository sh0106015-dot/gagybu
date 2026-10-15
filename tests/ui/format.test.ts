import { describe, it, expect } from 'vitest';
import { monthLabel, dayLabel, signedAmount, sortTxDesc } from '../../src/ui/format';
import type { Transaction } from '../../src/core/model';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', type: 'expense', amount: 12000, date: '2026-10-15', categoryId: 'c', paymentMethodId: 'p',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});

describe('format', () => {
  it('labels', () => {
    expect(monthLabel('2026-10')).toBe('2026년 10월');
    expect(dayLabel('2026-10-15')).toBe('10월 15일 (목)');
  });
  it('signed amounts', () => {
    expect(signedAmount(tx({}))).toBe('-12,000원');
    expect(signedAmount(tx({ type: 'income' }))).toBe('+12,000원');
    expect(signedAmount(tx({ type: 'transfer' }))).toBe('12,000원');
  });
  it('sorts newest first by date, time, createdAt', () => {
    const list = [
      tx({ id: 'a', date: '2026-10-14', time: '23:00' }),
      tx({ id: 'b', date: '2026-10-15', time: '09:00' }),
      tx({ id: 'c', date: '2026-10-15', time: '09:00', createdAt: 2 }),
      tx({ id: 'd', date: '2026-10-15' }),
    ];
    expect(list.sort(sortTxDesc).map((t) => t.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});
