import type { Repo, WriteBatch } from '../core/repo';
import type {
  AppSettings, AutoRecordSettings, Budget, Candidate, Category, NotificationRecord,
  PaymentMethod, PendingItem, Refund, Transaction,
} from '../core/model';
import { DEFAULT_APP_SETTINGS, DEFAULT_AUTO_SETTINGS } from '../core/model';

const clone = <T>(v: T): T => structuredClone(v);

export function createMemoryRepo(): Repo {
  let txs = new Map<string, Transaction>();
  let refunds = new Map<string, Refund>();
  let candidates = new Map<string, Candidate>();
  let records = new Map<string, NotificationRecord>();
  let categories = new Map<string, Category>();
  let methods = new Map<string, PaymentMethod>();
  let budgets = new Map<string, Budget>();
  let pending = new Map<string, PendingItem>();
  let auto: AutoRecordSettings = clone(DEFAULT_AUTO_SETTINGS);
  let app: AppSettings = clone(DEFAULT_APP_SETTINGS);

  const putAll = <T>(m: Map<string, T>, items: T[] | undefined, key: (t: T) => string) =>
    items?.forEach((i) => m.set(key(i), clone(i)));
  const values = <T>(m: Map<string, T>) => [...m.values()].map(clone);

  return {
    async commit(b: WriteBatch) {
      putAll(txs, b.transactions, (t) => t.id);
      putAll(refunds, b.refunds, (r) => r.id);
      putAll(candidates, b.candidates, (c) => c.id);
      putAll(records, b.records, (r) => r.id);
      putAll(categories, b.categories, (c) => c.id);
      putAll(methods, b.paymentMethods, (p) => p.id);
      putAll(budgets, b.budgets, (x) => x.month);
      if (b.autoSettings) auto = clone(b.autoSettings);
      if (b.appSettings) app = clone(b.appSettings);
      b.deleteTransactionIds?.forEach((id) => txs.delete(id));
      b.deleteRefundIds?.forEach((id) => refunds.delete(id));
      b.deleteCandidateIds?.forEach((id) => candidates.delete(id));
    },
    async getTransaction(id) { const t = txs.get(id); return t && clone(t); },
    async listTransactions() { return values(txs); },
    async listRefunds() { return values(refunds); },
    async getCandidate(id) { const c = candidates.get(id); return c && clone(c); },
    async listCandidates() { return values(candidates); },
    async findRecord(sourceApp, key) {
      const r = [...records.values()].find((x) => x.sourceApp === sourceApp && x.notificationKey === key);
      return r && clone(r);
    },
    async getRecord(id) { const r = records.get(id); return r && clone(r); },
    async listRecords() { return values(records); },
    async listCategories() { return values(categories); },
    async listPaymentMethods() { return values(methods); },
    async getBudget(month) { const x = budgets.get(month); return x && clone(x); },
    async getAutoSettings() { return clone(auto); },
    async getAppSettings() { return clone(app); },
    async enqueuePending(item) { pending.set(item.id, clone(item)); },
    async listPending() { return values(pending); },
    async removePending(id) { pending.delete(id); },
    async clearAll() {
      txs = new Map(); refunds = new Map(); candidates = new Map(); records = new Map();
      categories = new Map(); methods = new Map(); budgets = new Map(); pending = new Map();
      auto = clone(DEFAULT_AUTO_SETTINGS); app = clone(DEFAULT_APP_SETTINGS);
    },
  };
}
