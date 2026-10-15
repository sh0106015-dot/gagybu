import { describe, it, expect } from 'vitest';
import { ingestNotification, ingestSafely, drainPending } from '../../src/core/pipeline/ingest';
import { setup, input, SMS_OK, KAKAO_OK, SMS_CANCEL, KAKAO_CANCEL, smsAmount, T } from './fixtures';
import { UNCATEGORIZED_ID } from '../../src/core/model';

describe('ingestNotification — approvals', () => {
  it('auto-saves a clear supported approval', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', SMS_OK), deps);
    expect(r.outcome).toBe('saved');
    const [t] = await repo.listTransactions();
    expect(t).toMatchObject({
      type: 'expense', amount: 12000, merchant: '스타벅스', paymentMethodId: 'pm-gana', categoryId: 'cat-cafe',
      date: '2026-10-15', time: '12:30', recordMethod: 'auto', dateFromReceipt: false, userEdited: false,
    });
    expect((await repo.getAutoSettings()).lastProcessedAt).toBe(T(15, 13, 0));
  });

  it('sms + kakao for the same payment become one transaction with two sources', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const b = await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    expect(b).toMatchObject({ outcome: 'merged', txId: a.txId });
    expect(await repo.listTransactions()).toHaveLength(1);
    expect((await repo.listRecords()).filter((x) => x.linkedTxId === a.txId)).toHaveLength(2);
  });

  it('re-delivery or update of the same notification key is processed once', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK, T(15, 12, 31), 'same'), deps);
    const again = await ingestNotification(input('sms', SMS_OK + ' ', T(15, 12, 35), 'same'), deps);
    expect(again.outcome).toBe('already_processed');
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  it('two real payments of the same amount from the same app are both saved', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('sms', SMS_OK), deps);
    expect(await repo.listTransactions()).toHaveLength(2);
  });

  it('ambiguous cross-app match goes to inbox as duplicate suspect', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('kakaotalk', KAKAO_OK.replace('가맹점: 스타벅스\n', '')), deps);
    expect(r.outcome).toBe('candidate');
    const c = await repo.getCandidate(r.candidateId!);
    expect(c).toMatchObject({ reasons: ['duplicate_suspect'], duplicateOfTxId: a.txId, status: 'pending', encryptedExcerpt: expect.stringMatching(/^enc/) });
    expect(c!.expiresAt - c!.createdAt).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('non-transaction notifications are ignored but recorded', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', '[가나카드] 인증번호 [123456]'), deps);
    expect(r.outcome).toBe('ignored_non_tx');
    expect(await repo.listTransactions()).toHaveLength(0);
    expect(await repo.listCandidates()).toHaveLength(0);
  });

  it('drops sources not allowed, disabled feature, or missing permission without any record', async () => {
    const pay = '마바페이 결제 완료 12,000원 · 스타벅스 · 10월 15일 12:30';
    let s = await setup();
    expect((await ingestNotification(input('payapp', pay), s.deps)).outcome).toBe('dropped');
    s = await setup({ enabled: false });
    expect((await ingestNotification(input('sms', SMS_OK), s.deps)).outcome).toBe('dropped');
    s = await setup({ permission: 'revoked' });
    expect((await ingestNotification(input('sms', SMS_OK), s.deps)).outcome).toBe('dropped');
    expect(await s.repo.listRecords()).toHaveLength(0);
  });

  it('sender filter applies when set', async () => {
    const { deps } = await setup({ allowedSources: [{ app: 'sms', sender: '15881688' }] });
    expect((await ingestNotification({ ...input('sms', SMS_OK), sender: '0000' }, deps)).outcome).toBe('dropped');
    expect((await ingestNotification({ ...input('sms', SMS_OK), sender: '15881688' }, deps)).outcome).toBe('saved');
  });

  it('review_all mode sends clear approvals to inbox', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    const r = await ingestNotification(input('sms', SMS_OK), deps);
    expect(r.outcome).toBe('candidate');
    expect((await repo.getCandidate(r.candidateId!))!.reasons).toEqual(['review_mode']);
    expect(await repo.listTransactions()).toHaveLength(0);
  });

  it('installment, unknown card, unsupported format and delayed delivery go to inbox', async () => {
    const { repo, deps } = await setup();
    const inst = await ingestNotification(input('sms', SMS_OK.replace('일시불', '3개월')), deps);
    const unknownCard = await ingestNotification(input('sms', SMS_OK.replace('1234', '9999')), deps);
    const unsupported = await ingestNotification(input('sms', '라마카드 사용 23,000원 올리브영'), deps);
    const delayed = await ingestNotification(input('sms', SMS_OK, T(17, 12, 31)), deps);
    const reasons = async (id?: string) => (await repo.getCandidate(id!))!.reasons;
    expect(await reasons(inst.candidateId)).toEqual(['unsupported_format']);
    expect(await reasons(unknownCard.candidateId)).toEqual(['missing_field']);
    expect(await reasons(unsupported.candidateId)).toEqual(['unsupported_format', 'missing_field']);
    expect(await reasons(delayed.candidateId)).toEqual(['date_uncertain']);
    expect(await repo.listTransactions()).toHaveLength(0);
  });

  it('unknown merchant category saves as 미분류', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK.replace('스타벅스', '동네철물점')), deps);
    expect((await repo.listTransactions())[0].categoryId).toBe(UNCATEGORIZED_ID);
  });

  it('paste always goes to inbox even when clear, and bypasses allow-list', async () => {
    const { repo, deps } = await setup({ enabled: false });
    const r = await ingestNotification(input('paste', SMS_OK), deps, { paste: true });
    expect(r.outcome).toBe('candidate');
    expect((await repo.getCandidate(r.candidateId!))!.reasons).toEqual(['review_mode']);
    expect((await repo.getAutoSettings()).lastProcessedAt).toBeUndefined();
  });
});

