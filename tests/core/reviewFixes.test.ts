import { describe, it, expect } from 'vitest';
import { ingestNotification, ingestSafely } from '../../src/core/pipeline/ingest';
import {
  confirmCandidate, candidateToInput, findCandidateDuplicate, linkCandidateRefund, mergeCandidate,
  saveManualTransaction, updateTransaction, type TxInput,
} from '../../src/core/actions';
import { toCsv } from '../../src/core/csv';
import { setup, input, SMS_OK, KAKAO_OK, SMS_CANCEL, T } from './fixtures';

describe('review fixes', () => {
  it('paste matching an existing transaction goes to inbox as duplicate suspect, never silently merged', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('paste', KAKAO_OK), deps, { paste: true });
    expect(r.outcome).toBe('candidate');
    expect(await repo.getCandidate(r.candidateId!)).toMatchObject({ reasons: ['duplicate_suspect'], duplicateOfTxId: a.txId });
  });

  it('a second app reporting a payment still pending in the inbox is flagged, and can merge after the first is confirmed', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    const first = await ingestNotification(input('sms', SMS_OK), deps);
    const second = await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    expect((await repo.getCandidate(second.candidateId!))!.reasons).toContain('duplicate_suspect');

    const c1 = (await repo.getCandidate(first.candidateId!))!;
    const tx = await confirmCandidate(c1.id, candidateToInput(c1) as TxInput, deps);
    const c2 = (await repo.getCandidate(second.candidateId!))!;
    expect(await findCandidateDuplicate(c2, deps)).toBe(tx.id);
    await mergeCandidate(c2.id, deps);
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  it('concurrent deliveries of the same notification are processed once', async () => {
    const { repo, deps } = await setup();
    await Promise.all([
      ingestSafely(input('sms', SMS_OK, T(15, 12, 31), 'race'), deps),
      ingestSafely(input('sms', SMS_OK, T(15, 12, 31), 'race'), deps),
      ingestSafely(input('kakaotalk', KAKAO_OK, T(15, 12, 32), 'race2'), deps),
    ]);
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  it('editing a refunded transaction cannot drop below the refunded amount or leave expense', async () => {
    const { deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const base: TxInput = { type: 'expense', amount: 12000, date: '2026-10-15', time: '12:30', merchant: '스타벅스', categoryId: 'cat-cafe', paymentMethodId: 'pm-gana' };
    await expect(updateTransaction(a.txId!, { ...base, amount: 5000 }, deps)).rejects.toThrow('환불');
    await expect(updateTransaction(a.txId!, { ...base, type: 'income' }, deps)).rejects.toThrow('환불');
    await expect(updateTransaction(a.txId!, { ...base, memo: '메모' }, deps)).resolves.toMatchObject({ memo: '메모' });
  });

  it('refund link rejects an invalid date', async () => {
    const { deps } = await setup({ saveMode: 'review_all' });
    const t = await saveManualTransaction({ type: 'expense', amount: 12000, date: '2026-10-15', time: '12:30', merchant: '스타벅스', categoryId: 'cat-cafe', paymentMethodId: 'pm-gana' }, deps);
    const c = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    await expect(linkCandidateRefund(c.candidateId!, t.id, 12000, '', deps)).rejects.toThrow('날짜');
  });

  it('CSV neutralizes spreadsheet formulas', () => {
    const csv = toCsv(
      [{ id: 'a', type: 'expense', amount: 1, date: '2026-10-15', merchant: '=HYPERLINK("x")', memo: '+1', categoryId: 'c', paymentMethodId: 'p', recordMethod: 'auto', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1 }],
      [], [], [],
    );
    const row = csv.split('\r\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain(`'+1`);
  });
});

describe('fixed expense flag', () => {
  it('is stored for expenses and dropped for other types', async () => {
    const { deps } = await setup();
    const base: TxInput = { type: 'expense', amount: 550000, date: '2026-10-25', categoryId: 'cat-food', paymentMethodId: 'pm-cash', fixed: true };
    expect((await saveManualTransaction(base, deps)).fixed).toBe(true);
    const income = await saveManualTransaction({ ...base, type: 'income' }, deps);
    expect(income.fixed).toBeUndefined();
    const t = await saveManualTransaction({ ...base, fixed: false }, deps);
    expect((await updateTransaction(t.id, { ...base, fixed: true }, deps)).fixed).toBe(true);
  });
});
