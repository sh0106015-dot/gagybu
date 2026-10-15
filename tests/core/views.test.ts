import { describe, it, expect } from 'vitest';
import { calendarGrid, weekRanges, rangeTotals } from '../../src/core/views';
import type { Refund, Transaction } from '../../src/core/model';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'expense', amount: 1000, date: '2026-10-15', categoryId: 'c', paymentMethodId: 'p',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});

describe('calendarGrid', () => {
  it('fills whole Sunday–Saturday weeks around the period', () => {
    const g = calendarGrid('2026-10', 1);
    expect(g[0]).toEqual({ date: '2026-09-27', inPeriod: false });
    expect(g[4]).toEqual({ date: '2026-10-01', inPeriod: true });
    expect(g.at(-1)).toEqual({ date: '2026-11-07', inPeriod: false });
    expect(g.length % 7).toBe(0);
    expect(g).toHaveLength(42);
  });
});

describe('weekRanges', () => {
  it('lists Sunday–Saturday weeks covering the period, newest first', () => {
    expect(weekRanges('2026-10', 1)).toEqual([
      { from: '2026-10-25', to: '2026-10-31' },
      { from: '2026-10-18', to: '2026-10-24' },
      { from: '2026-10-11', to: '2026-10-17' },
      { from: '2026-10-04', to: '2026-10-10' },
      { from: '2026-09-27', to: '2026-10-03' },
    ]);
  });
});

describe('rangeTotals', () => {
  it('sums income and net expense in an inclusive date range, excluding savings', () => {
    const txs = [
      tx({ amount: 5000, date: '2026-10-11' }),
      tx({ id: 'big', amount: 20000, date: '2026-10-17' }),
      tx({ type: 'income', amount: 30000, date: '2026-10-12' }),
      tx({ type: 'transfer', amount: 99000, date: '2026-10-12', categoryId: '', savingTerm: 'short' }),
      tx({ amount: 7000, date: '2026-10-18' }),
    ];
    const refunds: Refund[] = [{ id: 'r', originalTxId: 'big', amount: 2000, date: '2026-10-13', createdAt: 1 }];
    expect(rangeTotals('2026-10-11', '2026-10-17', txs, refunds)).toEqual({
      income: 30000, expense: 23000, savings: 99000, total: 7000,
    });
  });
});
