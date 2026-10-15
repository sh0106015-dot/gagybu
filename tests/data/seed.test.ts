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
    expect((await repo.listPaymentMethods()).map((p) => p.name)).toEqual(['현금', '계좌']);
  });
  it('sample card methods skip existing names', () => {
    const added = sampleCardMethods([{ id: 'x', name: '가나카드', kind: 'card', matchKeys: [], sortOrder: 0, archived: false }]);
    expect(added.map((p) => p.name)).toEqual(['다라카드', '마바페이']);
    expect(added[0].matchKeys).toEqual(['다라카드']);
  });
});
