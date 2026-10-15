import { describe, it, expect } from 'vitest';
import { toCsv } from '../../src/core/csv';
import type { Transaction } from '../../src/core/model';

describe('toCsv', () => {
  it('writes BOM, header, escaped rows sorted by date', () => {
    const t = (over: Partial<Transaction>): Transaction => ({
      id: 'x', type: 'expense', amount: 12000, date: '2026-10-15', time: '12:30', merchant: '스타벅스, 강남',
      categoryId: 'c', paymentMethodId: 'p', memo: '그 "맛"', recordMethod: 'auto', dateFromReceipt: false,
      userEdited: false, createdAt: 1, updatedAt: 1, ...over,
    });
    const csv = toCsv(
      [t({ id: 'b', date: '2026-10-16' }), t({ id: 'a' })],
      [{ id: 'r', originalTxId: 'a', amount: 2000, date: '2026-10-17', createdAt: 1 }],
      [{ id: 'c', name: '카페', kind: 'expense', sortOrder: 0, archived: false }],
      [{ id: 'p', name: '가나카드', kind: 'card', matchKeys: [], sortOrder: 0, archived: false }],
    );
    const lines = csv.split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('﻿날짜,시각,유형,금액,가맹점,카테고리,결제수단,도착 수단,메모,기록 방식,환불액');
    expect(lines[1]).toBe('2026-10-15,12:30,지출,12000,"스타벅스, 강남",카페,가나카드,,"그 ""맛""",자동 기록,2000');
    expect(lines[2].startsWith('2026-10-16')).toBe(true);
  });
});
