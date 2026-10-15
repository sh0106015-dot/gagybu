import { txAt } from './dates';
import { normalizeMerchant } from './merchant';
import type { Refund, Transaction } from './model';
import { DUP_WINDOW_MS, REFUND_LOOKBACK_MS } from './model';

export function refundableAmount(tx: Transaction, refunds: Refund[]): number {
  const used = refunds.filter((r) => r.originalTxId === tx.id).reduce((s, r) => s + r.amount, 0);
  return tx.amount - used;
}

export type RefundMatch =
  | { kind: 'one'; txId: string }
  | { kind: 'none' }
  | { kind: 'many' | 'exceeds'; txIds: string[] };

export function matchRefund(
  probe: { paymentMethodId: string; merchant?: string; amount: number; at: number },
  txs: Transaction[],
  refunds: Refund[],
): RefundMatch {
  const merchant = normalizeMerchant(probe.merchant);
  if (!merchant) return { kind: 'none' };

  const pool = txs.filter((t) => {
    if (t.type !== 'expense' || t.paymentMethodId !== probe.paymentMethodId) return false;
    if (normalizeMerchant(t.merchant) !== merchant) return false;
    const diff = probe.at - txAt(t.date, t.time);
    return diff >= -DUP_WINDOW_MS && diff <= REFUND_LOOKBACK_MS;
  });
  if (pool.length === 0) return { kind: 'none' };

  const fit = pool.filter((t) => refundableAmount(t, refunds) >= probe.amount);
  if (fit.length === 1) return { kind: 'one', txId: fit[0].id };
  if (fit.length > 1) return { kind: 'many', txIds: fit.map((t) => t.id) };
  return { kind: 'exceeds', txIds: pool.map((t) => t.id) };
}
