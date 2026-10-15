import { txAt } from './dates';
import { normalizeMerchant } from './merchant';
import type { Candidate, NotificationRecord, Refund, SourceApp, Transaction } from './model';
import { DUP_WINDOW_MS } from './model';

export interface DupProbe {
  sourceApp: SourceApp;
  paymentMethodId?: string;
  amount?: number;
  merchant?: string;
  at: number;
  approvalNo?: string;
}

export type DupResult = { kind: 'none' } | { kind: 'certain' | 'suspect'; id: string };

function sourcesBy(records: NotificationRecord[], key: 'linkedTxId' | 'linkedRefundId') {
  const map = new Map<string, Set<SourceApp>>();
  for (const r of records) {
    const id = r[key];
    if (!id) continue;
    if (!map.has(id)) map.set(id, new Set());
    map.get(id)!.add(r.sourceApp);
  }
  return map;
}

export function findDuplicateTx(probe: DupProbe, txs: Transaction[], records: NotificationRecord[]): DupResult {
  if (probe.amount === undefined) return { kind: 'none' };
  const sources = sourcesBy(records, 'linkedTxId');
  const pMerchant = normalizeMerchant(probe.merchant);
  let suspect: string | undefined;

  for (const t of txs) {
    const apps = sources.get(t.id);
    if (!apps || apps.has(probe.sourceApp)) continue;
    if (t.type !== 'expense' || t.amount !== probe.amount) continue;
    if (Math.abs(txAt(t.date, t.time) - probe.at) > DUP_WINDOW_MS) continue;
    if (probe.approvalNo && t.approvalNo && probe.approvalNo !== t.approvalNo) continue;

    const tMerchant = normalizeMerchant(t.merchant);
    const sameMethod = probe.paymentMethodId !== undefined && probe.paymentMethodId === t.paymentMethodId;
    const sameMerchant = pMerchant !== undefined && pMerchant === tMerchant;
    if (sameMethod && sameMerchant) return { kind: 'certain', id: t.id };
    suspect ??= t.id;
  }
  return suspect ? { kind: 'suspect', id: suspect } : { kind: 'none' };
}

/** 다른 앱에서 먼저 들어와 아직 확인함에 있는 같은 거래 후보의 id. */
export function findDuplicateCandidate(
  probe: DupProbe, kind: 'approval' | 'cancel', candidates: Candidate[],
): string | undefined {
  if (probe.amount === undefined) return undefined;
  return candidates.find((c) => {
    const f = c.fields;
    return (
      c.status === 'pending' &&
      c.sourceApp !== probe.sourceApp &&
      f.kind === kind &&
      f.amount === probe.amount &&
      !(probe.approvalNo && f.approvalNo && probe.approvalNo !== f.approvalNo) &&
      Math.abs(txAt(f.date, f.time) - probe.at) <= DUP_WINDOW_MS
    );
  })?.id;
}

export function findDuplicateRefund(
  probe: DupProbe, refunds: Refund[], txs: Transaction[], records: NotificationRecord[],
): string | undefined {
  if (probe.amount === undefined || probe.paymentMethodId === undefined) return undefined;
  const sources = sourcesBy(records, 'linkedRefundId');
  const pMerchant = normalizeMerchant(probe.merchant);
  const txById = new Map(txs.map((t) => [t.id, t]));

  return refunds.find((f) => {
    const apps = sources.get(f.id);
    if (!apps || apps.has(probe.sourceApp)) return false;
    const orig = txById.get(f.originalTxId);
    return (
      orig !== undefined &&
      f.amount === probe.amount &&
      orig.paymentMethodId === probe.paymentMethodId &&
      normalizeMerchant(orig.merchant) === pMerchant &&
      Math.abs(txAt(f.date, f.time) - probe.at) <= DUP_WINDOW_MS
    );
  })?.id;
}
