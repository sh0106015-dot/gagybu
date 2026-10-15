import type {
  AppSettings, AutoRecordSettings, Budget, Candidate, Category, NotificationRecord,
  PaymentMethod, PendingItem, Refund, SourceApp, Transaction,
} from './model';

export interface WriteBatch {
  transactions?: Transaction[];
  refunds?: Refund[];
  candidates?: Candidate[];
  records?: NotificationRecord[];
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  budgets?: Budget[];
  autoSettings?: AutoRecordSettings;
  appSettings?: AppSettings;
  deleteTransactionIds?: string[];
  deleteRefundIds?: string[];
  deleteCandidateIds?: string[];
}

export interface Repo {
  /** 배치의 모든 쓰기·삭제를 원자적으로 반영한다. */
  commit(batch: WriteBatch): Promise<void>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  listTransactions(): Promise<Transaction[]>;
  listRefunds(): Promise<Refund[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  listCandidates(): Promise<Candidate[]>;
  findRecord(sourceApp: SourceApp, notificationKey: string): Promise<NotificationRecord | undefined>;
  getRecord(id: string): Promise<NotificationRecord | undefined>;
  listRecords(): Promise<NotificationRecord[]>;
  listCategories(): Promise<Category[]>;
  listPaymentMethods(): Promise<PaymentMethod[]>;
  getBudget(month: string): Promise<Budget | undefined>;
  getAutoSettings(): Promise<AutoRecordSettings>;
  getAppSettings(): Promise<AppSettings>;
  enqueuePending(item: PendingItem): Promise<void>;
  listPending(): Promise<PendingItem[]>;
  removePending(id: string): Promise<void>;
  /** 모든 데이터(키 포함)를 삭제한다. */
  clearAll(): Promise<void>;
}
