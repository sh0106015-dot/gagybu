import { shiftMonth, toDateKey } from './dates';

/**
 * 가계부의 "한 달" 기간. 월 시작일(1~28)이 25라면 10/25~11/24가 '2026-10' 기간이다.
 * 기간은 시작하는 달의 월 키로 부른다.
 */
export function periodKey(date: string, startDay: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const month = `${y}-${String(m).padStart(2, '0')}`;
  return d >= startDay ? month : shiftMonth(month, -1);
}

export function periodRange(month: string, startDay: number): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = new Date(y, m - 1, startDay);
  const to = new Date(y, m, startDay - 1);
  return { from: toDateKey(from), to: toDateKey(to) };
}

export function periodLabel(month: string, startDay: number): string {
  const [y, m] = month.split('-').map(Number);
  if (startDay === 1) return `${y}년 ${m}월`;
  const { from, to } = periodRange(month, startDay);
  const md = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;
  return `${md(from)} ~ ${md(to)}`;
}

export function periodDates(month: string, startDay: number): string[] {
  const { from, to } = periodRange(month, startDay);
  const [y, m, d] = from.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const key = toDateKey(new Date(y, m - 1, d + i));
    out.push(key);
    if (key === to) return out;
  }
}

/** 기간 안에서 몇 번째 날인지 (첫날 = 1). */
export function daysIntoPeriod(date: string, startDay: number): number {
  return periodDates(periodKey(date, startDay), startDay).indexOf(date) + 1;
}
