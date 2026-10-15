import type { Category, PaymentMethod, Refund, Transaction } from './model';
import { RECORD_METHOD_LABEL, SAVING_TERM_LABEL, TX_TYPE_LABEL } from './model';

const HEADER = ['날짜', '시각', '유형', '금액', '가맹점', '카테고리', '결제수단', '도착 수단', '메모', '기록 방식', '환불액'];

function cell(v: string | number | undefined): string {
  let s = v === undefined ? '' : String(v);
  // 알림에서 온 문자열이 엑셀에서 수식으로 실행되지 않게 한다.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(txs: Transaction[], refunds: Refund[], categories: Category[], methods: PaymentMethod[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const pm = new Map(methods.map((p) => [p.id, p.name]));
  const refunded = new Map<string, number>();
  for (const r of refunds) refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount);

  const rows = [...txs]
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .map((t) =>
      [
        t.date, t.time, t.savingTerm ? `${TX_TYPE_LABEL[t.type]}(${SAVING_TERM_LABEL[t.savingTerm]})` : TX_TYPE_LABEL[t.type], t.amount, t.merchant, cat.get(t.categoryId),
        pm.get(t.paymentMethodId), t.toPaymentMethodId ? pm.get(t.toPaymentMethodId) : undefined,
        t.memo, RECORD_METHOD_LABEL[t.recordMethod], refunded.get(t.id),
      ].map(cell).join(','),
    );
  return '﻿' + [HEADER.join(','), ...rows].join('\r\n');
}
