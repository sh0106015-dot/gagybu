import type { Deps } from './deps';
import type { Candidate, NotificationRecord, PaymentMethod, Refund, Transaction, TxType } from './model';
import { refundableAmount } from './refund';
import { matchKeyFor } from './resolve';

export interface TxInput {
  type: TxType;
  amount: number;
  date: string;
  time?: string;
  merchant?: string;
  categoryId: string;
  paymentMethodId: string;
  toPaymentMethodId?: string;
  memo?: string;
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);

export function validateTxInput(i: TxInput): string | null {
  if (!Number.isInteger(i.amount) || i.amount < 1) return '금액을 1원 이상 입력하세요';
  if (!DATE_RE.test(i.date)) return '날짜를 확인하세요';
  if (i.time && !TIME_RE.test(i.time)) return '시각을 확인하세요';
  if (!i.paymentMethodId) return '결제수단을 선택하세요';
  if (i.type === 'transfer') {
    if (!i.toPaymentMethodId || i.toPaymentMethodId === i.paymentMethodId) return '출발·도착 수단을 다르게 선택하세요';
  } else if (!i.categoryId) {
    return '카테고리를 선택하세요';
  }
  return null;
}

function assertValid(i: TxInput) {
  const err = validateTxInput(i);
  if (err) throw new Error(err);
}

function fieldsOf(i: TxInput) {
  return {
    type: i.type,
    amount: i.amount,
    date: i.date,
    time: i.time || undefined,
    merchant: clean(i.merchant),
    categoryId: i.type === 'transfer' ? '' : i.categoryId,
    paymentMethodId: i.paymentMethodId,
    toPaymentMethodId: i.type === 'transfer' ? i.toPaymentMethodId : undefined,
    memo: clean(i.memo),
  };
}

export async function saveManualTransaction(i: TxInput, deps: Deps): Promise<Transaction> {
  assertValid(i);
  const t = deps.now();
  const tx: Transaction = {
    id: deps.newId(), ...fieldsOf(i), recordMethod: 'manual', dateFromReceipt: false,
    userEdited: false, createdAt: t, updatedAt: t,
  };
  await deps.repo.commit({ transactions: [tx] });
  return tx;
}

export async function updateTransaction(id: string, i: TxInput, deps: Deps): Promise<Transaction> {
  assertValid(i);
  const prev = await deps.repo.getTransaction(id);
  if (!prev) throw new Error('거래를 찾을 수 없어요');
  const tx: Transaction = {
    ...prev,
    ...fieldsOf(i),
    dateFromReceipt: prev.dateFromReceipt && prev.date === i.date && prev.time === (i.time || undefined),
    userEdited: prev.recordMethod !== 'manual' || prev.userEdited,
    updatedAt: deps.now(),
  };
  await deps.repo.commit({ transactions: [tx] });
  return tx;
}

export interface DeletedSnapshot {
  tx: Transaction;
  refunds: Refund[];
  records: NotificationRecord[];
}

export async function deleteTransaction(id: string, deps: Deps): Promise<DeletedSnapshot> {
  const { repo } = deps;
  const tx = await repo.getTransaction(id);
  if (!tx) throw new Error('거래를 찾을 수 없어요');
  const refunds = (await repo.listRefunds()).filter((r) => r.originalTxId === id);
  const refundIds = new Set(refunds.map((r) => r.id));
  const records = (await repo.listRecords()).filter(
    (r) => r.linkedTxId === id || (r.linkedRefundId !== undefined && refundIds.has(r.linkedRefundId)),
  );
  // 처리 기록은 남겨 동일 알림이 거래를 다시 만들지 않게 하고, 연결만 끊는다.
  const unlinked = records.map((r) => ({
    ...r,
    linkedTxId: r.linkedTxId === id ? undefined : r.linkedTxId,
    linkedRefundId: r.linkedRefundId && refundIds.has(r.linkedRefundId) ? undefined : r.linkedRefundId,
  }));
  await repo.commit({ deleteTransactionIds: [id], deleteRefundIds: [...refundIds], records: unlinked });
  return { tx, refunds, records };
}

