import Dexie, { type Table } from 'dexie';
import type {
  Budget, Candidate, Category, NotificationRecord, PaymentMethod, PendingItem, Photo, Refund, Transaction,
} from '../core/model';

export interface KvRow {
  key: string;
  value: unknown;
}

export class GagyebuDB extends Dexie {
  transactions!: Table<Transaction, string>;
  refunds!: Table<Refund, string>;
  candidates!: Table<Candidate, string>;
  records!: Table<NotificationRecord, string>;
  categories!: Table<Category, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  budgets!: Table<Budget, string>;
  kv!: Table<KvRow, string>;
  pending!: Table<PendingItem, string>;
  photos!: Table<Photo, string>;

  constructor(name = 'gagyebu') {
    super(name);
    this.version(1).stores({
      transactions: 'id, date',
      refunds: 'id, originalTxId',
      candidates: 'id, status',
      records: 'id, [sourceApp+notificationKey], linkedTxId',
      categories: 'id',
      paymentMethods: 'id',
      budgets: 'month',
      kv: 'key',
      pending: 'id',
    });
    this.version(2).stores({ photos: 'id, txId' });
  }
}
