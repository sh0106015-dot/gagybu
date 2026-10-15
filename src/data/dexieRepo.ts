import type { Repo, WriteBatch } from '../core/repo';
import type { AppSettings, AutoRecordSettings } from '../core/model';
import { DEFAULT_APP_SETTINGS, DEFAULT_AUTO_SETTINGS } from '../core/model';
import type { GagyebuDB } from './db';

export function createDexieRepo(db: GagyebuDB): Repo {
  const kvGet = async <T>(key: string, fallback: T): Promise<T> =>
    ((await db.kv.get(key))?.value as T | undefined) ?? structuredClone(fallback);
  const dataTables = () => [
    db.transactions, db.refunds, db.candidates, db.records, db.categories,
    db.paymentMethods, db.budgets, db.kv, db.pending, db.photos,
  ];

  return {
    async commit(b: WriteBatch) {
      await db.transaction('rw', dataTables(), async () => {
        if (b.transactions?.length) await db.transactions.bulkPut(b.transactions);
        if (b.refunds?.length) await db.refunds.bulkPut(b.refunds);
        if (b.candidates?.length) await db.candidates.bulkPut(b.candidates);
        if (b.records?.length) await db.records.bulkPut(b.records);
        if (b.categories?.length) await db.categories.bulkPut(b.categories);
        if (b.paymentMethods?.length) await db.paymentMethods.bulkPut(b.paymentMethods);
        if (b.budgets?.length) await db.budgets.bulkPut(b.budgets);
        if (b.autoSettings) await db.kv.put({ key: 'autoSettings', value: b.autoSettings });
        if (b.appSettings) await db.kv.put({ key: 'appSettings', value: b.appSettings });
        if (b.deleteTransactionIds?.length) await db.transactions.bulkDelete(b.deleteTransactionIds);
        if (b.deleteRefundIds?.length) await db.refunds.bulkDelete(b.deleteRefundIds);
        if (b.deleteCandidateIds?.length) await db.candidates.bulkDelete(b.deleteCandidateIds);
        if (b.photos?.length) await db.photos.bulkPut(b.photos);
        if (b.deletePhotoIds?.length) await db.photos.bulkDelete(b.deletePhotoIds);
      });
    },
    getTransaction: (id) => db.transactions.get(id),
    listTransactions: () => db.transactions.toArray(),
    listRefunds: () => db.refunds.toArray(),
    getCandidate: (id) => db.candidates.get(id),
    listCandidates: () => db.candidates.toArray(),
    findRecord: (sourceApp, notificationKey) =>
      db.records.where('[sourceApp+notificationKey]').equals([sourceApp, notificationKey]).first(),
    getRecord: (id) => db.records.get(id),
    listRecords: () => db.records.toArray(),
    listCategories: () => db.categories.toArray(),
    listPaymentMethods: () => db.paymentMethods.toArray(),
    getBudget: (month) => db.budgets.get(month),
    listPhotos: (txId) => db.photos.where('txId').equals(txId).sortBy('createdAt'),
    getAutoSettings: () => kvGet<AutoRecordSettings>('autoSettings', DEFAULT_AUTO_SETTINGS),
    getAppSettings: () => kvGet<AppSettings>('appSettings', DEFAULT_APP_SETTINGS),
    async enqueuePending(item) { await db.pending.put(item); },
    listPending: () => db.pending.toArray(),
    async removePending(id) { await db.pending.delete(id); },
    async clearAll() {
      await db.transaction('rw', dataTables(), async () => {
        await Promise.all(dataTables().map((t) => t.clear()));
      });
    },
  };
}
