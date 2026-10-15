import { describe, it, expect } from 'vitest';
import { filterTransactions, EMPTY_FILTER } from '../../src/ui/filter';
import type { Transaction } from '../../src/core/model';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', type: 'expense', amount: 1000, date: '2026-10-15', categoryId: 'c1', paymentMethodId: 'p1',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});
const txs = [
  tx({ id: 'a', merchant: '스타벅스 강남' }),
  tx({ id: 'b', memo: '팀 점심', categoryId: 'c2', recordMethod: 'auto' }),
  tx({ id: 'c', type: 'income', paymentMethodId: 'p2' }),
  tx({ id: 'd', date: '2026-09-30', merchant: '스타벅스' }),
];
const ids = (r: Transaction[]) => r.map((t) => t.id);

describe('filterTransactions', () => {
  it('limits to month', () => {
    expect(ids(filterTransactions(txs, '2026-10', EMPTY_FILTER))).toEqual(['a', 'b', 'c']);
  });
  it('searches merchant and memo ignoring spaces and case', () => {
    expect(ids(filterTransactions(txs, '2026-10', { ...EMPTY_FILTER, query: '스타 벅스' }))).toEqual(['a']);
    expect(ids(filterTransactions(txs, '2026-10', { ...EMPTY_FILTER, query: '점심' }))).toEqual(['b']);
  });
  it('filters by type, category, method, record method', () => {
    expect(ids(filterTransactions(txs, '2026-10', { ...EMPTY_FILTER, type: 'income' }))).toEqual(['c']);
    expect(ids(filterTransactions(txs, '2026-10', { ...EMPTY_FILTER, categoryId: 'c2' }))).toEqual(['b']);
    expect(ids(filterTransactions(txs, '2026-10', { ...EMPTY_FILTER, paymentMethodId: 'p2' }))).toEqual(['c']);
    expect(ids(filterTransactions(txs, '2026-10', { ...EMPTY_FILTER, recordMethod: 'auto' }))).toEqual(['b']);
  });
});
