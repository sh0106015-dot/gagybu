import { toDateKey } from './dates';
import type { Refund, Transaction } from './model';
import { periodRange } from './period';

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + n));
};
const weekday = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** 달력 칸: 기간 첫날이 있는 주의 일요일부터 6주(42칸). 기간 밖 날짜는 inPeriod=false. */
export function calendarGrid(month: string, startDay: number): { date: string; inPeriod: boolean }[] {
  const { from, to } = periodRange(month, startDay);
  const first = addDays(from, -weekday(from));
  const cells: { date: string; inPeriod: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(first, i);
    cells.push({ date, inPeriod: date >= from && date <= to });
  }
  return cells;
}

/** 기간을 덮는 일요일~토요일 주 목록. 최신 주가 먼저 온다. */
export function weekRanges(month: string, startDay: number): { from: string; to: string }[] {
  const { from, to } = periodRange(month, startDay);
  const weeks: { from: string; to: string }[] = [];
  for (let s = addDays(from, -weekday(from)); s <= to; s = addDays(s, 7)) weeks.push({ from: s, to: addDays(s, 6) });
  return weeks.reverse();
}

/** 날짜 범위(양 끝 포함)의 수입·순지출(환불 차감)·저축과 합계(수입 − 순지출). */
export function rangeTotals(from: string, to: string, txs: Transaction[], refunds: Refund[]) {
  let income = 0;
  let expense = 0;
  let savings = 0;
  for (const t of txs) {
    if (t.date < from || t.date > to) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') expense += t.amount;
    if (t.type === 'transfer') savings += t.amount;
  }
  for (const r of refunds) if (r.date >= from && r.date <= to) expense -= r.amount;
  return { income, expense, savings, total: income - expense };
}
