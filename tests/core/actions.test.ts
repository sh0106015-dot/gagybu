import { describe, it, expect } from 'vitest';
import {
  validateTxInput, saveManualTransaction, updateTransaction, deleteTransaction, restoreTransaction,
  confirmCandidate, mergeCandidate, linkCandidateRefund, ignoreCandidate, purgeExpiredCandidates, candidateToInput,
  type TxInput,
} from '../../src/core/actions';
import { ingestNotification } from '../../src/core/pipeline/ingest';
import { setup, input, SMS_OK, KAKAO_OK, SMS_CANCEL, T } from './fixtures';

const base: TxInput = { type: 'expense', amount: 5000, date: '2026-10-15', time: '09:00', categoryId: 'cat-food', paymentMethodId: 'pm-cash' };

describe('manual transactions', () => {
  it('validates input', () => {
    expect(validateTxInput(base)).toBeNull();
    expect(validateTxInput({ ...base, amount: 0 })).toBe('금액을 1원 이상 입력하세요');
    expect(validateTxInput({ ...base, amount: 1.5 })).toBe('금액을 1원 이상 입력하세요');
    expect(validateTxInput({ ...base, date: '2026-13-01' })).toBe('날짜를 확인하세요');
    expect(validateTxInput({ ...base, categoryId: '' })).toBe('카테고리를 선택하세요');
    expect(validateTxInput({ ...base, paymentMethodId: '' })).toBe('결제수단을 선택하세요');
    expect(validateTxInput({ ...base, type: 'transfer', categoryId: '' })).toBe('저축 기간을 선택하세요');
    expect(validateTxInput({ ...base, type: 'transfer', categoryId: '', savingTerm: 'short', toPaymentMethodId: 'pm-cash' })).toBe('출금 수단과 저축 계좌를 다르게 선택하세요');
    expect(validateTxInput({ ...base, type: 'transfer', categoryId: '', savingTerm: 'long' })).toBeNull();
    expect(validateTxInput({ ...base, type: 'transfer', categoryId: '', savingTerm: 'mid', toPaymentMethodId: 'pm-gana' })).toBeNull();
  });
  it('saves manual and rejects invalid', async () => {
    const { repo, deps } = await setup();
    const t = await saveManualTransaction({ ...base, memo: '  점심  ' }, deps);
    expect(t).toMatchObject({ recordMethod: 'manual', userEdited: false, memo: '점심' });
    await expect(saveManualTransaction({ ...base, amount: -1 }, deps)).rejects.toThrow('금액');
    expect(await repo.listTransactions()).toHaveLength(1);
  });
  it('editing an auto transaction marks userEdited and later notifications do not overwrite', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const edited = await updateTransaction(a.txId!, { ...base, amount: 12000, merchant: '스타벅스', paymentMethodId: 'pm-gana', date: '2026-10-15', time: '12:30', categoryId: 'cat-food', memo: '회의' }, deps);
    expect(edited.userEdited).toBe(true);
    const b = await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    expect(b.outcome).toBe('merged');
    expect(await repo.getTransaction(a.txId!)).toMatchObject({ categoryId: 'cat-food', memo: '회의' });
  });
  it('editing a manual transaction keeps userEdited false', async () => {
    const { deps } = await setup();
    const t = await saveManualTransaction(base, deps);
    expect((await updateTransaction(t.id, { ...base, amount: 7000 }, deps)).userEdited).toBe(false);
  });
});

describe('delete and undo', () => {
  it('deleting an auto transaction removes its refunds and the same notification does not recreate it', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK, T(15, 12, 31), 'n1'), deps);
    await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const snap = await deleteTransaction(a.txId!, deps);
    expect(await repo.listTransactions()).toHaveLength(0);
    expect(await repo.listRefunds()).toHaveLength(0);
    const again = await ingestNotification(input('sms', SMS_OK, T(15, 12, 40), 'n1'), deps);
    expect(again.outcome).toBe('already_processed');
    expect(await repo.listTransactions()).toHaveLength(0);

    await restoreTransaction(snap, deps);
    expect(await repo.listTransactions()).toHaveLength(1);
    expect(await repo.listRefunds()).toHaveLength(1);
    expect((await repo.listRecords()).filter((r) => r.linkedTxId === a.txId)).toHaveLength(1);
  });
});