describe('ingestNotification — cancels and refunds', () => {
  it('full cancel links to the original', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const c = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    expect(c.outcome).toBe('refund_linked');
    expect(await repo.listRefunds()).toEqual([expect.objectContaining({ originalTxId: a.txId, amount: 12000, date: '2026-10-15', time: '13:10' })]);
  });

  it('the same cancel via sms and kakao is applied once', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    const c1 = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const c2 = await ingestNotification(input('kakaotalk', KAKAO_CANCEL, T(15, 13, 11)), deps);
    expect(c2).toMatchObject({ outcome: 'merged', refundId: c1.refundId });
    expect(await repo.listRefunds()).toHaveLength(1);
  });

  it('partial refunds accumulate; exceeding goes to inbox', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', smsAmount('30,000')), deps);
    expect((await ingestNotification(input('sms', smsAmount('10,000', '취소', '14:00'), T(15, 14, 1)), deps)).outcome).toBe('refund_linked');
    const over = await ingestNotification(input('sms', smsAmount('25,000', '취소', '15:00'), T(15, 15, 1)), deps);
    expect(over.outcome).toBe('candidate');
    expect(await repo.getCandidate(over.candidateId!)).toMatchObject({ reasons: ['refund_exceeds'], refundCandidateTxIds: [a.txId] });
    expect(await repo.listRefunds()).toHaveLength(1);
  });

  it('cancel without original goes to inbox', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    expect((await repo.getCandidate(r.candidateId!))!.reasons).toEqual(['refund_unmatched']);
  });

  it('cancel with several possible originals goes to inbox', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const c = await repo.getCandidate(r.candidateId!);
    expect(c!.reasons).toEqual(['refund_ambiguous']);
    expect(c!.refundCandidateTxIds).toHaveLength(2);
  });
});

describe('failure handling', () => {
  it('queues the input when storage fails and drains later', async () => {
    const { repo, deps } = await setup();
    const realCommit = repo.commit;
    repo.commit = async () => { throw new Error('disk full'); };
    expect(await ingestSafely(input('sms', SMS_OK), deps)).toEqual({ outcome: 'queued' });
    repo.commit = realCommit;
    expect(await repo.listPending()).toHaveLength(1);
    expect(await drainPending(deps)).toBe(1);
    expect(await repo.listPending()).toHaveLength(0);
    expect(await repo.listTransactions()).toHaveLength(1);
  });
});
