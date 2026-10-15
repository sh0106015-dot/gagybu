import { toDateKey, toTimeKey } from './dates';
import type { PaymentMethod } from './model';
import { DATE_UNCERTAIN_MS } from './model';

const squash = (s: string) => s.replace(/\s+/g, '');

export function matchKeyFor(cardName: string, last4?: string): string {
  return last4 ? `${squash(cardName)}*${last4}` : squash(cardName);
}

export function mapPaymentMethod(methods: PaymentMethod[], cardName?: string, last4?: string): PaymentMethod | undefined {
  if (!cardName) return undefined;
  const active = methods.filter((m) => !m.archived);
  const tryKeys = last4 ? [matchKeyFor(cardName, last4), matchKeyFor(cardName)] : [matchKeyFor(cardName)];
  for (const key of tryKeys) {
    const hit = active.find((m) => m.matchKeys.some((k) => squash(k) === key));
    if (hit) return hit;
  }
  return undefined;
}

const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

export function resolveTxDateTime(
  p: { month?: number; day?: number; hour?: number; minute?: number },
  receivedAt: number,
): { date: string; time: string; at: number; fromReceipt: boolean; uncertain: boolean } {
  const fromReceipt = (uncertain: boolean) => {
    const r = new Date(receivedAt);
    return { date: toDateKey(r), time: toTimeKey(r), at: receivedAt, fromReceipt: true, uncertain };
  };
  if (p.month === undefined || p.day === undefined) return fromReceipt(false);

  const year = new Date(receivedAt).getFullYear();
  const build = (y: number) => new Date(y, p.month! - 1, p.day!, p.hour ?? 0, p.minute ?? 0);
  let d = build(year);
  if (d.getMonth() !== p.month - 1 || d.getDate() !== p.day) return fromReceipt(true);
  if (d.getTime() > receivedAt + FUTURE_TOLERANCE_MS) d = build(year - 1);

  return {
    date: toDateKey(d),
    time: toTimeKey(d),
    at: d.getTime(),
    fromReceipt: false,
    uncertain: Math.abs(receivedAt - d.getTime()) > DATE_UNCERTAIN_MS,
  };
}
