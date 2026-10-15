import { describe, it, expect } from 'vitest';
import { summarizeMonth, monthlyTrend } from '../../src/core/budget';
import type { Refund, Transaction } from '../../src/core/model';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'expense', amount: 1000, date: '2026-10-15', categoryId: 'food', paymentMethodId: 'p',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});

describe('summarizeMonth', () => {
  const a = tx({ id: 'a', amount: 30000, date: '2026-10-31', categoryId: 'food' });
  const txs = [
    a,
    tx({ amount: 5000, date: '2026-10-01', categoryId: 'cafe' }),
    tx({ amount: 2000, date: '2026-11-01', categoryId: 'cafe' }),
    tx({ type: 'income', amount: 3000000, date: '2026-10-25', categoryId: 'salary' }),
    tx({ type: 'transfer', amount: 500000, date: '2026-10-10', categoryId: '', toPaymentMethodId: 'q' }),
  ];
  const refunds: Refund[] = [{ id: 'r', originalTxId: 'a', amount: 10000, date: '2026-11-02', createdAt: 1 }];

  it('excludes transfers and applies refunds on refund date month', () => {
    const oct = summarizeMonth('2026-10', txs, refunds, { month: '2026-10', total: 100000 });
    expect(oct).toMatchObject({ income: 3000000, expense: 35000, refund: 0, netSpend: 35000, budget: 100000, remaining: 65000, usageRate: 0.35 });
    expect(oct.byCategory).toEqual([{ categoryId: 'food', amount: 30000 }, { categoryId: 'cafe', amount: 5000 }]);

    const nov = summarizeMonth('2026-11', txs, refunds);
    expect(nov).toMatchObject({ expense: 2000, refund: 10000, netSpend: -8000, budget: undefined, remaining: undefined, usageRate: undefined });
    expect(nov.byCategory).toEqual([{ categoryId: 'cafe', amount: 2000 }, { categoryId: 'food', amount: -10000 }]);
  });

  it('zero budget does not divide by zero', () => {
    const s = summarizeMonth('2026-10', txs, [], { month: '2026-10', total: 0 });
    expect(s.usageRate).toBeUndefined();
    expect(s.remaining).toBe(-35000);
  });

  it('trend lists months oldest first', () => {
    expect(monthlyTrend('2026-11', 3, txs, refunds)).toEqual([
      { month: '2026-09', netSpend: 0, income: 0 },
      { month: '2026-10', netSpend: 35000, income: 3000000 },
      { month: '2026-11', netSpend: -8000, income: 0 },
    ]);
  });
});
