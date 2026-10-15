export type TxType = 'expense' | 'income' | 'transfer';
export type RecordMethod = 'manual' | 'auto' | 'confirmed';
export type SourceApp = 'sms' | 'kakaotalk' | 'payapp' | 'paste';
export type SaveMode = 'auto' | 'review_all';
export type PermissionState = 'granted' | 'denied' | 'revoked' | 'unknown';

export const UNCATEGORIZED_ID = 'cat-uncategorized';
export const DUP_WINDOW_MS = 2 * 60 * 1000;
export const REFUND_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
export const DATE_UNCERTAIN_MS = 24 * 60 * 60 * 1000;
export const CANDIDATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SOURCE_APP_LABEL: Record<SourceApp, string> = {
  sms: '문자',
  kakaotalk: '카카오톡',
  payapp: '간편결제 앱',
  paste: '붙여넣기',
};

export const RECORD_METHOD_LABEL: Record<RecordMethod, string> = {
  manual: '직접 입력',
  auto: '자동 기록',
  confirmed: '확인 후 저장',
};

export const TX_TYPE_LABEL: Record<TxType, string> = {
  expense: '지출',
  income: '수입',
  transfer: '이체',
};

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  date: string;
  time?: string;
  merchant?: string;
  categoryId: string;
  paymentMethodId: string;
  toPaymentMethodId?: string;
  memo?: string;
  recordMethod: RecordMethod;
  dateFromReceipt: boolean;
  userEdited: boolean;
  approvalNo?: string;
  /** 월세·통신비·구독처럼 매달 고정으로 나가는 지출 */
  fixed?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Refund {
  id: string;
  originalTxId: string;
  amount: number;
  date: string;
  time?: string;
  createdAt: number;
}

export type CandidateReason =
  | 'missing_field'
  | 'unsupported_format'
  | 'duplicate_suspect'
  | 'refund_unmatched'
  | 'refund_ambiguous'
  | 'refund_exceeds'
  | 'date_uncertain'
  | 'review_mode';

export const REASON_LABEL: Record<CandidateReason, string> = {
  missing_field: '누락된 값이 있어요',
  unsupported_format: '자동 저장을 지원하지 않는 형식이에요',
  duplicate_suspect: '이미 기록된 거래와 같을 수 있어요',
  refund_unmatched: '원거래를 찾지 못한 취소·환불이에요',
  refund_ambiguous: '원거래 후보가 여러 건이에요',
  refund_exceeds: '환불액이 남은 결제 금액보다 커요',
  date_uncertain: '거래 날짜가 불확실해요',
  review_mode: '확인 후 저장 모드예요',
};

export interface CandidateFields {
  kind: 'approval' | 'cancel';
  amount?: number;
  merchant?: string;
  cardName?: string;
  cardLast4?: string;
  paymentMethodId?: string;
  categoryId?: string;
  date: string;
  time?: string;
  dateFromReceipt: boolean;
  approvalNo?: string;
  installment: boolean;
  foreign: boolean;
}

export interface Candidate {
  id: string;
  fields: CandidateFields;
  reasons: CandidateReason[];
  duplicateOfTxId?: string;
  refundCandidateTxIds?: string[];
  encryptedExcerpt?: string;
  status: 'pending' | 'confirmed' | 'ignored';
  sourceRecordId: string;
  sourceApp: SourceApp;
  createdAt: number;
  expiresAt: number;
}

export type RecordOutcome = 'saved' | 'merged' | 'candidate' | 'ignored_non_tx' | 'refund_linked';

export interface NotificationRecord {
  id: string;
  sourceApp: SourceApp;
  notificationKey: string;
  receivedAt: number;
  ruleId: string;
  ruleVersion: number;
  outcome: RecordOutcome;
  linkedTxId?: string;
  linkedCandidateId?: string;
  linkedRefundId?: string;
}

export interface Category {
  id: string;
  name: string;
  kind: 'expense' | 'income';
  sortOrder: number;
  archived: boolean;
}

export type PaymentKind = 'credit' | 'debit' | 'card' | 'pay' | 'cash' | 'account';

/** 표시 순서도 이 순서를 따른다. 'card'는 신용·체크 구분 전 데이터용. */
export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  credit: '신용카드',
  debit: '체크카드',
  card: '카드',
  pay: '간편결제',
  cash: '현금',
  account: '계좌',
};

export interface PaymentMethod {
  id: string;
  name: string;
  kind: PaymentKind;
  matchKeys: string[];
  sortOrder: number;
  archived: boolean;
}

export interface Budget {
  month: string;
  total: number;
}

export interface AllowedSource {
  app: SourceApp;
  sender?: string;
}

export interface AutoRecordSettings {
  enabled: boolean;
  permission: PermissionState;
  allowedSources: AllowedSource[];
  saveMode: SaveMode;
  lastProcessedAt?: number;
}

export interface AppSettings {
  onboarded: boolean;
  lockEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  /** 가계부 한 달의 시작일 (1~28). 없으면 1일. */
  monthStartDay?: number;
}

export interface NotificationInput {
  sourceApp: SourceApp;
  sender?: string;
  text: string;
  receivedAt: number;
  notificationKey: string;
}

export interface PendingItem {
  id: string;
  input: NotificationInput;
  paste: boolean;
  createdAt: number;
}

export const DEFAULT_AUTO_SETTINGS: AutoRecordSettings = {
  enabled: false,
  permission: 'unknown',
  allowedSources: [],
  saveMode: 'auto',
};

export const DEFAULT_APP_SETTINGS: AppSettings = { onboarded: false, lockEnabled: false };