export async function restoreTransaction(s: DeletedSnapshot, deps: Deps): Promise<void> {
  await deps.repo.commit({ transactions: [s.tx], refunds: s.refunds, records: s.records });
}

export function candidateToInput(c: Candidate): Partial<TxInput> {
  const f = c.fields;
  return {
    type: 'expense',
    amount: f.amount,
    date: f.date,
    time: f.time,
    merchant: f.merchant,
    categoryId: f.categoryId,
    paymentMethodId: f.paymentMethodId,
  };
}

async function loadPending(id: string, deps: Deps) {
  const c = await deps.repo.getCandidate(id);
  if (!c || c.status !== 'pending') throw new Error('처리할 후보를 찾을 수 없어요');
  const record = await deps.repo.getRecord(c.sourceRecordId);
  return { c, record };
}

const closed = (c: Candidate, status: 'confirmed' | 'ignored'): Candidate => ({ ...c, status, encryptedExcerpt: undefined });

export async function confirmCandidate(id: string, i: TxInput, deps: Deps): Promise<Transaction> {
  assertValid(i);
  const { c, record } = await loadPending(id, deps);
  const t = deps.now();
  const tx: Transaction = {
    id: deps.newId(), ...fieldsOf(i), recordMethod: 'confirmed',
    dateFromReceipt: c.fields.dateFromReceipt && c.fields.date === i.date,
    userEdited: false, approvalNo: c.fields.approvalNo, createdAt: t, updatedAt: t,
  };
  const methods: PaymentMethod[] = [];
  if (c.fields.cardName && !c.fields.paymentMethodId) {
    const pm = (await deps.repo.listPaymentMethods()).find((p) => p.id === i.paymentMethodId);
    const key = matchKeyFor(c.fields.cardName, c.fields.cardLast4);
    if (pm && pm.kind !== 'cash' && !pm.matchKeys.includes(key)) methods.push({ ...pm, matchKeys: [...pm.matchKeys, key] });
  }
  await deps.repo.commit({
    transactions: [tx],
    candidates: [closed(c, 'confirmed')],
    records: record ? [{ ...record, outcome: 'saved', linkedTxId: tx.id }] : [],
    paymentMethods: methods,
  });
  return tx;
}

export async function mergeCandidate(id: string, deps: Deps): Promise<void> {
  const { c, record } = await loadPending(id, deps);
  if (!c.duplicateOfTxId) throw new Error('합칠 거래가 없어요');
  await deps.repo.commit({
    candidates: [closed(c, 'confirmed')],
    records: record ? [{ ...record, outcome: 'merged', linkedTxId: c.duplicateOfTxId }] : [],
  });
}

export async function linkCandidateRefund(
  id: string, originalTxId: string, amount: number, date: string, deps: Deps,
): Promise<Refund> {
  const { c, record } = await loadPending(id, deps);
  const orig = await deps.repo.getTransaction(originalTxId);
  if (!orig || orig.type !== 'expense') throw new Error('원거래를 찾을 수 없어요');
  if (!Number.isInteger(amount) || amount < 1) throw new Error('금액을 1원 이상 입력하세요');
  if (refundableAmount(orig, await deps.repo.listRefunds()) < amount) throw new Error('환불액이 남은 결제 금액보다 커요');
  const refund: Refund = { id: deps.newId(), originalTxId, amount, date, time: c.fields.date === date ? c.fields.time : undefined, createdAt: deps.now() };
  await deps.repo.commit({
    refunds: [refund],
    candidates: [closed(c, 'confirmed')],
    records: record ? [{ ...record, outcome: 'refund_linked', linkedRefundId: refund.id }] : [],
  });
  return refund;
}

export async function ignoreCandidate(id: string, deps: Deps): Promise<void> {
  const { c } = await loadPending(id, deps);
  await deps.repo.commit({ candidates: [closed(c, 'ignored')] });
}

export async function purgeExpiredCandidates(deps: Deps): Promise<number> {
  const now = deps.now();
  const expired = (await deps.repo.listCandidates()).filter((c) => c.status === 'pending' && c.expiresAt <= now);
  if (expired.length) await deps.repo.commit({ deleteCandidateIds: expired.map((c) => c.id) });
  return expired.length;
}
