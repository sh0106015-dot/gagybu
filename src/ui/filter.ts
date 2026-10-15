import { periodKey } from '../core/period';
import type { RecordMethod, Transaction, TxType } from '../core/model';

export interface TxFilter {
  query: string;
  type: '' | TxType;
  categoryId: string;
  paymentMethodId: string;
  recordMethod: '' | RecordMethod;
}

export const EMPTY_FILTER: TxFilter = { query: '', type: '', categoryId: '', paymentMethodId: '', recordMethod: '' };

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function filterTransactions(txs: Transaction[], month: string, f: TxFilter, startDay = 1): Transaction[] {
  const q = squash(f.query);
  return txs.filter(
    (t) =>
      periodKey(t.date, startDay) === month &&
      (!q || squash(`${t.merchant ?? ''} ${t.memo ?? ''}`).includes(q)) &&
      (!f.type || t.type === f.type) &&
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.paymentMethodId || t.paymentMethodId === f.paymentMethodId || t.toPaymentMethodId === f.paymentMethodId) &&
      (!f.recordMethod || t.recordMethod === f.recordMethod),
  );
}
