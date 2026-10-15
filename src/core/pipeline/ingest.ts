import type { Deps } from '../deps';
import { findDuplicateCandidate, findDuplicateRefund, findDuplicateTx } from '../dedup';
import { guessCategory } from '../merchant';
import type {
  AllowedSource, Candidate, CandidateFields, CandidateReason, NotificationInput,
  NotificationRecord, RecordOutcome, Refund, Transaction,
} from '../model';
import { CANDIDATE_TTL_MS } from '../model';
import { parseNotification } from '../parser';
import { matchRefund } from '../refund';
import { mapPaymentMethod, resolveTxDateTime } from '../resolve';

export type IngestOutcome = RecordOutcome | 'dropped' | 'already_processed';

export interface IngestResult {
  outcome: IngestOutcome;
  recordId?: string;
  txId?: string;
  candidateId?: string;
  refundId?: string;
}

const EXCERPT_MAX = 200;

function isAllowed(allowed: AllowedSource[], input: NotificationInput): boolean {
  return allowed.some((s) => s.app === input.sourceApp && (!s.sender || s.sender === input.sender));
}

export async function ingestNotification(
  input: NotificationInput,
  deps: Deps,
  opts: { paste?: boolean } = {},
): Promise<IngestResult> {
  const { repo, now, newId } = deps;
  const paste = opts.paste === true;
  const settings = await repo.getAutoSettings();

  if (!paste) {
    if (!settings.enabled || settings.permission !== 'granted' || !isAllowed(settings.allowedSources, input)) {
      return { outcome: 'dropped' };
    }
    const existing = await repo.findRecord(input.sourceApp, input.notificationKey);
    if (existing) {
      return {
        outcome: 'already_processed', recordId: existing.id, txId: existing.linkedTxId,
        candidateId: existing.linkedCandidateId, refundId: existing.linkedRefundId,
      };
    }
  }
  const touchedSettings = paste ? undefined : { ...settings, lastProcessedAt: now() };

  const parsed = parseNotification(input.text, input.sourceApp);
  const record: NotificationRecord = {
    id: newId(),
    sourceApp: input.sourceApp,
    notificationKey: input.notificationKey,
    receivedAt: input.receivedAt,
    ruleId: parsed.status === 'non_tx' ? 'non_tx' : parsed.ruleId,
    ruleVersion: parsed.status === 'non_tx' ? 0 : parsed.ruleVersion,
    outcome: 'ignored_non_tx',
  };
  if (parsed.status === 'non_tx') {
    await repo.commit({ records: [record], autoSettings: touchedSettings });
    return { outcome: 'ignored_non_tx', recordId: record.id };
  }

  const p = parsed.tx;
  const [methods, categories, txs, refunds, records, candidates] = await Promise.all([
    repo.listPaymentMethods(), repo.listCategories(), repo.listTransactions(), repo.listRefunds(), repo.listRecords(),
    repo.listCandidates(),
  ]);
  const pm = mapPaymentMethod(methods, p.cardName, p.cardLast4);
  const dt = resolveTxDateTime(p, input.receivedAt);

  const reasons = new Set<CandidateReason>();
  if (parsed.status === 'unsupported' || p.installment || p.foreign) reasons.add('unsupported_format');
  if (p.amount === undefined || !pm) reasons.add('missing_field');
  if (dt.uncertain) reasons.add('date_uncertain');

  const fields: CandidateFields = {
    kind: p.kind,
    amount: p.amount,
    merchant: p.merchant,
    cardName: p.cardName,
    cardLast4: p.cardLast4,
    paymentMethodId: pm?.id,
    categoryId: p.kind === 'approval' ? guessCategory(p.merchant, categories) : undefined,
    date: dt.date,
    time: dt.time,
    dateFromReceipt: dt.fromReceipt,
    approvalNo: p.approvalNo,
    installment: p.installment,
    foreign: p.foreign,
  };
  const canAutoSave = () => reasons.size === 0 && settings.saveMode === 'auto' && !paste;
  const probe = {
    sourceApp: input.sourceApp, paymentMethodId: pm?.id, amount: p.amount,
    merchant: p.merchant, at: dt.at, approvalNo: p.approvalNo,
  };
  let duplicateOfTxId: string | undefined;
  let refundCandidateTxIds: string[] | undefined;

  // 확인함에 아직 남아 있는 다른 앱의 같은 결제도 중복 후보로 표시한다.
  if (findDuplicateCandidate(probe, p.kind, candidates)) reasons.add('duplicate_suspect');

  if (p.kind === 'approval') {
    const dup = findDuplicateTx(probe, txs, records);
    // 붙여넣기는 항상 확인함으로 보내므로 확실한 중복도 자동으로 합치지 않는다.
    if (dup.kind === 'certain' && !paste) {
      record.outcome = 'merged';
      record.linkedTxId = dup.id;
      await repo.commit({ records: [record], autoSettings: touchedSettings });
      return { outcome: 'merged', recordId: record.id, txId: dup.id };
    }
    if (dup.kind !== 'none') {
      reasons.add('duplicate_suspect');
      duplicateOfTxId = dup.id;
    }
    if (canAutoSave()) {
      const t = now();
      const tx: Transaction = {
        id: newId(), type: 'expense', amount: p.amount!, date: dt.date, time: dt.time, merchant: p.merchant,
        categoryId: fields.categoryId!, paymentMethodId: pm!.id, recordMethod: 'auto',
        dateFromReceipt: dt.fromReceipt, userEdited: false, approvalNo: p.approvalNo, createdAt: t, updatedAt: t,
      };
      record.outcome = 'saved';
      record.linkedTxId = tx.id;
      await repo.commit({ transactions: [tx], records: [record], autoSettings: touchedSettings });
      return { outcome: 'saved', recordId: record.id, txId: tx.id };
    }
  } else if (pm && p.amount !== undefined) {
    const amount = p.amount;
    const dupRefundId = findDuplicateRefund(probe, refunds, txs, records);
    if (dupRefundId && paste) reasons.add('duplicate_suspect');
    if (dupRefundId && !paste) {
      record.outcome = 'merged';
      record.linkedRefundId = dupRefundId;
      await repo.commit({ records: [record], autoSettings: touchedSettings });
      return { outcome: 'merged', recordId: record.id, refundId: dupRefundId };
    }
    const m = matchRefund({ paymentMethodId: pm.id, merchant: p.merchant, amount, at: dt.at }, txs, refunds);
    if (m.kind === 'one') {
      refundCandidateTxIds = [m.txId];
      if (canAutoSave()) {
        const refund: Refund = { id: newId(), originalTxId: m.txId, amount, date: dt.date, time: dt.time, createdAt: now() };
        record.outcome = 'refund_linked';
        record.linkedRefundId = refund.id;
        await repo.commit({ refunds: [refund], records: [record], autoSettings: touchedSettings });
        return { outcome: 'refund_linked', recordId: record.id, refundId: refund.id };
      }
    } else if (m.kind === 'none') {
      reasons.add('refund_unmatched');
    } else {
      reasons.add(m.kind === 'many' ? 'refund_ambiguous' : 'refund_exceeds');
      refundCandidateTxIds = m.txIds;
    }
  }

  if (reasons.size === 0) reasons.add('review_mode');
  const createdAt = now();
  const candidate: Candidate = {
    id: newId(),
    fields,
    reasons: [...reasons],
    duplicateOfTxId,
    refundCandidateTxIds,
    encryptedExcerpt: await deps.encrypt(input.text.trim().slice(0, EXCERPT_MAX)),
    status: 'pending',
    sourceRecordId: record.id,
    sourceApp: input.sourceApp,
    createdAt,
    expiresAt: createdAt + CANDIDATE_TTL_MS,
  };
  record.outcome = 'candidate';
  record.linkedCandidateId = candidate.id;
  await repo.commit({ candidates: [candidate], records: [record], autoSettings: touchedSettings });
  return { outcome: 'candidate', recordId: record.id, candidateId: candidate.id };
}

export async function ingestSafely(
  input: NotificationInput,
  deps: Deps,
  opts: { paste?: boolean } = {},
): Promise<IngestResult | { outcome: 'queued' }> {
  return serial(async () => {
    try {
      return await ingestNotification(input, deps, opts);
    } catch (e) {
      // 금융 정보 없이 오류 종류만 남긴다.
      console.warn('ingest_failed', e instanceof Error ? e.name : 'unknown');
      await deps.repo.enqueuePending({ id: deps.newId(), input, paste: opts.paste === true, createdAt: deps.now() });
      return { outcome: 'queued' as const };
    }
  });
}

export async function drainPending(deps: Deps): Promise<number> {
  return serial(async () => {
    let done = 0;
    for (const item of await deps.repo.listPending()) {
      try {
        await ingestNotification(item.input, deps, { paste: item.paste });
        await deps.repo.removePending(item.id);
        done++;
      } catch (e) {
        console.warn('drain_failed', e instanceof Error ? e.name : 'unknown');
      }
    }
    return done;
  });
}

// 알림 처리는 "읽고 판단한 뒤 쓰기"라서 동시에 실행되면 중복 저장이 생길 수 있다. 한 번에 하나씩 처리한다.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}
