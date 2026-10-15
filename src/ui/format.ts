import { formatWon } from '../core/money';
import { toDateKey } from '../core/dates';
import { periodKey } from '../core/period';
import type { Transaction } from '../core/model';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const currentMonth = () => toDateKey(new Date()).slice(0, 7);
export const today = () => toDateKey(new Date());
/** 월 시작일을 반영한 현재 기간 키 */
export const currentPeriod = (startDay: number) => periodKey(today(), startDay);

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}년 ${m}월`;
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

export function timeLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function signedAmount(t: Transaction): string {
  if (t.type === 'income') return `+${formatWon(t.amount)}`;
  if (t.type === 'expense') return `-${formatWon(t.amount)}`;
  return `🐷 ${formatWon(t.amount)}`;
}

export function sortTxDesc(a: Transaction, b: Transaction): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.time ?? '').localeCompare(a.time ?? '') ||
    b.createdAt - a.createdAt
  );
}
