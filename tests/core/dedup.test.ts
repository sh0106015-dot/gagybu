import { describe, it, expect } from 'vitest';
import { findDuplicateTx, findDuplicateRefund } from '../../src/core/dedup';
import type { NotificationRecord, Refund, Transaction } from '../../src/core/model';

const at = (h: number, m: number) => new Date(2026, 9, 15, h, m).getTime();
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1', type: 'expense', amount: 12000, date: '2026-10-15', time: '12:30', merchant: '스타벅스',
  categoryId: 'c', paymentMethodId: 'p1', recordMethod: 'auto', dateFromReceipt: false, userEdited: false,
  createdAt: 1, updatedAt: 1, ...over,
});
const rec = (over: Partial<NotificationRecord>): NotificationRecord => ({
  id: 'r1', sourceApp: 'sms', notificationKey: 'k1', receivedAt: 1, ruleId: 'x', ruleVersion: 1, outcome: 'saved', ...over,
});
const probe = { sourceApp: 'kakaotalk' as const, paymentMethodId: 'p1', amount: 12000, merchant: '스타벅스', at: at(12, 30) };

describe('findDuplicateTx', () => {
  const records = [rec({ linkedTxId: 't1' })];
  it('certain when other app reports same payment', () => {
    expect(findDuplicateTx(probe, [tx()], records)).toEqual({ kind: 'certain', id: 't1' });
  });
  it('certain within 2 minutes and merchant spacing differences', () => {
    expect(findDuplicateTx({ ...probe, at: at(12, 32), merchant: '스타 벅스' }, [tx()], records).kind).toBe('certain');
  });
  it('none beyond 2 minutes', () => {
    expect(findDuplicateTx({ ...probe, at: at(12, 33) }, [tx()], records).kind).toBe('none');
  });
  it('same source app is never a duplicate (real repeated payment)', () => {
    expect(findDuplicateTx({ ...probe, sourceApp: 'sms' }, [tx()], records).kind).toBe('none');
  });
  it('different approval numbers are different payments', () => {
    expect(findDuplicateTx({ ...probe, approvalNo: '2' }, [tx({ approvalNo: '1' })], records).kind).toBe('none');
  });
  it('suspect when merchant or method unknown', () => {
    expect(findDuplicateTx({ ...probe, merchant: undefined }, [tx()], records)).toEqual({ kind: 'suspect', id: 't1' });
    expect(findDuplicateTx({ ...probe, paymentMethodId: undefined }, [tx()], records).kind).toBe('suspect');
  });
  it('ignores manual transactions and different amounts', () => {
    expect(findDuplicateTx(probe, [tx({ recordMethod: 'manual' })], []).kind).toBe('none');
    expect(findDuplicateTx({ ...probe, amount: 12001 }, [tx()], records).kind).toBe('none');
    expect(findDuplicateTx({ ...probe, amount: undefined }, [tx()], records).kind).toBe('none');
  });
  it('prefers certain over suspect', () => {
    const txs = [tx({ id: 'a', merchant: '다른곳' }), tx({ id: 'b' })];
    const recs = [rec({ id: 'r1', linkedTxId: 'a' }), rec({ id: 'r2', notificationKey: 'k2', linkedTxId: 'b' })];
    expect(findDuplicateTx(probe, txs, recs)).toEqual({ kind: 'certain', id: 'b' });
  });
});

describe('findDuplicateRefund', () => {
  const refund: Refund = { id: 'f1', originalTxId: 't1', amount: 12000, date: '2026-10-15', time: '13:10', createdAt: 1 };
  const records = [rec({ linkedTxId: 't1' }), rec({ id: 'r2', notificationKey: 'k2', outcome: 'refund_linked', linkedRefundId: 'f1' })];
  const p = { ...probe, at: at(13, 10) };
  it('finds refund reported by another app', () => {
    expect(findDuplicateRefund(p, [refund], [tx()], records)).toBe('f1');
  });
  it('same app or different amount is not a duplicate', () => {
    expect(findDuplicateRefund({ ...p, sourceApp: 'sms' }, [refund], [tx()], records)).toBeUndefined();
    expect(findDuplicateRefund({ ...p, amount: 5000 }, [refund], [tx()], records)).toBeUndefined();
  });
});
