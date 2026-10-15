import { summarizeMonth } from './budget';
import { shiftMonth } from './dates';
import type { Refund, Transaction } from './model';
import { periodDates } from './period';

export interface NoSpendDay {
  date: string;
  spent: boolean;
  future: boolean;
}

/**
 * 무지출 챌린지. 변동 지출(고정지출 제외)이 없는 날을 센다.
 * 수입·이체·고정지출은 무지출을 깨지 않는다. 오늘 이후 날짜는 세지 않는다.
 */
export function noSpendDays(month: string, txs: Transaction[], startDay: number, today: string) {
  const spentDates = new Set(txs.filter((t) => t.type === 'expense' && !t.fixed).map((t) => t.date));
  const days: NoSpendDay[] = periodDates(month, startDay).map((date) => ({
    date,
    spent: spentDates.has(date),
    future: date > today,
  }));
  const past = days.filter((d) => !d.future);
  return { days, elapsed: past.length, count: past.filter((d) => !d.spent).length };
}

/** 이번 기간 카테고리별 소비를 직전 3개 기간 평균과 비교한다. */
export function categoryVsAverage(month: string, txs: Transaction[], refunds: Refund[], startDay: number) {
  const current = summarizeMonth(month, txs, refunds, undefined, startDay).byCategory.filter((c) => c.amount > 0);
  const previous = [1, 2, 3].map((i) => summarizeMonth(shiftMonth(month, -i), txs, refunds, undefined, startDay));
  return current.map((c) => {
    const sum = previous.reduce((s, p) => s + (p.byCategory.find((x) => x.categoryId === c.categoryId)?.amount ?? 0), 0);
    const average = Math.round(sum / 3);
    return {
      categoryId: c.categoryId,
      amount: c.amount,
      average,
      diffRate: average > 0 ? (c.amount - average) / average : undefined,
    };
  });
}

/** 선저축 후지출: 수입에서 저축 목표를 먼저 떼고 남은 돈을 한 달 예산으로 쓴다. */
export function suggestBudget(i: { income: number; saving: number; fixed: number }) {
  const budget = Math.max(0, i.income - i.saving);
  return { budget, living: Math.max(0, budget - i.fixed) };
}
