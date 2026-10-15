import { shiftMonth } from './dates';
import { periodKey } from './period';
import type { Budget, Refund, Transaction } from './model';

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  fixedExpense: number;
  variableExpense: number;
  refund: number;
  netSpend: number;
  budget?: number;
  remaining?: number;
  usageRate?: number;
  byCategory: { categoryId: string; amount: number }[];
}

/** month는 기간 키다. startDay가 1이 아니면 월 시작일 기준 기간(periodKey)으로 묶는다. */
export function summarizeMonth(
  month: string, txs: Transaction[], refunds: Refund[], budget?: Budget, startDay = 1,
): MonthSummary {
  let income = 0;
  let expense = 0;
  let fixedExpense = 0;
  let refund = 0;
  const byCat = new Map<string, number>();
  const add = (id: string, v: number) => byCat.set(id, (byCat.get(id) ?? 0) + v);
  const txById = new Map(txs.map((t) => [t.id, t]));

  for (const t of txs) {
    if (periodKey(t.date, startDay) !== month) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') {
      expense += t.amount;
      if (t.fixed) fixedExpense += t.amount;
      add(t.categoryId, t.amount);
    }
  }
  for (const r of refunds) {
    if (periodKey(r.date, startDay) !== month) continue;
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
    fixedExpense,
    variableExpense: expense - fixedExpense,
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

export function monthlyTrend(endMonth: string, count: number, txs: Transaction[], refunds: Refund[], startDay = 1) {
  return Array.from({ length: count }, (_, i) => {
    const s = summarizeMonth(shiftMonth(endMonth, i - count + 1), txs, refunds, undefined, startDay);
    return { month: s.month, netSpend: s.netSpend, income: s.income };
  });
}
