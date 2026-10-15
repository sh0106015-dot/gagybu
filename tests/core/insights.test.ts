import { describe, it, expect } from 'vitest';
import { summarizeMonth, monthlyTrend } from '../../src/core/budget';
import { noSpendDays, categoryVsAverage, suggestBudget } from '../../src/core/insights';
import { daysIntoPeriod } from '../../src/core/period';
import type { Refund, Transaction } from '../../src/core/model';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'expense', amount: 1000, date: '2026-10-15', categoryId: 'food', paymentMethodId: 'p',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});

describe('summarizeMonth with start day and fixed expenses', () => {
  const txs = [
    tx({ amount: 500000, date: '2026-10-25', fixed: true, categoryId: 'rent' }),
    tx({ amount: 20000, date: '2026-11-10' }),
    tx({ amount: 7000, date: '2026-10-24' }),
  ];
  it('uses the pay-day period and splits fixed / variable', () => {
    const s = summarizeMonth('2026-10', txs, [], { month: '2026-10', total: 1000000 }, 25);
    expect(s).toMatchObject({ expense: 520000, fixedExpense: 500000, variableExpense: 20000, netSpend: 520000, remaining: 480000 });
    expect(summarizeMonth('2026-09', txs, [], undefined, 25).expense).toBe(7000);
  });
  it('defaults to calendar months', () => {
    expect(summarizeMonth('2026-10', txs, []).expense).toBe(507000);
  });
  it('trend respects start day', () => {
    expect(monthlyTrend('2026-10', 2, txs, [], 25).map((t) => t.netSpend)).toEqual([7000, 520000]);
  });
});

describe('daysIntoPeriod', () => {
  it('counts from the period start (1-based)', () => {
    expect(daysIntoPeriod('2026-10-01', 1)).toBe(1);
    expect(daysIntoPeriod('2026-10-27', 25)).toBe(3);
    expect(daysIntoPeriod('2026-11-02', 25)).toBe(9);
  });
});

describe('noSpendDays', () => {
  const txs = [
    tx({ date: '2026-10-02' }),
    tx({ date: '2026-10-02' }),
    tx({ date: '2026-10-04', type: 'income' }),
    tx({ date: '2026-10-05', type: 'transfer', categoryId: '', toPaymentMethodId: 'q' }),
    tx({ date: '2026-10-06', fixed: true }),
  ];
  it('counts elapsed days without variable spending; fixed, income, transfer do not break the streak', () => {
    const r = noSpendDays('2026-10', txs, 1, '2026-10-06');
    expect(r.elapsed).toBe(6);
    expect(r.count).toBe(5);
    expect(r.days.slice(0, 3)).toEqual([
      { date: '2026-10-01', spent: false, future: false },
      { date: '2026-10-02', spent: true, future: false },
      { date: '2026-10-03', spent: false, future: false },
    ]);
    expect(r.days[6]).toEqual({ date: '2026-10-07', spent: false, future: true });
  });
  it('past periods count every day', () => {
    expect(noSpendDays('2026-09', [], 1, '2026-10-06')).toMatchObject({ elapsed: 30, count: 30 });
  });
});

describe('categoryVsAverage', () => {
  const txs = [
    tx({ categoryId: 'cafe', amount: 10000, date: '2026-07-10' }),
    tx({ categoryId: 'cafe', amount: 20000, date: '2026-08-10' }),
    tx({ categoryId: 'cafe', amount: 30000, date: '2026-09-10' }),
    tx({ categoryId: 'cafe', amount: 26000, date: '2026-10-10' }),
    tx({ categoryId: 'shop', amount: 5000, date: '2026-10-10' }),
  ];
  const refunds: Refund[] = [];
  it('compares this period with the average of the previous three', () => {
    expect(categoryVsAverage('2026-10', txs, refunds, 1)).toEqual([
      { categoryId: 'cafe', amount: 26000, average: 20000, diffRate: 0.3 },
      { categoryId: 'shop', amount: 5000, average: 0, diffRate: undefined },
    ]);
  });
});

describe('suggestBudget (save first)', () => {
  it('budget = income − saving; living = budget − fixed', () => {
    expect(suggestBudget({ income: 3000000, saving: 800000, fixed: 900000 })).toEqual({ budget: 2200000, living: 1300000 });
  });
  it('never goes negative', () => {
    expect(suggestBudget({ income: 1000000, saving: 1200000, fixed: 300000 })).toEqual({ budget: 0, living: 0 });
  });
});

describe('spendByPaymentKind', () => {
  it('sums net expense per payment kind, refunds subtract from the original method, transfers ignored', async () => {
    const { spendByPaymentKind } = await import('../../src/core/insights');
    const methods = [
      { id: 'c1', name: '신용', kind: 'credit' as const, matchKeys: [], sortOrder: 0, archived: false },
      { id: 'c2', name: '삼성', kind: 'credit' as const, matchKeys: [], sortOrder: 1, archived: false },
      { id: 'd1', name: '체크', kind: 'debit' as const, matchKeys: [], sortOrder: 2, archived: false },
      { id: 'h', name: '현금', kind: 'cash' as const, matchKeys: [], sortOrder: 3, archived: false },
    ];
    const txs = [
      tx({ id: 'a', amount: 30000, paymentMethodId: 'c1', date: '2026-10-03' }),
      tx({ id: 'b', amount: 20000, paymentMethodId: 'c2', date: '2026-10-04' }),
      tx({ id: 'c', amount: 8000, paymentMethodId: 'd1', date: '2026-10-05' }),
      tx({ id: 'd', amount: 5000, paymentMethodId: 'h', date: '2026-09-30' }),
      tx({ id: 'e', type: 'transfer', amount: 99000, paymentMethodId: 'd1', toPaymentMethodId: 'h', categoryId: '', date: '2026-10-05' }),
      tx({ id: 'f', type: 'income', amount: 1000, paymentMethodId: 'h', date: '2026-10-05' }),
    ];
    const refunds: Refund[] = [{ id: 'r', originalTxId: 'a', amount: 10000, date: '2026-10-09', createdAt: 1 }];
    expect(spendByPaymentKind('2026-10', txs, refunds, methods, 1)).toEqual([
      { kind: 'credit', amount: 40000, count: 2 },
      { kind: 'debit', amount: 8000, count: 1 },
    ]);
  });
});
