import { describe, it, expect } from 'vitest';
import { matchRefund, refundableAmount } from '../../src/core/refund';
import type { Refund, Transaction } from '../../src/core/model';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1', type: 'expense', amount: 30000, date: '2026-10-15', time: '12:30', merchant: '스타벅스',
  categoryId: 'c', paymentMethodId: 'p1', recordMethod: 'auto', dateFromReceipt: false, userEdited: false,
  createdAt: 1, updatedAt: 1, ...over,
});
const refund = (amount: number, id = 'f'): Refund => ({ id, originalTxId: 't1', amount, date: '2026-10-16', createdAt: 1 });
const probe = { paymentMethodId: 'p1', merchant: '스타벅스', amount: 10000, at: new Date(2026, 9, 16, 9, 0).getTime() };

describe('refund', () => {
  it('refundableAmount subtracts linked refunds', () => {
    expect(refundableAmount(tx(), [refund(10000), refund(5000, 'g')])).toBe(15000);
  });
  it('one when a single original fits', () => {
    expect(matchRefund(probe, [tx()], [])).toEqual({ kind: 'one', txId: 't1' });
  });
  it('partial refunds accumulate then exceed', () => {
    expect(matchRefund({ ...probe, amount: 20000 }, [tx()], [refund(10000)])).toEqual({ kind: 'one', txId: 't1' });
    expect(matchRefund({ ...probe, amount: 25000 }, [tx()], [refund(10000)])).toEqual({ kind: 'exceeds', txIds: ['t1'] });
  });
  it('none when nothing matches method, merchant or window', () => {
    expect(matchRefund({ ...probe, paymentMethodId: 'p2' }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, merchant: '이디야' }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, merchant: undefined }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, at: new Date(2027, 0, 20).getTime() }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, at: new Date(2026, 9, 14).getTime() }, [tx()], []).kind).toBe('none');
  });
  it('many when several originals fit', () => {
    expect(matchRefund(probe, [tx(), tx({ id: 't2', time: '15:00' })], [])).toEqual({ kind: 'many', txIds: ['t1', 't2'] });
  });
  it('ignores income and transfer', () => {
    expect(matchRefund(probe, [tx({ type: 'income' })], []).kind).toBe('none');
  });
});
