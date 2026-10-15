import { monthKey, shiftMonth } from './dates';
import type { Budget, Refund, Transaction } from './model';

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  refund: number;
  netSpend: number;
  budget?: number;
  remaining?: number;
  usageRate?: number;
  byCategory: { categoryId: string; amount: number }[];
}

export function summarizeMonth(month: string, txs: Transaction[], refunds: Refund[], budget?: Budget): MonthSummary {
  let income = 0;
  let expense = 0;
  let refund = 0;
  const byCat = new Map<string, number>();
  const add = (id: string, v: number) => byCat.set(id, (byCat.get(id) ?? 0) + v);
  const txById = new Map(txs.map((t) => [t.id, t]));

  for (const t of txs) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') {
      expense += t.amount;
      add(t.categoryId, t.amount);
    }
  }
  for (const r of refunds) {
    if (monthKey(r.date) !== month) continue;
    const orig = txById.get(r.originalTxId);
    if (!orig) continue;
    refund += r.amount;
    add(orig.categoryId, -r.amount);
  }

  const netSpend = expense - refund;
  const total = budget?.total;
  return {
    month,
    income,
    expense,
    refund,
    netSpend,
    budget: total,
    remaining: total === undefined ? undefined : total - netSpend,
    usageRate: total ? netSpend / total : undefined,
    byCategory: [...byCat.entries()]
      .filter(([, amount]) => amount !== 0)
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function summarizeDay(date: string, txs: Transaction[], refunds: Refund[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.date !== date) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') expense += t.amount;
  }
  const refund = refunds.filter((r) => r.date === date).reduce((s, r) => s + r.amount, 0);
  return { income, expense, refund, netSpend: expense - refund };
}

export function monthlyTrend(endMonth: string, count: number, txs: Transaction[], refunds: Refund[]) {
  return Array.from({ length: count }, (_, i) => {
    const s = summarizeMonth(shiftMonth(endMonth, i - count + 1), txs, refunds);
    return { month: s.month, netSpend: s.netSpend, income: s.income };
  });
}
