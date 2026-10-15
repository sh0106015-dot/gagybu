import { describe, it, expect } from 'vitest';
import type { Repo } from '../../src/core/repo';
import type { Transaction, NotificationRecord } from '../../src/core/model';
import { DEFAULT_AUTO_SETTINGS } from '../../src/core/model';

export function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1', type: 'expense', amount: 1000, date: '2026-10-15', time: '12:00',
    categoryId: 'c', paymentMethodId: 'p', recordMethod: 'manual',
    dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
  };
}

export function runRepoContract(name: string, make: () => Promise<Repo>) {
  describe(`Repo contract: ${name}`, () => {
    it('commits and reads transactions', async () => {
      const repo = await make();
      await repo.commit({ transactions: [tx(), tx({ id: 't2' })] });
      expect((await repo.listTransactions()).map((t) => t.id).sort()).toEqual(['t1', 't2']);
      expect((await repo.getTransaction('t2'))?.id).toBe('t2');
    });
    it('deletes in batch', async () => {
      const repo = await make();
      await repo.commit({
        transactions: [tx()],
        refunds: [{ id: 'r1', originalTxId: 't1', amount: 1, date: '2026-10-15', createdAt: 1 }],
      });
      await repo.commit({ deleteTransactionIds: ['t1'], deleteRefundIds: ['r1'] });
      expect(await repo.listTransactions()).toEqual([]);
      expect(await repo.listRefunds()).toEqual([]);
    });
    it('finds record by source and key', async () => {
      const repo = await make();
      const r: NotificationRecord = {
        id: 'n1', sourceApp: 'sms', notificationKey: 'k1', receivedAt: 1,
        ruleId: 'x', ruleVersion: 1, outcome: 'saved', linkedTxId: 't1',
      };
      await repo.commit({ records: [r] });
      expect((await repo.findRecord('sms', 'k1'))?.id).toBe('n1');
      expect(await repo.findRecord('kakaotalk', 'k1')).toBeUndefined();
    });
    it('returns default settings and stores them', async () => {
      const repo = await make();
      expect(await repo.getAutoSettings()).toEqual(DEFAULT_AUTO_SETTINGS);
      await repo.commit({ autoSettings: { ...DEFAULT_AUTO_SETTINGS, enabled: true } });
      expect((await repo.getAutoSettings()).enabled).toBe(true);
      expect((await repo.getAppSettings()).onboarded).toBe(false);
    });
    it('budgets by month', async () => {
      const repo = await make();
      await repo.commit({ budgets: [{ month: '2026-10', total: 500000 }] });
      expect((await repo.getBudget('2026-10'))?.total).toBe(500000);
      expect(await repo.getBudget('2026-11')).toBeUndefined();
    });
    it('pending queue', async () => {
      const repo = await make();
      await repo.enqueuePending({
        id: 'q1', paste: false, createdAt: 1,
        input: { sourceApp: 'sms', text: 'x', receivedAt: 1, notificationKey: 'k' },
      });
      expect((await repo.listPending()).length).toBe(1);
      await repo.removePending('q1');
      expect(await repo.listPending()).toEqual([]);
    });
    it('clearAll wipes everything', async () => {
      const repo = await make();
      await repo.commit({ transactions: [tx()], budgets: [{ month: '2026-10', total: 1 }] });
      await repo.clearAll();
      expect(await repo.listTransactions()).toEqual([]);
      expect(await repo.getBudget('2026-10')).toBeUndefined();
    });
  });
}
