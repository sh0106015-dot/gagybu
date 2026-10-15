import { describe, it, expect } from 'vitest';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { ensureSeeded, sampleCardMethods } from '../../src/data/seed';
import { UNCATEGORIZED_ID } from '../../src/core/model';

describe('seed', () => {
  it('seeds once', async () => {
    const repo = createMemoryRepo();
    await ensureSeeded(repo);
    await ensureSeeded(repo);
    const cats = await repo.listCategories();
    expect(cats.filter((c) => c.id === UNCATEGORIZED_ID)).toHaveLength(1);
    expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(['식비', '카페', '편의점', '교통', '급여']));
    const methods = (await repo.listPaymentMethods()).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(methods.map((p) => [p.name, p.kind])).toEqual([['신용카드', 'credit'], ['체크카드', 'debit'], ['현금', 'cash'], ['계좌', 'account']]);
  });
  it('adds credit/debit card defaults to an existing install once, keeping user data', async () => {
    const repo = createMemoryRepo();
    await repo.commit({
      categories: [{ id: 'c', name: '식비', kind: 'expense', sortOrder: 0, archived: false }],
      paymentMethods: [{ id: 'pm-cash', name: '현금', kind: 'cash', matchKeys: [], sortOrder: 0, archived: false }],
    });
    await ensureSeeded(repo);
    await ensureSeeded(repo);
    const names = (await repo.listPaymentMethods()).map((p) => p.name).sort();
    expect(names).toEqual(['신용카드', '체크카드', '현금']);
    expect((await repo.listCategories()).map((c) => c.name)).toEqual(['식비']);
  });
  it('sample card methods skip existing names', () => {
    const added = sampleCardMethods([{ id: 'x', name: '가나카드', kind: 'card', matchKeys: [], sortOrder: 0, archived: false }]);
    expect(added.map((p) => p.name)).toEqual(['다라카드', '마바페이']);
    expect(added[0].matchKeys).toEqual(['다라카드']);
  });
});