describe('inbox actions', () => {
  it('confirming a candidate saves it, removes the excerpt and learns the card mapping', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', SMS_OK.replace('1234', '9999')), deps);
    const c = (await repo.getCandidate(r.candidateId!))!;
    const init = candidateToInput(c);
    expect(init).toMatchObject({ type: 'expense', amount: 12000, merchant: '스타벅스', date: '2026-10-15', time: '12:30', categoryId: 'cat-cafe' });
    const t = await confirmCandidate(c.id, { ...base, ...init, paymentMethodId: 'pm-gana' } as TxInput, deps);
    expect(t.recordMethod).toBe('confirmed');
    expect(await repo.getCandidate(c.id)).toMatchObject({ status: 'confirmed', encryptedExcerpt: undefined });
    expect((await repo.getRecord(c.sourceRecordId))!.linkedTxId).toBe(t.id);
    expect((await repo.listPaymentMethods()).find((p) => p.id === 'pm-gana')!.matchKeys).toContain('가나카드*9999');
    const next = await ingestNotification(input('sms', SMS_OK.replace('1234', '9999').replace('12:30', '18:00'), T(15, 18, 1)), deps);
    expect(next.outcome).toBe('saved');
  });

  it('ignored candidates do not come back on re-delivery', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    const r = await ingestNotification(input('sms', SMS_OK, T(15, 12, 31), 'x1'), deps);
    await ignoreCandidate(r.candidateId!, deps);
    expect(await repo.getCandidate(r.candidateId!)).toMatchObject({ status: 'ignored', encryptedExcerpt: undefined });
    expect((await ingestNotification(input('sms', SMS_OK, T(15, 12, 33), 'x1'), deps)).outcome).toBe('already_processed');
    expect((await repo.listCandidates()).filter((c) => c.status === 'pending')).toHaveLength(0);
  });

  it('merging a duplicate suspect attaches the source to the existing transaction', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('kakaotalk', KAKAO_OK.replace('가맹점: 스타벅스\n', '')), deps);
    await mergeCandidate(r.candidateId!, deps);
    expect(await repo.listTransactions()).toHaveLength(1);
    expect((await repo.getRecord(r.recordId!))).toMatchObject({ outcome: 'merged', linkedTxId: a.txId });
  });

  it('linking a refund candidate respects refundable amount', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const b = await ingestNotification(input('sms', SMS_OK), deps);
    const c = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    await expect(linkCandidateRefund(c.candidateId!, a.txId!, 13000, '2026-10-15', deps)).rejects.toThrow('환불액');
    const refund = await linkCandidateRefund(c.candidateId!, b.txId!, 12000, '2026-10-15', deps);
    expect(refund.originalTxId).toBe(b.txId);
    expect((await repo.getRecord(c.recordId!))!.linkedRefundId).toBe(refund.id);
    expect((await repo.getCandidate(c.candidateId!))!.status).toBe('confirmed');
  });

  it('purges pending candidates older than 30 days', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    await ingestNotification(input('sms', SMS_OK), deps);
    expect(await purgeExpiredCandidates(deps)).toBe(0);
    const later = { ...deps, now: () => T(15, 13, 0) + 31 * 24 * 60 * 60 * 1000 };
    expect(await purgeExpiredCandidates(later)).toBe(1);
    expect(await repo.listCandidates()).toHaveLength(0);
  });
});

describe('receipt photos follow their transaction', () => {
  it('delete removes photos and undo restores them', async () => {
    const { repo, deps } = await setup();
    const t = await saveManualTransaction(base, deps);
    await repo.commit({ photos: [{ id: 'ph', txId: t.id, dataUrl: 'data:image/jpeg;base64,AA', createdAt: 1 }] });
    const snap = await deleteTransaction(t.id, deps);
    expect(await repo.listPhotos(t.id)).toEqual([]);
    await restoreTransaction(snap, deps);
    expect((await repo.listPhotos(t.id)).map((p) => p.id)).toEqual(['ph']);
  });
});

describe('savings (저축)', () => {
  it('stores the saving term only for savings', async () => {
    const { deps } = await setup();
    const sv = await saveManualTransaction({ ...base, type: 'transfer', categoryId: '', merchant: '청년도약계좌', savingTerm: 'long' }, deps);
    expect(sv).toMatchObject({ type: 'transfer', savingTerm: 'long', merchant: '청년도약계좌', categoryId: '' });
    const ex = await saveManualTransaction({ ...base, savingTerm: 'short' }, deps);
    expect(ex.savingTerm).toBeUndefined();
  });
});
