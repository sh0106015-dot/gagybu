# 가계부 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결제 알림 처리 엔진(붙여넣기·시뮬레이터 입력)과 예산 관리를 갖춘 오프라인 가계부 PWA를 만든다.

**Architecture:** `src/core/`는 DOM·Dexie에 의존하지 않는 순수 TS로 파서·중복·환불·파이프라인·계산을 담고 `Repo` 인터페이스만 주입받는다. `src/data/`는 Dexie(IndexedDB) `Repo` 구현과 암호화를, `src/ui/`는 React 화면을 담는다. 모든 쓰기는 `Repo.commit(batch)` 한 번으로 원자적으로 반영한다.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), react-router-dom 6 (HashRouter), Dexie 4 + dexie-react-hooks, Vitest 2 + fake-indexeddb, vite-plugin-pwa. Node 24.

**Spec:** `docs/superpowers/specs/2026-10-15-gagyebu-pwa-design.md`

## Global Constraints

- 금액은 원 단위 정수(`number`, `Number.isInteger`), 음수 금지.
- 날짜는 기기 시간대 기준 `YYYY-MM-DD`, 시각 `HH:mm`, 월 키 `YYYY-MM`.
- 네트워크 전송 없음. 콘솔·오류 로그에 금액·가맹점·원문 출력 금지 (ruleId·오류 종류만).
- `src/core/**`는 `dexie`, `react`, DOM API를 import하지 않는다.
- 중복 시각 창 2분, 환불 원거래 탐색 90일, 날짜 불확실 기준 24시간, 후보 보관 30일.
- 확인함 후보(pending)는 어떤 합계에도 포함하지 않는다.
- 이체는 수입·지출 합계에서 제외.
- UI 문구는 한국어. 상태는 색상+텍스트로 표시. 모든 입력에 `<label>`.

## Review Focus

1. 연도 경계: 1/1 00:05에 수신한 "12/31 23:58" 알림 → 전년도 12/31로 기록되어야 함. (Task 4 테스트)
2. 같은 알림 키가 내용만 바뀌어 다시 와도(알림 업데이트) 한 번만 처리. (Task 7 테스트)
3. 취소 알림이 문자와 카톡으로 두 번 와도 환불은 한 번만 반영. (Task 7 테스트)
4. 자동 기록 거래를 삭제한 뒤 같은 알림이 다시 와도 재생성되지 않음. (Task 8 테스트)
5. 월 예산 0원 또는 미설정 시 사용률 계산에서 0으로 나누지 않음. (Task 9 테스트)

## File Structure

```
gagyebu/
  package.json, vite.config.ts, tsconfig.json, index.html
  src/
    core/
      money.ts            parseWon, formatWon
      dates.ts            toDateKey, toTimeKey, monthKey, shiftMonth, txAt
      ids.ts              newId
      model.ts            도메인 타입, 상수
      repo.ts             Repo, WriteBatch 인터페이스
      merchant.ts         normalizeMerchant, guessCategory
      parser/
        types.ts          ParsedTx, ParseResult, FormatRule
        nonTx.ts          classifyNonTx
        formats.ts        FORMAT_RULES
        index.ts          parseNotification
      resolve.ts          mapPaymentMethod, resolveTxDateTime
      dedup.ts            findDuplicateTx, findDuplicateRefund
      refund.ts           refundableAmount, matchRefund
      pipeline/ingest.ts  ingestNotification
      actions.ts          후보 처리·거래 CRUD·만료 정리
      budget.ts           summarizeMonth, monthlyTrend
      csv.ts              toCsv
    data/
      memoryRepo.ts       테스트용 Repo
      dexieRepo.ts        IndexedDB Repo
      crypto.ts           AES-GCM 발췌, PBKDF2 PIN
      seed.ts             기본 카테고리·결제수단·설정
      app.ts              앱 전역 deps 생성, 대기 큐 재처리
    ui/
      App.tsx, AppContext.tsx, styles.css
      components/*.tsx
      screens/*.tsx
    main.tsx
  tests/
    core/*.test.ts
    data/*.test.ts
```

---

### Task 1: 프로젝트 골격 + 금액·날짜 유틸

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`
- Create: `src/core/money.ts`, `src/core/dates.ts`, `src/core/ids.ts`
- Test: `tests/core/money.test.ts`, `tests/core/dates.test.ts`

**Interfaces:**
- Produces: `parseWon(s: string): number | null`, `formatWon(n: number): string`, `toDateKey(d: Date): string`, `toTimeKey(d: Date): string`, `monthKey(dateKey: string): string`, `shiftMonth(month: string, delta: number): string`, `txAt(date: string, time?: string): number`, `newId(): string`

- [ ] **Step 1: 의존성 설치**

```bash
npm init -y
npm i react@18 react-dom@18 react-router-dom@6 dexie@4 dexie-react-hooks@1
npm i -D typescript@5 vite@5 @vitejs/plugin-react@4 vitest@2 fake-indexeddb@6 vite-plugin-pwa@0.20 @types/react@18 @types/react-dom@18
```

`package.json`의 `scripts`를 다음으로 설정하고 `"type": "module"` 추가:

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "typecheck": "tsc --noEmit"
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts` (PWA는 Task 16에서 추가):

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#2f6f5e" />
    <title>가계부</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx` (임시, Task 11에서 교체):

```tsx
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<p>가계부</p>);
```

`.gitignore`: `node_modules`, `dist`, `dev-dist`

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/core/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseWon, formatWon } from '../../src/core/money';

describe('money', () => {
  it('parses comma separated won', () => {
    expect(parseWon('12,000')).toBe(12000);
    expect(parseWon(' 8500 ')).toBe(8500);
  });
  it('rejects invalid', () => {
    expect(parseWon('')).toBeNull();
    expect(parseWon('12.5')).toBeNull();
    expect(parseWon('-100')).toBeNull();
    expect(parseWon('1,2a')).toBeNull();
  });
  it('formats', () => {
    expect(formatWon(1234567)).toBe('1,234,567원');
    expect(formatWon(-3000)).toBe('-3,000원');
  });
});
```

`tests/core/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toDateKey, toTimeKey, monthKey, shiftMonth, txAt } from '../../src/core/dates';

describe('dates', () => {
  it('formats local date/time', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(toDateKey(d)).toBe('2026-01-05');
    expect(toTimeKey(d)).toBe('09:07');
  });
  it('month helpers', () => {
    expect(monthKey('2026-10-31')).toBe('2026-10');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('txAt builds local timestamp', () => {
    expect(txAt('2026-10-15', '12:30')).toBe(new Date(2026, 9, 15, 12, 30).getTime());
    expect(txAt('2026-10-15')).toBe(new Date(2026, 9, 15, 0, 0).getTime());
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/core`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: 구현**

`src/core/money.ts`:

```ts
export function parseWon(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}
```

`src/core/dates.ts`:

```ts
const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeKey(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function txAt(date: string, time?: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
```

`src/core/ids.ts`:

```ts
export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/core && npx tsc --noEmit`
Expected: PASS, 타입 오류 없음

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Vite+React+TS 골격과 금액·날짜 유틸"
```

---

### Task 2: 도메인 모델 + Repo 인터페이스 + 메모리 Repo

**Files:**
- Create: `src/core/model.ts`, `src/core/repo.ts`, `src/data/memoryRepo.ts`
- Test: `tests/data/repoContract.ts` (공용 계약 테스트), `tests/data/memoryRepo.test.ts`

**Interfaces:**
- Produces: 아래 `model.ts`의 모든 타입·상수, `Repo`, `WriteBatch`, `createMemoryRepo(): Repo`, `runRepoContract(name: string, make: () => Promise<Repo>)`, 테스트 헬퍼 `tx(over)`

- [ ] **Step 1: 타입 작성** (컴파일 대상)

`src/core/model.ts`:

```ts
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

export interface PaymentMethod {
  id: string;
  name: string;
  kind: 'card' | 'cash' | 'account' | 'pay';
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
```

`src/core/repo.ts`:

```ts
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
```

- [ ] **Step 2: 실패하는 계약 테스트 작성**

`tests/data/repoContract.ts`:

```ts
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
```

`tests/data/memoryRepo.test.ts`:

```ts
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { runRepoContract } from './repoContract';

runRepoContract('memory', async () => createMemoryRepo());
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/data`
Expected: FAIL (`createMemoryRepo` 없음)

- [ ] **Step 4: 구현**

`src/data/memoryRepo.ts`:

```ts
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
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/data && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): 도메인 모델, Repo 인터페이스, 메모리 Repo"
```

---

### Task 3: 알림 파서 (형식 규칙 + 비거래 판별)

**Files:**
- Create: `src/core/parser/types.ts`, `src/core/parser/nonTx.ts`, `src/core/parser/formats.ts`, `src/core/parser/index.ts`
- Test: `tests/core/parser.test.ts`

**Interfaces:**
- Consumes: `parseWon` (Task 1), `SourceApp` (Task 2)
- Produces:
  - `ParsedTx { kind: 'approval'|'cancel'; amount?: number; merchant?: string; cardName?: string; cardLast4?: string; month?: number; day?: number; hour?: number; minute?: number; approvalNo?: string; installment: boolean; foreign: boolean }`
  - `ParseResult = { status: 'non_tx'; reason: NonTxReason } | { status: 'tx' | 'unsupported'; ruleId: string; ruleVersion: number; tx: ParsedTx }`
  - `parseNotification(text: string, sourceApp: SourceApp): ParseResult`
  - `FORMAT_RULES: FormatRule[]` (`{ id, version, label, apps, example, parse }`) — 자동 기록 설정 화면의 지원 형식 목록과 시뮬레이터가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/core/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseNotification } from '../../src/core/parser';

const SMS_A = '[Web발신]\n가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스 누적 345,000원';
const SMS_A_CANCEL = '[Web발신]\n가나카드(1234)취소 홍*동 12,000원 10/15 13:10 스타벅스';
const SMS_B = '다라카드 승인 5678 8,500원 10/15 08:12 GS25역삼점 승인번호 12345678';
const KAKAO = '가나카드 결제 승인\n금액: 12,000원\n가맹점: 스타벅스\n일시: 10/15 12:30\n카드: 가나(1234)';
const PAY = '마바페이 결제 완료 12,000원 · 스타벅스 · 10월 15일 12:30';

describe('parseNotification', () => {
  it('sms-card-a approval', () => {
    const r = parseNotification(SMS_A, 'sms');
    expect(r.status).toBe('tx');
    if (r.status === 'non_tx') throw new Error();
    expect(r.ruleId).toBe('sms-card-a');
    expect(r.tx).toMatchObject({
      kind: 'approval', amount: 12000, merchant: '스타벅스', cardName: '가나카드',
      cardLast4: '1234', month: 10, day: 15, hour: 12, minute: 30, installment: false, foreign: false,
    });
  });
  it('sms-card-a cancel', () => {
    const r = parseNotification(SMS_A_CANCEL, 'sms');
    if (r.status === 'non_tx') throw new Error();
    expect(r.tx).toMatchObject({ kind: 'cancel', amount: 12000, merchant: '스타벅스', hour: 13, minute: 10 });
  });
  it('sms-card-a installment is flagged', () => {
    const r = parseNotification(SMS_A.replace('일시불', '3개월'), 'sms');
    if (r.status === 'non_tx') throw new Error();
    expect(r.status).toBe('tx');
    expect(r.tx.installment).toBe(true);
  });
  it('sms-card-b with approval number', () => {
    const r = parseNotification(SMS_B, 'sms');
    if (r.status === 'non_tx') throw new Error();
    expect(r.ruleId).toBe('sms-card-b');
    expect(r.tx).toMatchObject({ kind: 'approval', amount: 8500, merchant: 'GS25역삼점', cardName: '다라카드', cardLast4: '5678', approvalNo: '12345678' });
  });
  it('kakao-card-a', () => {
    const r = parseNotification(KAKAO, 'kakaotalk');
    if (r.status === 'non_tx') throw new Error();
    expect(r.ruleId).toBe('kakao-card-a');
    expect(r.tx).toMatchObject({ kind: 'approval', amount: 12000, merchant: '스타벅스', cardName: '가나카드', cardLast4: '1234', month: 10, day: 15 });
  });
  it('kakao-card-a without merchant still parses', () => {
    const r = parseNotification(KAKAO.replace('가맹점: 스타벅스\n', ''), 'kakaotalk');
    if (r.status === 'non_tx') throw new Error();
    expect(r.status).toBe('tx');
    expect(r.tx.merchant).toBeUndefined();
  });
  it('pay-app-a approval and cancel', () => {
    const r = parseNotification(PAY, 'payapp');
    if (r.status === 'non_tx') throw new Error();
    expect(r.tx).toMatchObject({ kind: 'approval', amount: 12000, merchant: '스타벅스', cardName: '마바페이', month: 10, day: 15 });
    const c = parseNotification(PAY.replace('완료', '취소'), 'payapp');
    if (c.status === 'non_tx') throw new Error();
    expect(c.tx.kind).toBe('cancel');
  });
  it('rules only apply to their source app, paste matches all', () => {
    expect(parseNotification(KAKAO, 'sms').status).toBe('unsupported');
    expect(parseNotification(KAKAO, 'paste').status).toBe('tx');
  });
  it.each([
    ['(광고) 가나카드 10월 이벤트 최대 5,000원 할인', 'ad'],
    ['[가나카드] 인증번호 [123456]를 입력해주세요', 'otp'],
    ['가나카드 10월 결제대금 345,000원 출금 완료', 'bill_payment'],
    ['가나카드 10/25 결제 예정 금액 345,000원', 'info'],
    ['가나카드 이용한도 안내 잔여한도 1,000,000원', 'info'],
    ['오늘 저녁 먹을래?', 'not_transaction'],
  ])('non-transaction: %s', (text, reason) => {
    expect(parseNotification(text, 'sms')).toEqual({ status: 'non_tx', reason });
  });
  it('unknown transaction-like text is unsupported', () => {
    const r = parseNotification('라마카드 사용 23,000원 올리브영', 'sms');
    expect(r.status).toBe('unsupported');
    if (r.status === 'non_tx') throw new Error();
    expect(r.tx).toMatchObject({ kind: 'approval', amount: 23000 });
  });
  it('foreign currency is unsupported and flagged', () => {
    const r = parseNotification('가나카드(1234)승인 홍*동 USD 12.50 10/15 12:30 AMAZON', 'sms');
    expect(r.status).toBe('unsupported');
    if (r.status === 'non_tx') throw new Error();
    expect(r.tx.foreign).toBe(true);
    expect(r.tx.amount).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/core/parser.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`src/core/parser/types.ts`:

```ts
import type { SourceApp } from '../model';

export interface ParsedTx {
  kind: 'approval' | 'cancel';
  amount?: number;
  merchant?: string;
  cardName?: string;
  cardLast4?: string;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  approvalNo?: string;
  installment: boolean;
  foreign: boolean;
}

export type NonTxReason = 'ad' | 'otp' | 'bill_payment' | 'info' | 'not_transaction';

export type ParseResult =
  | { status: 'non_tx'; reason: NonTxReason }
  | { status: 'tx' | 'unsupported'; ruleId: string; ruleVersion: number; tx: ParsedTx };

export interface FormatRule {
  id: string;
  version: number;
  label: string;
  apps: SourceApp[];
  example: string;
  parse(text: string): ParsedTx | null;
}
```

`src/core/parser/nonTx.ts`:

```ts
import type { NonTxReason } from './types';

export function classifyNonTx(text: string): NonTxReason | null {
  if (/\(광고\)|\[광고\]|이벤트|쿠폰/.test(text)) return 'ad';
  if (/인증\s*번호|OTP/i.test(text)) return 'otp';
  if (/카드\s*대금|결제\s*대금|대금\s*출금/.test(text)) return 'bill_payment';
  if (/(결제|청구)\s*예정|이용\s*한도|잔여\s*한도|잔액\s*안내/.test(text)) return 'info';
  return null;
}
```

`src/core/parser/formats.ts`:

```ts
import { parseWon } from '../money';
import type { FormatRule, ParsedTx } from './types';

const oneLine = (t: string) => t.replace(/\s+/g, ' ').trim();
const n = (s: string | undefined) => (s === undefined ? undefined : Number(s));

function build(kindWord: string, amountStr: string, rest: Omit<ParsedTx, 'kind' | 'amount' | 'foreign'>): ParsedTx | null {
  const amount = parseWon(amountStr);
  if (amount === null) return null;
  const kind = /취소|환불/.test(kindWord) ? 'cancel' : 'approval';
  return { kind, amount, foreign: false, ...rest };
}

const smsCardA: FormatRule = {
  id: 'sms-card-a',
  version: 1,
  label: '가나카드형 문자 (승인·취소)',
  apps: ['sms'],
  example: '[Web발신]\n가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스 누적 345,000원',
  parse(text) {
    const m = /^(?:\[Web발신\] )?(\S+?카드)\((\d{4})\)(승인|취소) \S+ ([\d,]+)원 ?(일시불|\d+개월)? ?(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}) (.+?)(?: 누적 ?[\d,]+원)?$/.exec(oneLine(text));
    if (!m) return null;
    return build(m[3], m[4], {
      cardName: m[1], cardLast4: m[2], installment: /개월/.test(m[5] ?? ''),
      month: n(m[6]), day: n(m[7]), hour: n(m[8]), minute: n(m[9]), merchant: m[10].trim(),
    });
  },
};

const smsCardB: FormatRule = {
  id: 'sms-card-b',
  version: 1,
  label: '다라카드형 문자 (승인번호 포함)',
  apps: ['sms'],
  example: '다라카드 승인 5678 8,500원 10/15 08:12 GS25역삼점 승인번호 12345678',
  parse(text) {
    const m = /^(?:\[Web발신\] )?(\S+?카드) (승인|취소) (\d{4}) ([\d,]+)원 ?(일시불|\d+개월)? ?(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}) (.+?)(?: 승인번호 ?(\d+))?$/.exec(oneLine(text));
    if (!m) return null;
    return build(m[2], m[4], {
      cardName: m[1], cardLast4: m[3], installment: /개월/.test(m[5] ?? ''),
      month: n(m[6]), day: n(m[7]), hour: n(m[8]), minute: n(m[9]), merchant: m[10].trim(), approvalNo: m[11],
    });
  },
};

const kakaoCardA: FormatRule = {
  id: 'kakao-card-a',
  version: 1,
  label: '카카오톡 카드 알림 (여러 줄)',
  apps: ['kakaotalk'],
  example: '가나카드 결제 승인\n금액: 12,000원\n가맹점: 스타벅스\n일시: 10/15 12:30\n카드: 가나(1234)',
  parse(text) {
    const head = /^(\S+?카드)\s*결제\s*(승인|취소)/.exec(text.trim());
    const amt = /금액\s*:\s*([\d,]+)원/.exec(text);
    if (!head || !amt) return null;
    const mer = /가맹점\s*:\s*(.+)/.exec(text);
    const dt = /일시\s*:\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(text);
    const card = /카드\s*:\s*\S*?\((\d{4})\)/.exec(text);
    const appr = /승인번호\s*:\s*(\d+)/.exec(text);
    return build(head[2], amt[1], {
      cardName: head[1], cardLast4: card?.[1], merchant: mer?.[1].trim(),
      month: n(dt?.[1]), day: n(dt?.[2]), hour: n(dt?.[3]), minute: n(dt?.[4]),
      approvalNo: appr?.[1], installment: /할부\s*:\s*\d+\s*개월/.test(text),
    });
  },
};

const payAppA: FormatRule = {
  id: 'pay-app-a',
  version: 1,
  label: '마바페이형 간편결제 알림',
  apps: ['payapp'],
  example: '마바페이 결제 완료 12,000원 · 스타벅스 · 10월 15일 12:30',
  parse(text) {
    const m = /^(\S+페이) 결제 ?(완료|취소) ([\d,]+)원 ?· ?(.+?) ?· ?(\d{1,2})월 ?(\d{1,2})일 (\d{1,2}):(\d{2})$/.exec(oneLine(text));
    if (!m) return null;
    return build(m[2], m[3], {
      cardName: m[1], merchant: m[4].trim(), installment: false,
      month: n(m[5]), day: n(m[6]), hour: n(m[7]), minute: n(m[8]),
    });
  },
};

export const FORMAT_RULES: FormatRule[] = [smsCardA, smsCardB, kakaoCardA, payAppA];
```

`src/core/parser/index.ts`:

```ts
import { parseWon } from '../money';
import type { SourceApp } from '../model';
import { FORMAT_RULES } from './formats';
import { classifyNonTx } from './nonTx';
import type { ParseResult } from './types';

export type { ParsedTx, ParseResult, FormatRule, NonTxReason } from './types';
export { FORMAT_RULES } from './formats';

export function parseNotification(text: string, sourceApp: SourceApp): ParseResult {
  const t = text.trim();
  const nonTx = classifyNonTx(t);
  if (nonTx) return { status: 'non_tx', reason: nonTx };

  for (const rule of FORMAT_RULES) {
    if (sourceApp !== 'paste' && !rule.apps.includes(sourceApp)) continue;
    const tx = rule.parse(t);
    if (tx) return { status: 'tx', ruleId: rule.id, ruleVersion: rule.version, tx };
  }
  return fallback(t);
}

function fallback(t: string): ParseResult {
  const hasKeyword = /승인|결제|취소|환불|사용/.test(t);
  const amt = /([\d,]+)\s*원/.exec(t);
  const foreign = /(USD|EUR|JPY|CNY|\$)\s*[\d,.]+|해외/.test(t);
  if (!hasKeyword || (!amt && !foreign)) return { status: 'non_tx', reason: 'not_transaction' };
  return {
    status: 'unsupported',
    ruleId: 'fallback',
    ruleVersion: 1,
    tx: {
      kind: /취소|환불/.test(t) ? 'cancel' : 'approval',
      amount: amt ? parseWon(amt[1]) ?? undefined : undefined,
      installment: /\d+\s*개월/.test(t),
      foreign,
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/core/parser.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): 결제 알림 파서와 비거래 판별"
```

---

### Task 4: 가맹점 정규화·카테고리 추정·결제수단 매핑·거래 시각 결정

**Files:**
- Create: `src/core/merchant.ts`, `src/core/resolve.ts`
- Test: `tests/core/resolve.test.ts`

**Interfaces:**
- Consumes: `toDateKey`, `toTimeKey` (Task 1), `Category`, `PaymentMethod`, `UNCATEGORIZED_ID`, `DATE_UNCERTAIN_MS` (Task 2)
- Produces:
  - `normalizeMerchant(s?: string): string | undefined`
  - `guessCategory(merchant: string | undefined, categories: Category[]): string` — 카테고리 id, 못 찾으면 `UNCATEGORIZED_ID`
  - `matchKeyFor(cardName: string, last4?: string): string`
  - `mapPaymentMethod(methods: PaymentMethod[], cardName?: string, last4?: string): PaymentMethod | undefined`
  - `resolveTxDateTime(p: { month?: number; day?: number; hour?: number; minute?: number }, receivedAt: number): { date: string; time: string; at: number; fromReceipt: boolean; uncertain: boolean }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/core/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeMerchant, guessCategory } from '../../src/core/merchant';
import { mapPaymentMethod, resolveTxDateTime, matchKeyFor } from '../../src/core/resolve';
import type { Category, PaymentMethod } from '../../src/core/model';
import { UNCATEGORIZED_ID } from '../../src/core/model';

const cat = (id: string, name: string, archived = false): Category => ({ id, name, kind: 'expense', sortOrder: 0, archived });
const pm = (id: string, name: string, matchKeys: string[], archived = false): PaymentMethod =>
  ({ id, name, kind: 'card', matchKeys, sortOrder: 0, archived });

describe('merchant', () => {
  it('normalizes spacing, case, corp marks', () => {
    expect(normalizeMerchant('(주) 스타벅스 강남점')).toBe('스타벅스강남점');
    expect(normalizeMerchant('GS25 역삼점')).toBe(normalizeMerchant('gs25역삼점'));
    expect(normalizeMerchant(undefined)).toBeUndefined();
    expect(normalizeMerchant('  ')).toBeUndefined();
  });
  it('guesses category by keyword when category exists', () => {
    const cats = [cat('c1', '카페'), cat('c2', '편의점')];
    expect(guessCategory('스타벅스', cats)).toBe('c1');
    expect(guessCategory('GS25역삼점', cats)).toBe('c2');
    expect(guessCategory('알수없는가게', cats)).toBe(UNCATEGORIZED_ID);
    expect(guessCategory('스타벅스', [cat('c1', '카페', true)])).toBe(UNCATEGORIZED_ID);
    expect(guessCategory(undefined, cats)).toBe(UNCATEGORIZED_ID);
  });
});

describe('mapPaymentMethod', () => {
  const methods = [pm('p1', '가나카드', ['가나카드*1234']), pm('p2', '다라카드', ['다라카드']), pm('p3', '옛카드', ['옛카드'], true)];
  it('prefers name+last4, then name', () => {
    expect(mapPaymentMethod(methods, '가나카드', '1234')?.id).toBe('p1');
    expect(mapPaymentMethod(methods, '가나카드', '9999')).toBeUndefined();
    expect(mapPaymentMethod(methods, '다라카드', '5678')?.id).toBe('p2');
    expect(mapPaymentMethod(methods, '다라 카드')?.id).toBe('p2');
  });
  it('ignores archived and missing name', () => {
    expect(mapPaymentMethod(methods, '옛카드')).toBeUndefined();
    expect(mapPaymentMethod(methods, undefined, '1234')).toBeUndefined();
  });
  it('matchKeyFor', () => {
    expect(matchKeyFor('가나카드', '1234')).toBe('가나카드*1234');
    expect(matchKeyFor('마바페이')).toBe('마바페이');
  });
});

describe('resolveTxDateTime', () => {
  const recv = new Date(2026, 9, 15, 12, 31).getTime();
  it('uses explicit time with receive year', () => {
    expect(resolveTxDateTime({ month: 10, day: 15, hour: 12, minute: 30 }, recv)).toEqual({
      date: '2026-10-15', time: '12:30', at: new Date(2026, 9, 15, 12, 30).getTime(), fromReceipt: false, uncertain: false,
    });
  });
  it('year boundary: 12/31 23:58 received 1/1 00:05 belongs to previous year', () => {
    const r = resolveTxDateTime({ month: 12, day: 31, hour: 23, minute: 58 }, new Date(2027, 0, 1, 0, 5).getTime());
    expect(r.date).toBe('2026-12-31');
    expect(r.uncertain).toBe(false);
  });
  it('falls back to receive time', () => {
    const r = resolveTxDateTime({}, recv);
    expect(r).toMatchObject({ date: '2026-10-15', time: '12:31', fromReceipt: true, uncertain: false });
  });
  it('marks delayed delivery (>24h) uncertain', () => {
    const r = resolveTxDateTime({ month: 10, day: 13, hour: 9, minute: 0 }, recv);
    expect(r.date).toBe('2026-10-13');
    expect(r.uncertain).toBe(true);
  });
  it('invalid date falls back to receive time and is uncertain', () => {
    const r = resolveTxDateTime({ month: 2, day: 30, hour: 1, minute: 0 }, recv);
    expect(r).toMatchObject({ date: '2026-10-15', fromReceipt: true, uncertain: true });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/core/resolve.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`src/core/merchant.ts`:

```ts
import type { Category } from './model';
import { UNCATEGORIZED_ID } from './model';

export function normalizeMerchant(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/[\s\-_.·,()[\]]/g, '');
  return t.length ? t : undefined;
}

const KEYWORDS: Record<string, string[]> = {
  카페: ['스타벅스', '커피', '카페', '이디야', '투썸', '메가mgc', '빽다방', '폴바셋'],
  편의점: ['gs25', 'cu', '세븐일레븐', '이마트24', '미니스톱'],
  식비: ['배달의민족', '요기요', '쿠팡이츠', '김밥', '식당', '맥도날드', '버거킹', '롯데리아'],
  교통: ['택시', '카카오t', '티머니', '코레일', 'srt', '버스', '지하철'],
};

export function guessCategory(merchant: string | undefined, categories: Category[]): string {
  const m = normalizeMerchant(merchant);
  if (!m) return UNCATEGORIZED_ID;
  for (const [name, words] of Object.entries(KEYWORDS)) {
    if (!words.some((w) => m.includes(w))) continue;
    const c = categories.find((x) => x.name === name && x.kind === 'expense' && !x.archived);
    if (c) return c.id;
  }
  return UNCATEGORIZED_ID;
}
```

`src/core/resolve.ts`:

```ts
import { toDateKey, toTimeKey } from './dates';
import type { PaymentMethod } from './model';
import { DATE_UNCERTAIN_MS } from './model';

const squash = (s: string) => s.replace(/\s+/g, '');

export function matchKeyFor(cardName: string, last4?: string): string {
  return last4 ? `${squash(cardName)}*${last4}` : squash(cardName);
}

export function mapPaymentMethod(methods: PaymentMethod[], cardName?: string, last4?: string): PaymentMethod | undefined {
  if (!cardName) return undefined;
  const active = methods.filter((m) => !m.archived);
  const tryKeys = last4 ? [matchKeyFor(cardName, last4), matchKeyFor(cardName)] : [matchKeyFor(cardName)];
  for (const key of tryKeys) {
    const hit = active.find((m) => m.matchKeys.some((k) => squash(k) === key));
    if (hit) return hit;
  }
  return undefined;
}

const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

export function resolveTxDateTime(
  p: { month?: number; day?: number; hour?: number; minute?: number },
  receivedAt: number,
): { date: string; time: string; at: number; fromReceipt: boolean; uncertain: boolean } {
  const fromReceipt = (uncertain: boolean) => {
    const r = new Date(receivedAt);
    return { date: toDateKey(r), time: toTimeKey(r), at: receivedAt, fromReceipt: true, uncertain };
  };
  if (p.month === undefined || p.day === undefined) return fromReceipt(false);

  const year = new Date(receivedAt).getFullYear();
  const build = (y: number) => new Date(y, p.month! - 1, p.day!, p.hour ?? 0, p.minute ?? 0);
  let d = build(year);
  if (d.getMonth() !== p.month - 1 || d.getDate() !== p.day) return fromReceipt(true);
  if (d.getTime() > receivedAt + FUTURE_TOLERANCE_MS) d = build(year - 1);

  return {
    date: toDateKey(d),
    time: toTimeKey(d),
    at: d.getTime(),
    fromReceipt: false,
    uncertain: Math.abs(receivedAt - d.getTime()) > DATE_UNCERTAIN_MS,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/core/resolve.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): 가맹점 정규화, 카테고리 추정, 결제수단 매핑, 거래 시각 결정"
```

---

### Task 5: 중복 판별

**Files:**
- Create: `src/core/dedup.ts`
- Test: `tests/core/dedup.test.ts`

**Interfaces:**
- Consumes: `txAt` (Task 1), `normalizeMerchant` (Task 4), `Transaction`, `Refund`, `NotificationRecord`, `SourceApp`, `DUP_WINDOW_MS` (Task 2)
- Produces:
  - `DupProbe { sourceApp: SourceApp; paymentMethodId?: string; amount?: number; merchant?: string; at: number; approvalNo?: string }`
  - `DupResult = { kind: 'none' } | { kind: 'certain' | 'suspect'; id: string }`
  - `findDuplicateTx(probe: DupProbe, txs: Transaction[], records: NotificationRecord[]): DupResult`
  - `findDuplicateRefund(probe: DupProbe, refunds: Refund[], txs: Transaction[], records: NotificationRecord[]): string | undefined` — 확실히 같은 환불의 id

규칙: 비교 대상은 **알림 출처가 연결된** 지출 거래 중 출처 앱이 probe와 **다른** 것만. 같은 출처 앱의 다른 알림 키는 실제 연속 결제로 본다. 금액이 같고 시각 차 ≤ 2분이어야 후보. 승인번호가 양쪽에 있고 다르면 다른 결제. 결제수단·가맹점(정규화)이 모두 일치하면 `certain`, 아니면 `suspect`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/core/dedup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findDuplicateTx, findDuplicateRefund } from '../../src/core/dedup';
import type { NotificationRecord, Refund, Transaction } from '../../src/core/model';

const at = (h: number, m: number) => new Date(2026, 9, 15, h, m).getTime();
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1', type: 'expense', amount: 12000, date: '2026-10-15', time: '12:30', merchant: '스타벅스',
  categoryId: 'c', paymentMethodId: 'p1', recordMethod: 'auto', dateFromReceipt: false, userEdited: false,
  createdAt: 1, updatedAt: 1, ...over,
});
const rec = (over: Partial<NotificationRecord>): NotificationRecord => ({
  id: 'r1', sourceApp: 'sms', notificationKey: 'k1', receivedAt: 1, ruleId: 'x', ruleVersion: 1, outcome: 'saved', ...over,
});
const probe = { sourceApp: 'kakaotalk' as const, paymentMethodId: 'p1', amount: 12000, merchant: '스타벅스', at: at(12, 30) };

describe('findDuplicateTx', () => {
  const records = [rec({ linkedTxId: 't1' })];
  it('certain when other app reports same payment', () => {
    expect(findDuplicateTx(probe, [tx()], records)).toEqual({ kind: 'certain', id: 't1' });
  });
  it('certain within 2 minutes and merchant spacing differences', () => {
    expect(findDuplicateTx({ ...probe, at: at(12, 32), merchant: '스타 벅스' }, [tx()], records).kind).toBe('certain');
  });
  it('none beyond 2 minutes', () => {
    expect(findDuplicateTx({ ...probe, at: at(12, 33) }, [tx()], records).kind).toBe('none');
  });
  it('same source app is never a duplicate (real repeated payment)', () => {
    expect(findDuplicateTx({ ...probe, sourceApp: 'sms' }, [tx()], records).kind).toBe('none');
  });
  it('different approval numbers are different payments', () => {
    expect(findDuplicateTx({ ...probe, approvalNo: '2' }, [tx({ approvalNo: '1' })], records).kind).toBe('none');
  });
  it('suspect when merchant or method unknown', () => {
    expect(findDuplicateTx({ ...probe, merchant: undefined }, [tx()], records)).toEqual({ kind: 'suspect', id: 't1' });
    expect(findDuplicateTx({ ...probe, paymentMethodId: undefined }, [tx()], records).kind).toBe('suspect');
  });
  it('ignores manual transactions and different amounts', () => {
    expect(findDuplicateTx(probe, [tx({ recordMethod: 'manual' })], []).kind).toBe('none');
    expect(findDuplicateTx({ ...probe, amount: 12001 }, [tx()], records).kind).toBe('none');
    expect(findDuplicateTx({ ...probe, amount: undefined }, [tx()], records).kind).toBe('none');
  });
  it('prefers certain over suspect', () => {
    const txs = [tx({ id: 'a', merchant: '다른곳' }), tx({ id: 'b' })];
    const recs = [rec({ id: 'r1', linkedTxId: 'a' }), rec({ id: 'r2', notificationKey: 'k2', linkedTxId: 'b' })];
    expect(findDuplicateTx(probe, txs, recs)).toEqual({ kind: 'certain', id: 'b' });
  });
});

describe('findDuplicateRefund', () => {
  const refund: Refund = { id: 'f1', originalTxId: 't1', amount: 12000, date: '2026-10-15', time: '13:10', createdAt: 1 };
  const records = [rec({ linkedTxId: 't1' }), rec({ id: 'r2', notificationKey: 'k2', outcome: 'refund_linked', linkedRefundId: 'f1' })];
  const p = { ...probe, at: at(13, 10) };
  it('finds refund reported by another app', () => {
    expect(findDuplicateRefund(p, [refund], [tx()], records)).toBe('f1');
  });
  it('same app or different amount is not a duplicate', () => {
    expect(findDuplicateRefund({ ...p, sourceApp: 'sms' }, [refund], [tx()], records)).toBeUndefined();
    expect(findDuplicateRefund({ ...p, amount: 5000 }, [refund], [tx()], records)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/core/dedup.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/core/dedup.ts`:

```ts
import { txAt } from './dates';
import { normalizeMerchant } from './merchant';
import type { NotificationRecord, Refund, SourceApp, Transaction } from './model';
import { DUP_WINDOW_MS } from './model';

export interface DupProbe {
  sourceApp: SourceApp;
  paymentMethodId?: string;
  amount?: number;
  merchant?: string;
  at: number;
  approvalNo?: string;
}

export type DupResult = { kind: 'none' } | { kind: 'certain' | 'suspect'; id: string };

function sourcesBy(records: NotificationRecord[], key: 'linkedTxId' | 'linkedRefundId') {
  const map = new Map<string, Set<SourceApp>>();
  for (const r of records) {
    const id = r[key];
    if (!id) continue;
    if (!map.has(id)) map.set(id, new Set());
    map.get(id)!.add(r.sourceApp);
  }
  return map;
}

export function findDuplicateTx(probe: DupProbe, txs: Transaction[], records: NotificationRecord[]): DupResult {
  if (probe.amount === undefined) return { kind: 'none' };
  const sources = sourcesBy(records, 'linkedTxId');
  const pMerchant = normalizeMerchant(probe.merchant);
  let suspect: string | undefined;

  for (const t of txs) {
    const apps = sources.get(t.id);
    if (!apps || apps.has(probe.sourceApp)) continue;
    if (t.type !== 'expense' || t.amount !== probe.amount) continue;
    if (Math.abs(txAt(t.date, t.time) - probe.at) > DUP_WINDOW_MS) continue;
    if (probe.approvalNo && t.approvalNo && probe.approvalNo !== t.approvalNo) continue;

    const tMerchant = normalizeMerchant(t.merchant);
    const sameMethod = probe.paymentMethodId !== undefined && probe.paymentMethodId === t.paymentMethodId;
    const sameMerchant = pMerchant !== undefined && pMerchant === tMerchant;
    if (sameMethod && sameMerchant) return { kind: 'certain', id: t.id };
    suspect ??= t.id;
  }
  return suspect ? { kind: 'suspect', id: suspect } : { kind: 'none' };
}

export function findDuplicateRefund(
  probe: DupProbe, refunds: Refund[], txs: Transaction[], records: NotificationRecord[],
): string | undefined {
  if (probe.amount === undefined || probe.paymentMethodId === undefined) return undefined;
  const sources = sourcesBy(records, 'linkedRefundId');
  const pMerchant = normalizeMerchant(probe.merchant);
  const txById = new Map(txs.map((t) => [t.id, t]));

  return refunds.find((f) => {
    const apps = sources.get(f.id);
    if (!apps || apps.has(probe.sourceApp)) return false;
    const orig = txById.get(f.originalTxId);
    return (
      orig !== undefined &&
      f.amount === probe.amount &&
      orig.paymentMethodId === probe.paymentMethodId &&
      normalizeMerchant(orig.merchant) === pMerchant &&
      Math.abs(txAt(f.date, f.time) - probe.at) <= DUP_WINDOW_MS
    );
  })?.id;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/core/dedup.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): 교차 출처 중복 판별"
```

---

### Task 6: 환불 원거래 매칭

**Files:**
- Create: `src/core/refund.ts`
- Test: `tests/core/refund.test.ts`

**Interfaces:**
- Consumes: `txAt` (Task 1), `normalizeMerchant` (Task 4), `REFUND_LOOKBACK_MS`, `DUP_WINDOW_MS` (Task 2)
- Produces:
  - `refundableAmount(tx: Transaction, refunds: Refund[]): number`
  - `RefundMatch = { kind: 'one'; txId: string } | { kind: 'none' } | { kind: 'many' | 'exceeds'; txIds: string[] }`
  - `matchRefund(probe: { paymentMethodId: string; merchant?: string; amount: number; at: number }, txs: Transaction[], refunds: Refund[]): RefundMatch`

규칙: 같은 결제수단, 같은 가맹점(정규화, 가맹점이 없으면 후보 없음), 원거래 시각이 환불 시각 이전(2분 허용)이고 90일 이내인 지출 거래가 후보. 잔여 환불 가능액 ≥ 환불액인 후보가 1건이면 `one`, 2건 이상이면 `many`, 0건인데 후보 자체는 있으면 `exceeds`, 후보가 없으면 `none`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/core/refund.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchRefund, refundableAmount } from '../../src/core/refund';
import type { Refund, Transaction } from '../../src/core/model';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1', type: 'expense', amount: 30000, date: '2026-10-15', time: '12:30', merchant: '스타벅스',
  categoryId: 'c', paymentMethodId: 'p1', recordMethod: 'auto', dateFromReceipt: false, userEdited: false,
  createdAt: 1, updatedAt: 1, ...over,
});
const refund = (amount: number, id = 'f'): Refund => ({ id, originalTxId: 't1', amount, date: '2026-10-16', createdAt: 1 });
const probe = { paymentMethodId: 'p1', merchant: '스타벅스', amount: 10000, at: new Date(2026, 9, 16, 9, 0).getTime() };

describe('refund', () => {
  it('refundableAmount subtracts linked refunds', () => {
    expect(refundableAmount(tx(), [refund(10000), refund(5000, 'g')])).toBe(15000);
  });
  it('one when a single original fits', () => {
    expect(matchRefund(probe, [tx()], [])).toEqual({ kind: 'one', txId: 't1' });
  });
  it('partial refunds accumulate then exceed', () => {
    expect(matchRefund({ ...probe, amount: 20000 }, [tx()], [refund(10000)])).toEqual({ kind: 'one', txId: 't1' });
    expect(matchRefund({ ...probe, amount: 25000 }, [tx()], [refund(10000)])).toEqual({ kind: 'exceeds', txIds: ['t1'] });
  });
  it('none when nothing matches method, merchant or window', () => {
    expect(matchRefund({ ...probe, paymentMethodId: 'p2' }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, merchant: '이디야' }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, merchant: undefined }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, at: new Date(2027, 0, 20).getTime() }, [tx()], []).kind).toBe('none');
    expect(matchRefund({ ...probe, at: new Date(2026, 9, 14).getTime() }, [tx()], []).kind).toBe('none');
  });
  it('many when several originals fit', () => {
    expect(matchRefund(probe, [tx(), tx({ id: 't2', time: '15:00' })], [])).toEqual({ kind: 'many', txIds: ['t1', 't2'] });
  });
  it('ignores income and transfer', () => {
    expect(matchRefund(probe, [tx({ type: 'income' })], []).kind).toBe('none');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/core/refund.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/core/refund.ts`:

```ts
import { txAt } from './dates';
import { normalizeMerchant } from './merchant';
import type { Refund, Transaction } from './model';
import { DUP_WINDOW_MS, REFUND_LOOKBACK_MS } from './model';

export function refundableAmount(tx: Transaction, refunds: Refund[]): number {
  const used = refunds.filter((r) => r.originalTxId === tx.id).reduce((s, r) => s + r.amount, 0);
  return tx.amount - used;
}

export type RefundMatch =
  | { kind: 'one'; txId: string }
  | { kind: 'none' }
  | { kind: 'many' | 'exceeds'; txIds: string[] };

export function matchRefund(
  probe: { paymentMethodId: string; merchant?: string; amount: number; at: number },
  txs: Transaction[],
  refunds: Refund[],
): RefundMatch {
  const merchant = normalizeMerchant(probe.merchant);
  if (!merchant) return { kind: 'none' };

  const pool = txs.filter((t) => {
    if (t.type !== 'expense' || t.paymentMethodId !== probe.paymentMethodId) return false;
    if (normalizeMerchant(t.merchant) !== merchant) return false;
    const diff = probe.at - txAt(t.date, t.time);
    return diff >= -DUP_WINDOW_MS && diff <= REFUND_LOOKBACK_MS;
  });
  if (pool.length === 0) return { kind: 'none' };

  const fit = pool.filter((t) => refundableAmount(t, refunds) >= probe.amount);
  if (fit.length === 1) return { kind: 'one', txId: fit[0].id };
  if (fit.length > 1) return { kind: 'many', txIds: fit.map((t) => t.id) };
  return { kind: 'exceeds', txIds: pool.map((t) => t.id) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/core/refund.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): 취소·환불 원거래 매칭"
```

---

### Task 7: 처리 파이프라인 `ingestNotification`

**Files:**
- Create: `src/core/deps.ts`, `src/core/pipeline/ingest.ts`
- Test: `tests/core/fixtures.ts`, `tests/core/ingest.test.ts`

**Interfaces:**
- Consumes: Task 1~6 전부 (`parseNotification`, `mapPaymentMethod`, `resolveTxDateTime`, `guessCategory`, `findDuplicateTx`, `findDuplicateRefund`, `matchRefund`, `Repo`)
- Produces:
  - `Deps { repo: Repo; now: () => number; newId: () => string; encrypt: (plain: string) => Promise<string> }`
  - `IngestOutcome = RecordOutcome | 'dropped' | 'already_processed'`
  - `IngestResult { outcome: IngestOutcome; recordId?: string; txId?: string; candidateId?: string; refundId?: string }`
  - `ingestNotification(input: NotificationInput, deps: Deps, opts?: { paste?: boolean }): Promise<IngestResult>`
  - `ingestSafely(input, deps, opts?): Promise<IngestResult | { outcome: 'queued' }>` — 예외 시 대기 큐에 보관
  - `drainPending(deps: Deps): Promise<number>` — 대기 큐 재처리, 성공 건수 반환
  - 테스트 픽스처 `setup(overrides?)`, 샘플 문구 상수 (Task 8에서도 사용)

- [ ] **Step 1: 테스트 픽스처 작성**

`tests/core/fixtures.ts`:

```ts
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Deps } from '../../src/core/deps';
import type { AutoRecordSettings, NotificationInput, SourceApp } from '../../src/core/model';
import { DEFAULT_AUTO_SETTINGS, UNCATEGORIZED_ID } from '../../src/core/model';

export const T = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).getTime();

export const SMS_OK = '[Web발신]\n가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스 누적 345,000원';
export const KAKAO_OK = '가나카드 결제 승인\n금액: 12,000원\n가맹점: 스타벅스\n일시: 10/15 12:30\n카드: 가나(1234)';
export const SMS_CANCEL = '[Web발신]\n가나카드(1234)취소 홍*동 12,000원 10/15 13:10 스타벅스';
export const KAKAO_CANCEL = '가나카드 결제 취소\n금액: 12,000원\n가맹점: 스타벅스\n일시: 10/15 13:10\n카드: 가나(1234)';

export const smsAmount = (amount: string, verb = '승인', time = '12:30') =>
  `[Web발신]\n가나카드(1234)${verb} 홍*동 ${amount}원 10/15 ${time} 스타벅스`;

export async function setup(auto: Partial<AutoRecordSettings> = {}) {
  const repo = createMemoryRepo();
  let seq = 0;
  const deps: Deps = {
    repo,
    now: () => T(15, 13, 0),
    newId: () => `id${++seq}`,
    encrypt: async (s) => `enc(${s.length})`,
  };
  await repo.commit({
    categories: [
      { id: UNCATEGORIZED_ID, name: '미분류', kind: 'expense', sortOrder: 99, archived: false },
      { id: 'cat-cafe', name: '카페', kind: 'expense', sortOrder: 1, archived: false },
      { id: 'cat-food', name: '식비', kind: 'expense', sortOrder: 0, archived: false },
    ],
    paymentMethods: [
      { id: 'pm-cash', name: '현금', kind: 'cash', matchKeys: [], sortOrder: 0, archived: false },
      { id: 'pm-gana', name: '가나카드', kind: 'card', matchKeys: ['가나카드*1234'], sortOrder: 1, archived: false },
      { id: 'pm-mabapay', name: '마바페이', kind: 'pay', matchKeys: ['마바페이'], sortOrder: 2, archived: false },
    ],
    autoSettings: {
      ...DEFAULT_AUTO_SETTINGS,
      enabled: true,
      permission: 'granted',
      allowedSources: [{ app: 'sms' }, { app: 'kakaotalk' }],
      ...auto,
    },
  });
  return { repo, deps };
}

let keySeq = 0;
export const input = (sourceApp: SourceApp, text: string, receivedAt = T(15, 12, 31), notificationKey = `k${++keySeq}`): NotificationInput =>
  ({ sourceApp, text, receivedAt, notificationKey });
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/core/ingest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ingestNotification, ingestSafely, drainPending } from '../../src/core/pipeline/ingest';
import { setup, input, SMS_OK, KAKAO_OK, SMS_CANCEL, KAKAO_CANCEL, smsAmount, T } from './fixtures';
import { UNCATEGORIZED_ID } from '../../src/core/model';

describe('ingestNotification — approvals', () => {
  it('auto-saves a clear supported approval', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', SMS_OK), deps);
    expect(r.outcome).toBe('saved');
    const [t] = await repo.listTransactions();
    expect(t).toMatchObject({
      type: 'expense', amount: 12000, merchant: '스타벅스', paymentMethodId: 'pm-gana', categoryId: 'cat-cafe',
      date: '2026-10-15', time: '12:30', recordMethod: 'auto', dateFromReceipt: false, userEdited: false,
    });
    expect((await repo.getAutoSettings()).lastProcessedAt).toBe(T(15, 13, 0));
  });

  it('sms + kakao for the same payment become one transaction with two sources', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const b = await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    expect(b).toMatchObject({ outcome: 'merged', txId: a.txId });
    expect(await repo.listTransactions()).toHaveLength(1);
    expect((await repo.listRecords()).filter((x) => x.linkedTxId === a.txId)).toHaveLength(2);
  });

  it('re-delivery or update of the same notification key is processed once', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK, T(15, 12, 31), 'same'), deps);
    const again = await ingestNotification(input('sms', SMS_OK + ' ', T(15, 12, 35), 'same'), deps);
    expect(again.outcome).toBe('already_processed');
    expect(await repo.listTransactions()).toHaveLength(1);
  });

  it('two real payments of the same amount from the same app are both saved', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('sms', SMS_OK), deps);
    expect(await repo.listTransactions()).toHaveLength(2);
  });

  it('ambiguous cross-app match goes to inbox as duplicate suspect', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('kakaotalk', KAKAO_OK.replace('가맹점: 스타벅스\n', '')), deps);
    expect(r.outcome).toBe('candidate');
    const c = await repo.getCandidate(r.candidateId!);
    expect(c).toMatchObject({ reasons: ['duplicate_suspect'], duplicateOfTxId: a.txId, status: 'pending', encryptedExcerpt: expect.stringMatching(/^enc/) });
    expect(c!.expiresAt - c!.createdAt).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('non-transaction notifications are ignored but recorded', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', '[가나카드] 인증번호 [123456]'), deps);
    expect(r.outcome).toBe('ignored_non_tx');
    expect(await repo.listTransactions()).toHaveLength(0);
    expect(await repo.listCandidates()).toHaveLength(0);
  });

  it('drops sources not allowed, disabled feature, or missing permission without any record', async () => {
    const pay = '마바페이 결제 완료 12,000원 · 스타벅스 · 10월 15일 12:30';
    let s = await setup();
    expect((await ingestNotification(input('payapp', pay), s.deps)).outcome).toBe('dropped');
    s = await setup({ enabled: false });
    expect((await ingestNotification(input('sms', SMS_OK), s.deps)).outcome).toBe('dropped');
    s = await setup({ permission: 'revoked' });
    expect((await ingestNotification(input('sms', SMS_OK), s.deps)).outcome).toBe('dropped');
    expect(await s.repo.listRecords()).toHaveLength(0);
  });

  it('sender filter applies when set', async () => {
    const { deps } = await setup({ allowedSources: [{ app: 'sms', sender: '15881688' }] });
    expect((await ingestNotification({ ...input('sms', SMS_OK), sender: '0000' }, deps)).outcome).toBe('dropped');
    expect((await ingestNotification({ ...input('sms', SMS_OK), sender: '15881688' }, deps)).outcome).toBe('saved');
  });

  it('review_all mode sends clear approvals to inbox', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    const r = await ingestNotification(input('sms', SMS_OK), deps);
    expect(r.outcome).toBe('candidate');
    expect((await repo.getCandidate(r.candidateId!))!.reasons).toEqual(['review_mode']);
    expect(await repo.listTransactions()).toHaveLength(0);
  });

  it('installment, unknown card, unsupported format and delayed delivery go to inbox', async () => {
    const { repo, deps } = await setup();
    const inst = await ingestNotification(input('sms', SMS_OK.replace('일시불', '3개월')), deps);
    const unknownCard = await ingestNotification(input('sms', SMS_OK.replace('1234', '9999')), deps);
    const unsupported = await ingestNotification(input('sms', '라마카드 사용 23,000원 올리브영'), deps);
    const delayed = await ingestNotification(input('sms', SMS_OK, T(17, 12, 31)), deps);
    const reasons = async (id?: string) => (await repo.getCandidate(id!))!.reasons;
    expect(await reasons(inst.candidateId)).toEqual(['unsupported_format']);
    expect(await reasons(unknownCard.candidateId)).toEqual(['missing_field']);
    expect(await reasons(unsupported.candidateId)).toEqual(['unsupported_format', 'missing_field']);
    expect(await reasons(delayed.candidateId)).toEqual(['date_uncertain']);
    expect(await repo.listTransactions()).toHaveLength(0);
  });

  it('unknown merchant category saves as 미분류', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK.replace('스타벅스', '동네철물점')), deps);
    expect((await repo.listTransactions())[0].categoryId).toBe(UNCATEGORIZED_ID);
  });

  it('paste always goes to inbox even when clear, and bypasses allow-list', async () => {
    const { repo, deps } = await setup({ enabled: false });
    const r = await ingestNotification(input('paste', SMS_OK), deps, { paste: true });
    expect(r.outcome).toBe('candidate');
    expect((await repo.getCandidate(r.candidateId!))!.reasons).toEqual(['review_mode']);
    expect((await repo.getAutoSettings()).lastProcessedAt).toBeUndefined();
  });
});

describe('ingestNotification — cancels and refunds', () => {
  it('full cancel links to the original', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const c = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    expect(c.outcome).toBe('refund_linked');
    expect(await repo.listRefunds()).toEqual([expect.objectContaining({ originalTxId: a.txId, amount: 12000, date: '2026-10-15', time: '13:10' })]);
  });

  it('the same cancel via sms and kakao is applied once', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    const c1 = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const c2 = await ingestNotification(input('kakaotalk', KAKAO_CANCEL, T(15, 13, 11)), deps);
    expect(c2).toMatchObject({ outcome: 'merged', refundId: c1.refundId });
    expect(await repo.listRefunds()).toHaveLength(1);
  });

  it('partial refunds accumulate; exceeding goes to inbox', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', smsAmount('30,000')), deps);
    expect((await ingestNotification(input('sms', smsAmount('10,000', '취소', '14:00'), T(15, 14, 1)), deps)).outcome).toBe('refund_linked');
    const over = await ingestNotification(input('sms', smsAmount('25,000', '취소', '15:00'), T(15, 15, 1)), deps);
    expect(over.outcome).toBe('candidate');
    expect(await repo.getCandidate(over.candidateId!)).toMatchObject({ reasons: ['refund_exceeds'], refundCandidateTxIds: [a.txId] });
    expect(await repo.listRefunds()).toHaveLength(1);
  });

  it('cancel without original goes to inbox', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    expect((await repo.getCandidate(r.candidateId!))!.reasons).toEqual(['refund_unmatched']);
  });

  it('cancel with several possible originals goes to inbox', async () => {
    const { repo, deps } = await setup();
    await ingestNotification(input('sms', SMS_OK), deps);
    await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const c = await repo.getCandidate(r.candidateId!);
    expect(c!.reasons).toEqual(['refund_ambiguous']);
    expect(c!.refundCandidateTxIds).toHaveLength(2);
  });
});

describe('failure handling', () => {
  it('queues the input when storage fails and drains later', async () => {
    const { repo, deps } = await setup();
    const realCommit = repo.commit;
    repo.commit = async () => { throw new Error('disk full'); };
    expect(await ingestSafely(input('sms', SMS_OK), deps)).toEqual({ outcome: 'queued' });
    repo.commit = realCommit;
    expect(await repo.listPending()).toHaveLength(1);
    expect(await drainPending(deps)).toBe(1);
    expect(await repo.listPending()).toHaveLength(0);
    expect(await repo.listTransactions()).toHaveLength(1);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/core/ingest.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: 구현**

`src/core/deps.ts`:

```ts
import type { Repo } from './repo';

export interface Deps {
  repo: Repo;
  now: () => number;
  newId: () => string;
  /** 확인함 발췌 암호화. 반환값은 저장 가능한 문자열. */
  encrypt: (plain: string) => Promise<string>;
}
```

`src/core/pipeline/ingest.ts`:

```ts
import type { Deps } from '../deps';
import { findDuplicateRefund, findDuplicateTx } from '../dedup';
import { guessCategory } from '../merchant';
import type {
  AllowedSource, Candidate, CandidateFields, CandidateReason, NotificationInput,
  NotificationRecord, RecordOutcome, Refund, Transaction,
} from '../model';
import { CANDIDATE_TTL_MS } from '../model';
import { parseNotification } from '../parser';
import { matchRefund } from '../refund';
import { mapPaymentMethod, resolveTxDateTime } from '../resolve';

export type IngestOutcome = RecordOutcome | 'dropped' | 'already_processed';

export interface IngestResult {
  outcome: IngestOutcome;
  recordId?: string;
  txId?: string;
  candidateId?: string;
  refundId?: string;
}

const EXCERPT_MAX = 200;

function isAllowed(allowed: AllowedSource[], input: NotificationInput): boolean {
  return allowed.some((s) => s.app === input.sourceApp && (!s.sender || s.sender === input.sender));
}

export async function ingestNotification(
  input: NotificationInput,
  deps: Deps,
  opts: { paste?: boolean } = {},
): Promise<IngestResult> {
  const { repo, now, newId } = deps;
  const paste = opts.paste === true;
  const settings = await repo.getAutoSettings();

  if (!paste) {
    if (!settings.enabled || settings.permission !== 'granted' || !isAllowed(settings.allowedSources, input)) {
      return { outcome: 'dropped' };
    }
    const existing = await repo.findRecord(input.sourceApp, input.notificationKey);
    if (existing) {
      return {
        outcome: 'already_processed', recordId: existing.id, txId: existing.linkedTxId,
        candidateId: existing.linkedCandidateId, refundId: existing.linkedRefundId,
      };
    }
  }
  const touchedSettings = paste ? undefined : { ...settings, lastProcessedAt: now() };

  const parsed = parseNotification(input.text, input.sourceApp);
  const record: NotificationRecord = {
    id: newId(),
    sourceApp: input.sourceApp,
    notificationKey: input.notificationKey,
    receivedAt: input.receivedAt,
    ruleId: parsed.status === 'non_tx' ? 'non_tx' : parsed.ruleId,
    ruleVersion: parsed.status === 'non_tx' ? 0 : parsed.ruleVersion,
    outcome: 'ignored_non_tx',
  };
  if (parsed.status === 'non_tx') {
    await repo.commit({ records: [record], autoSettings: touchedSettings });
    return { outcome: 'ignored_non_tx', recordId: record.id };
  }

  const p = parsed.tx;
  const [methods, categories, txs, refunds, records] = await Promise.all([
    repo.listPaymentMethods(), repo.listCategories(), repo.listTransactions(), repo.listRefunds(), repo.listRecords(),
  ]);
  const pm = mapPaymentMethod(methods, p.cardName, p.cardLast4);
  const dt = resolveTxDateTime(p, input.receivedAt);

  const reasons = new Set<CandidateReason>();
  if (parsed.status === 'unsupported' || p.installment || p.foreign) reasons.add('unsupported_format');
  if (p.amount === undefined || !pm) reasons.add('missing_field');
  if (dt.uncertain) reasons.add('date_uncertain');

  const fields: CandidateFields = {
    kind: p.kind,
    amount: p.amount,
    merchant: p.merchant,
    cardName: p.cardName,
    cardLast4: p.cardLast4,
    paymentMethodId: pm?.id,
    categoryId: p.kind === 'approval' ? guessCategory(p.merchant, categories) : undefined,
    date: dt.date,
    time: dt.time,
    dateFromReceipt: dt.fromReceipt,
    approvalNo: p.approvalNo,
    installment: p.installment,
    foreign: p.foreign,
  };
  const canAutoSave = () => reasons.size === 0 && settings.saveMode === 'auto' && !paste;
  const probe = {
    sourceApp: input.sourceApp, paymentMethodId: pm?.id, amount: p.amount,
    merchant: p.merchant, at: dt.at, approvalNo: p.approvalNo,
  };
  let duplicateOfTxId: string | undefined;
  let refundCandidateTxIds: string[] | undefined;

  if (p.kind === 'approval') {
    const dup = findDuplicateTx(probe, txs, records);
    if (dup.kind === 'certain') {
      record.outcome = 'merged';
      record.linkedTxId = dup.id;
      await repo.commit({ records: [record], autoSettings: touchedSettings });
      return { outcome: 'merged', recordId: record.id, txId: dup.id };
    }
    if (dup.kind === 'suspect') {
      reasons.add('duplicate_suspect');
      duplicateOfTxId = dup.id;
    }
    if (canAutoSave()) {
      const t = now();
      const tx: Transaction = {
        id: newId(), type: 'expense', amount: p.amount!, date: dt.date, time: dt.time, merchant: p.merchant,
        categoryId: fields.categoryId!, paymentMethodId: pm!.id, recordMethod: 'auto',
        dateFromReceipt: dt.fromReceipt, userEdited: false, approvalNo: p.approvalNo, createdAt: t, updatedAt: t,
      };
      record.outcome = 'saved';
      record.linkedTxId = tx.id;
      await repo.commit({ transactions: [tx], records: [record], autoSettings: touchedSettings });
      return { outcome: 'saved', recordId: record.id, txId: tx.id };
    }
  } else if (pm && p.amount !== undefined) {
    const amount = p.amount;
    const dupRefundId = findDuplicateRefund(probe, refunds, txs, records);
    if (dupRefundId) {
      record.outcome = 'merged';
      record.linkedRefundId = dupRefundId;
      await repo.commit({ records: [record], autoSettings: touchedSettings });
      return { outcome: 'merged', recordId: record.id, refundId: dupRefundId };
    }
    const m = matchRefund({ paymentMethodId: pm.id, merchant: p.merchant, amount, at: dt.at }, txs, refunds);
    if (m.kind === 'one') {
      refundCandidateTxIds = [m.txId];
      if (canAutoSave()) {
        const refund: Refund = { id: newId(), originalTxId: m.txId, amount, date: dt.date, time: dt.time, createdAt: now() };
        record.outcome = 'refund_linked';
        record.linkedRefundId = refund.id;
        await repo.commit({ refunds: [refund], records: [record], autoSettings: touchedSettings });
        return { outcome: 'refund_linked', recordId: record.id, refundId: refund.id };
      }
    } else if (m.kind === 'none') {
      reasons.add('refund_unmatched');
    } else {
      reasons.add(m.kind === 'many' ? 'refund_ambiguous' : 'refund_exceeds');
      refundCandidateTxIds = m.txIds;
    }
  }

  if (reasons.size === 0) reasons.add('review_mode');
  const createdAt = now();
  const candidate: Candidate = {
    id: newId(),
    fields,
    reasons: [...reasons],
    duplicateOfTxId,
    refundCandidateTxIds,
    encryptedExcerpt: await deps.encrypt(input.text.trim().slice(0, EXCERPT_MAX)),
    status: 'pending',
    sourceRecordId: record.id,
    sourceApp: input.sourceApp,
    createdAt,
    expiresAt: createdAt + CANDIDATE_TTL_MS,
  };
  record.outcome = 'candidate';
  record.linkedCandidateId = candidate.id;
  await repo.commit({ candidates: [candidate], records: [record], autoSettings: touchedSettings });
  return { outcome: 'candidate', recordId: record.id, candidateId: candidate.id };
}

export async function ingestSafely(
  input: NotificationInput,
  deps: Deps,
  opts: { paste?: boolean } = {},
): Promise<IngestResult | { outcome: 'queued' }> {
  try {
    return await ingestNotification(input, deps, opts);
  } catch (e) {
    // 금융 정보 없이 오류 종류만 남긴다.
    console.warn('ingest_failed', e instanceof Error ? e.name : 'unknown');
    await deps.repo.enqueuePending({ id: deps.newId(), input, paste: opts.paste === true, createdAt: deps.now() });
    return { outcome: 'queued' };
  }
}

export async function drainPending(deps: Deps): Promise<number> {
  let done = 0;
  for (const item of await deps.repo.listPending()) {
    try {
      await ingestNotification(item.input, deps, { paste: item.paste });
      await deps.repo.removePending(item.id);
      done++;
    } catch (e) {
      console.warn('drain_failed', e instanceof Error ? e.name : 'unknown');
    }
  }
  return done;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/core && npx tsc --noEmit`
Expected: PASS (이전 테스트 포함 전부)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): 알림 처리 파이프라인과 대기 큐"
```

---

### Task 8: 거래·확인함 동작 (actions)

**Files:**
- Create: `src/core/actions.ts`
- Test: `tests/core/actions.test.ts`

**Interfaces:**
- Consumes: `Deps` (Task 7), `refundableAmount` (Task 6), `matchKeyFor` (Task 4), 픽스처 (Task 7)
- Produces:
  - `TxInput { type: TxType; amount: number; date: string; time?: string; merchant?: string; categoryId: string; paymentMethodId: string; toPaymentMethodId?: string; memo?: string }`
  - `validateTxInput(i: TxInput): string | null` — 오류 문구(한국어) 또는 null
  - `saveManualTransaction(i: TxInput, deps: Deps): Promise<Transaction>`
  - `updateTransaction(id: string, i: TxInput, deps: Deps): Promise<Transaction>`
  - `DeletedSnapshot { tx: Transaction; refunds: Refund[]; records: NotificationRecord[] }`
  - `deleteTransaction(id: string, deps: Deps): Promise<DeletedSnapshot>`
  - `restoreTransaction(s: DeletedSnapshot, deps: Deps): Promise<void>`
  - `confirmCandidate(id: string, i: TxInput, deps: Deps): Promise<Transaction>` — 승인 후보 저장
  - `mergeCandidate(id: string, deps: Deps): Promise<void>` — 중복 후보를 기존 거래 출처로 합침
  - `linkCandidateRefund(id: string, originalTxId: string, amount: number, date: string, deps: Deps): Promise<Refund>` — 초과 시 `Error('환불액이 남은 결제 금액보다 커요')`
  - `ignoreCandidate(id: string, deps: Deps): Promise<void>`
  - `purgeExpiredCandidates(deps: Deps): Promise<number>`
  - `candidateToInput(c: Candidate): Partial<TxInput>` — 확인함 편집 폼 초기값

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/core/actions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateTxInput, saveManualTransaction, updateTransaction, deleteTransaction, restoreTransaction,
  confirmCandidate, mergeCandidate, linkCandidateRefund, ignoreCandidate, purgeExpiredCandidates, candidateToInput,
  type TxInput,
} from '../../src/core/actions';
import { ingestNotification } from '../../src/core/pipeline/ingest';
import { setup, input, SMS_OK, KAKAO_OK, SMS_CANCEL, T } from './fixtures';

const base: TxInput = { type: 'expense', amount: 5000, date: '2026-10-15', time: '09:00', categoryId: 'cat-food', paymentMethodId: 'pm-cash' };

describe('manual transactions', () => {
  it('validates input', () => {
    expect(validateTxInput(base)).toBeNull();
    expect(validateTxInput({ ...base, amount: 0 })).toBe('금액을 1원 이상 입력하세요');
    expect(validateTxInput({ ...base, amount: 1.5 })).toBe('금액을 1원 이상 입력하세요');
    expect(validateTxInput({ ...base, date: '2026-13-01' })).toBe('날짜를 확인하세요');
    expect(validateTxInput({ ...base, categoryId: '' })).toBe('카테고리를 선택하세요');
    expect(validateTxInput({ ...base, paymentMethodId: '' })).toBe('결제수단을 선택하세요');
    expect(validateTxInput({ ...base, type: 'transfer', categoryId: '', toPaymentMethodId: 'pm-cash' })).toBe('출발·도착 수단을 다르게 선택하세요');
    expect(validateTxInput({ ...base, type: 'transfer', categoryId: '', toPaymentMethodId: 'pm-gana' })).toBeNull();
  });
  it('saves manual and rejects invalid', async () => {
    const { repo, deps } = await setup();
    const t = await saveManualTransaction({ ...base, memo: '  점심  ' }, deps);
    expect(t).toMatchObject({ recordMethod: 'manual', userEdited: false, memo: '점심' });
    await expect(saveManualTransaction({ ...base, amount: -1 }, deps)).rejects.toThrow('금액');
    expect(await repo.listTransactions()).toHaveLength(1);
  });
  it('editing an auto transaction marks userEdited and later notifications do not overwrite', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const edited = await updateTransaction(a.txId!, { ...base, amount: 12000, merchant: '스타벅스', paymentMethodId: 'pm-gana', date: '2026-10-15', time: '12:30', categoryId: 'cat-food', memo: '회의' }, deps);
    expect(edited.userEdited).toBe(true);
    const b = await ingestNotification(input('kakaotalk', KAKAO_OK, T(15, 12, 32)), deps);
    expect(b.outcome).toBe('merged');
    expect(await repo.getTransaction(a.txId!)).toMatchObject({ categoryId: 'cat-food', memo: '회의' });
  });
  it('editing a manual transaction keeps userEdited false', async () => {
    const { deps } = await setup();
    const t = await saveManualTransaction(base, deps);
    expect((await updateTransaction(t.id, { ...base, amount: 7000 }, deps)).userEdited).toBe(false);
  });
});

describe('delete and undo', () => {
  it('deleting an auto transaction removes its refunds and the same notification does not recreate it', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK, T(15, 12, 31), 'n1'), deps);
    await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    const snap = await deleteTransaction(a.txId!, deps);
    expect(await repo.listTransactions()).toHaveLength(0);
    expect(await repo.listRefunds()).toHaveLength(0);
    const again = await ingestNotification(input('sms', SMS_OK, T(15, 12, 40), 'n1'), deps);
    expect(again.outcome).toBe('already_processed');
    expect(await repo.listTransactions()).toHaveLength(0);

    await restoreTransaction(snap, deps);
    expect(await repo.listTransactions()).toHaveLength(1);
    expect(await repo.listRefunds()).toHaveLength(1);
    expect((await repo.listRecords()).filter((r) => r.linkedTxId === a.txId)).toHaveLength(1);
  });
});

describe('inbox actions', () => {
  it('confirming a candidate saves it, removes the excerpt and learns the card mapping', async () => {
    const { repo, deps } = await setup();
    const r = await ingestNotification(input('sms', SMS_OK.replace('1234', '9999')), deps);
    const c = (await repo.getCandidate(r.candidateId!))!;
    const init = candidateToInput(c);
    expect(init).toMatchObject({ type: 'expense', amount: 12000, merchant: '스타벅스', date: '2026-10-15', time: '12:30', categoryId: 'cat-cafe' });
    const t = await confirmCandidate(c.id, { ...base, ...init, paymentMethodId: 'pm-gana' } as TxInput, deps);
    expect(t.recordMethod).toBe('confirmed');
    expect(await repo.getCandidate(c.id)).toMatchObject({ status: 'confirmed', encryptedExcerpt: undefined });
    expect((await repo.getRecord(c.sourceRecordId))!.linkedTxId).toBe(t.id);
    expect((await repo.listPaymentMethods()).find((p) => p.id === 'pm-gana')!.matchKeys).toContain('가나카드*9999');
    const next = await ingestNotification(input('sms', SMS_OK.replace('1234', '9999').replace('12:30', '18:00'), T(15, 18, 1)), deps);
    expect(next.outcome).toBe('saved');
  });

  it('ignored candidates do not come back on re-delivery', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    const r = await ingestNotification(input('sms', SMS_OK, T(15, 12, 31), 'x1'), deps);
    await ignoreCandidate(r.candidateId!, deps);
    expect(await repo.getCandidate(r.candidateId!)).toMatchObject({ status: 'ignored', encryptedExcerpt: undefined });
    expect((await ingestNotification(input('sms', SMS_OK, T(15, 12, 33), 'x1'), deps)).outcome).toBe('already_processed');
    expect((await repo.listCandidates()).filter((c) => c.status === 'pending')).toHaveLength(0);
  });

  it('merging a duplicate suspect attaches the source to the existing transaction', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const r = await ingestNotification(input('kakaotalk', KAKAO_OK.replace('가맹점: 스타벅스\n', '')), deps);
    await mergeCandidate(r.candidateId!, deps);
    expect(await repo.listTransactions()).toHaveLength(1);
    expect((await repo.getRecord(r.recordId!))).toMatchObject({ outcome: 'merged', linkedTxId: a.txId });
  });

  it('linking a refund candidate respects refundable amount', async () => {
    const { repo, deps } = await setup();
    const a = await ingestNotification(input('sms', SMS_OK), deps);
    const b = await ingestNotification(input('sms', SMS_OK), deps);
    const c = await ingestNotification(input('sms', SMS_CANCEL, T(15, 13, 11)), deps);
    await expect(linkCandidateRefund(c.candidateId!, a.txId!, 13000, '2026-10-15', deps)).rejects.toThrow('환불액');
    const refund = await linkCandidateRefund(c.candidateId!, b.txId!, 12000, '2026-10-15', deps);
    expect(refund.originalTxId).toBe(b.txId);
    expect((await repo.getRecord(c.recordId!))!.linkedRefundId).toBe(refund.id);
    expect((await repo.getCandidate(c.candidateId!))!.status).toBe('confirmed');
  });

  it('purges pending candidates older than 30 days', async () => {
    const { repo, deps } = await setup({ saveMode: 'review_all' });
    await ingestNotification(input('sms', SMS_OK), deps);
    expect(await purgeExpiredCandidates(deps)).toBe(0);
    const later = { ...deps, now: () => T(15, 13, 0) + 31 * 24 * 60 * 60 * 1000 };
    expect(await purgeExpiredCandidates(later)).toBe(1);
    expect(await repo.listCandidates()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/core/actions.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/core/actions.ts`:

```ts
import type { Deps } from './deps';
import type { Candidate, NotificationRecord, PaymentMethod, Refund, Transaction, TxType } from './model';
import { refundableAmount } from './refund';
import { matchKeyFor } from './resolve';

export interface TxInput {
  type: TxType;
  amount: number;
  date: string;
  time?: string;
  merchant?: string;
  categoryId: string;
  paymentMethodId: string;
  toPaymentMethodId?: string;
  memo?: string;
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);

export function validateTxInput(i: TxInput): string | null {
  if (!Number.isInteger(i.amount) || i.amount < 1) return '금액을 1원 이상 입력하세요';
  if (!DATE_RE.test(i.date)) return '날짜를 확인하세요';
  if (i.time && !TIME_RE.test(i.time)) return '시각을 확인하세요';
  if (!i.paymentMethodId) return '결제수단을 선택하세요';
  if (i.type === 'transfer') {
    if (!i.toPaymentMethodId || i.toPaymentMethodId === i.paymentMethodId) return '출발·도착 수단을 다르게 선택하세요';
  } else if (!i.categoryId) {
    return '카테고리를 선택하세요';
  }
  return null;
}

function assertValid(i: TxInput) {
  const err = validateTxInput(i);
  if (err) throw new Error(err);
}

function fieldsOf(i: TxInput) {
  return {
    type: i.type,
    amount: i.amount,
    date: i.date,
    time: i.time || undefined,
    merchant: clean(i.merchant),
    categoryId: i.type === 'transfer' ? '' : i.categoryId,
    paymentMethodId: i.paymentMethodId,
    toPaymentMethodId: i.type === 'transfer' ? i.toPaymentMethodId : undefined,
    memo: clean(i.memo),
  };
}

export async function saveManualTransaction(i: TxInput, deps: Deps): Promise<Transaction> {
  assertValid(i);
  const t = deps.now();
  const tx: Transaction = {
    id: deps.newId(), ...fieldsOf(i), recordMethod: 'manual', dateFromReceipt: false,
    userEdited: false, createdAt: t, updatedAt: t,
  };
  await deps.repo.commit({ transactions: [tx] });
  return tx;
}

export async function updateTransaction(id: string, i: TxInput, deps: Deps): Promise<Transaction> {
  assertValid(i);
  const prev = await deps.repo.getTransaction(id);
  if (!prev) throw new Error('거래를 찾을 수 없어요');
  const tx: Transaction = {
    ...prev,
    ...fieldsOf(i),
    dateFromReceipt: prev.dateFromReceipt && prev.date === i.date && prev.time === (i.time || undefined),
    userEdited: prev.recordMethod !== 'manual' || prev.userEdited,
    updatedAt: deps.now(),
  };
  await deps.repo.commit({ transactions: [tx] });
  return tx;
}

export interface DeletedSnapshot {
  tx: Transaction;
  refunds: Refund[];
  records: NotificationRecord[];
}

export async function deleteTransaction(id: string, deps: Deps): Promise<DeletedSnapshot> {
  const { repo } = deps;
  const tx = await repo.getTransaction(id);
  if (!tx) throw new Error('거래를 찾을 수 없어요');
  const refunds = (await repo.listRefunds()).filter((r) => r.originalTxId === id);
  const refundIds = new Set(refunds.map((r) => r.id));
  const records = (await repo.listRecords()).filter(
    (r) => r.linkedTxId === id || (r.linkedRefundId !== undefined && refundIds.has(r.linkedRefundId)),
  );
  // 처리 기록은 남겨 동일 알림이 거래를 다시 만들지 않게 하고, 연결만 끊는다.
  const unlinked = records.map((r) => ({
    ...r,
    linkedTxId: r.linkedTxId === id ? undefined : r.linkedTxId,
    linkedRefundId: r.linkedRefundId && refundIds.has(r.linkedRefundId) ? undefined : r.linkedRefundId,
  }));
  await repo.commit({ deleteTransactionIds: [id], deleteRefundIds: [...refundIds], records: unlinked });
  return { tx, refunds, records };
}

export async function restoreTransaction(s: DeletedSnapshot, deps: Deps): Promise<void> {
  await deps.repo.commit({ transactions: [s.tx], refunds: s.refunds, records: s.records });
}

export function candidateToInput(c: Candidate): Partial<TxInput> {
  const f = c.fields;
  return {
    type: 'expense',
    amount: f.amount,
    date: f.date,
    time: f.time,
    merchant: f.merchant,
    categoryId: f.categoryId,
    paymentMethodId: f.paymentMethodId,
  };
}

async function loadPending(id: string, deps: Deps) {
  const c = await deps.repo.getCandidate(id);
  if (!c || c.status !== 'pending') throw new Error('처리할 후보를 찾을 수 없어요');
  const record = await deps.repo.getRecord(c.sourceRecordId);
  return { c, record };
}

const closed = (c: Candidate, status: 'confirmed' | 'ignored'): Candidate => ({ ...c, status, encryptedExcerpt: undefined });

export async function confirmCandidate(id: string, i: TxInput, deps: Deps): Promise<Transaction> {
  assertValid(i);
  const { c, record } = await loadPending(id, deps);
  const t = deps.now();
  const tx: Transaction = {
    id: deps.newId(), ...fieldsOf(i), recordMethod: 'confirmed',
    dateFromReceipt: c.fields.dateFromReceipt && c.fields.date === i.date,
    userEdited: false, approvalNo: c.fields.approvalNo, createdAt: t, updatedAt: t,
  };
  const methods: PaymentMethod[] = [];
  if (c.fields.cardName && !c.fields.paymentMethodId) {
    const pm = (await deps.repo.listPaymentMethods()).find((p) => p.id === i.paymentMethodId);
    const key = matchKeyFor(c.fields.cardName, c.fields.cardLast4);
    if (pm && pm.kind !== 'cash' && !pm.matchKeys.includes(key)) methods.push({ ...pm, matchKeys: [...pm.matchKeys, key] });
  }
  await deps.repo.commit({
    transactions: [tx],
    candidates: [closed(c, 'confirmed')],
    records: record ? [{ ...record, outcome: 'saved', linkedTxId: tx.id }] : [],
    paymentMethods: methods,
  });
  return tx;
}

export async function mergeCandidate(id: string, deps: Deps): Promise<void> {
  const { c, record } = await loadPending(id, deps);
  if (!c.duplicateOfTxId) throw new Error('합칠 거래가 없어요');
  await deps.repo.commit({
    candidates: [closed(c, 'confirmed')],
    records: record ? [{ ...record, outcome: 'merged', linkedTxId: c.duplicateOfTxId }] : [],
  });
}

export async function linkCandidateRefund(
  id: string, originalTxId: string, amount: number, date: string, deps: Deps,
): Promise<Refund> {
  const { c, record } = await loadPending(id, deps);
  const orig = await deps.repo.getTransaction(originalTxId);
  if (!orig || orig.type !== 'expense') throw new Error('원거래를 찾을 수 없어요');
  if (!Number.isInteger(amount) || amount < 1) throw new Error('금액을 1원 이상 입력하세요');
  if (refundableAmount(orig, await deps.repo.listRefunds()) < amount) throw new Error('환불액이 남은 결제 금액보다 커요');
  const refund: Refund = { id: deps.newId(), originalTxId, amount, date, time: c.fields.date === date ? c.fields.time : undefined, createdAt: deps.now() };
  await deps.repo.commit({
    refunds: [refund],
    candidates: [closed(c, 'confirmed')],
    records: record ? [{ ...record, outcome: 'refund_linked', linkedRefundId: refund.id }] : [],
  });
  return refund;
}

export async function ignoreCandidate(id: string, deps: Deps): Promise<void> {
  const { c } = await loadPending(id, deps);
  await deps.repo.commit({ candidates: [closed(c, 'ignored')] });
}

export async function purgeExpiredCandidates(deps: Deps): Promise<number> {
  const now = deps.now();
  const expired = (await deps.repo.listCandidates()).filter((c) => c.status === 'pending' && c.expiresAt <= now);
  if (expired.length) await deps.repo.commit({ deleteCandidateIds: expired.map((c) => c.id) });
  return expired.length;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/core && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): 거래 수정·삭제·실행 취소와 확인함 처리"
```

---

### Task 9: 예산·통계 계산 + CSV

**Files:**
- Create: `src/core/budget.ts`, `src/core/csv.ts`
- Test: `tests/core/budget.test.ts`, `tests/core/csv.test.ts`

**Interfaces:**
- Consumes: `monthKey`, `shiftMonth` (Task 1), 모델 (Task 2)
- Produces:
  - `MonthSummary { month: string; income: number; expense: number; refund: number; netSpend: number; budget?: number; remaining?: number; usageRate?: number; byCategory: { categoryId: string; amount: number }[] }`
  - `summarizeMonth(month: string, txs: Transaction[], refunds: Refund[], budget?: Budget): MonthSummary`
  - `monthlyTrend(endMonth: string, count: number, txs: Transaction[], refunds: Refund[]): { month: string; netSpend: number; income: number }[]` — 오래된 달부터
  - `toCsv(txs: Transaction[], refunds: Refund[], categories: Category[], methods: PaymentMethod[]): string` — UTF-8 BOM 포함

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/core/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { summarizeMonth, monthlyTrend } from '../../src/core/budget';
import type { Refund, Transaction } from '../../src/core/model';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'expense', amount: 1000, date: '2026-10-15', categoryId: 'food', paymentMethodId: 'p',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});

describe('summarizeMonth', () => {
  const a = tx({ id: 'a', amount: 30000, date: '2026-10-31', categoryId: 'food' });
  const txs = [
    a,
    tx({ amount: 5000, date: '2026-10-01', categoryId: 'cafe' }),
    tx({ amount: 2000, date: '2026-11-01', categoryId: 'cafe' }),
    tx({ type: 'income', amount: 3000000, date: '2026-10-25', categoryId: 'salary' }),
    tx({ type: 'transfer', amount: 500000, date: '2026-10-10', categoryId: '', toPaymentMethodId: 'q' }),
  ];
  const refunds: Refund[] = [{ id: 'r', originalTxId: 'a', amount: 10000, date: '2026-11-02', createdAt: 1 }];

  it('excludes transfers and applies refunds on refund date month', () => {
    const oct = summarizeMonth('2026-10', txs, refunds, { month: '2026-10', total: 100000 });
    expect(oct).toMatchObject({ income: 3000000, expense: 35000, refund: 0, netSpend: 35000, budget: 100000, remaining: 65000, usageRate: 0.35 });
    expect(oct.byCategory).toEqual([{ categoryId: 'food', amount: 30000 }, { categoryId: 'cafe', amount: 5000 }]);

    const nov = summarizeMonth('2026-11', txs, refunds);
    expect(nov).toMatchObject({ expense: 2000, refund: 10000, netSpend: -8000, budget: undefined, remaining: undefined, usageRate: undefined });
    expect(nov.byCategory).toEqual([{ categoryId: 'cafe', amount: 2000 }, { categoryId: 'food', amount: -10000 }]);
  });

  it('zero budget does not divide by zero', () => {
    const s = summarizeMonth('2026-10', txs, [], { month: '2026-10', total: 0 });
    expect(s.usageRate).toBeUndefined();
    expect(s.remaining).toBe(-35000);
  });

  it('trend lists months oldest first', () => {
    expect(monthlyTrend('2026-11', 3, txs, refunds)).toEqual([
      { month: '2026-09', netSpend: 0, income: 0 },
      { month: '2026-10', netSpend: 35000, income: 3000000 },
      { month: '2026-11', netSpend: -8000, income: 0 },
    ]);
  });
});
```

`tests/core/csv.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/core/budget.test.ts tests/core/csv.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/core/budget.ts`:

```ts
import { monthKey, shiftMonth } from './dates';
import type { Budget, Refund, Transaction } from './model';

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  refund: number;
  netSpend: number;
  budget?: number;
  remaining?: number;
  usageRate?: number;
  byCategory: { categoryId: string; amount: number }[];
}

export function summarizeMonth(month: string, txs: Transaction[], refunds: Refund[], budget?: Budget): MonthSummary {
  let income = 0;
  let expense = 0;
  let refund = 0;
  const byCat = new Map<string, number>();
  const add = (id: string, v: number) => byCat.set(id, (byCat.get(id) ?? 0) + v);
  const txById = new Map(txs.map((t) => [t.id, t]));

  for (const t of txs) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') {
      expense += t.amount;
      add(t.categoryId, t.amount);
    }
  }
  for (const r of refunds) {
    if (monthKey(r.date) !== month) continue;
    const orig = txById.get(r.originalTxId);
    if (!orig) continue;
    refund += r.amount;
    add(orig.categoryId, -r.amount);
  }

  const netSpend = expense - refund;
  const total = budget?.total;
  return {
    month,
    income,
    expense,
    refund,
    netSpend,
    budget: total,
    remaining: total === undefined ? undefined : total - netSpend,
    usageRate: total ? netSpend / total : undefined,
    byCategory: [...byCat.entries()]
      .filter(([, amount]) => amount !== 0)
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function monthlyTrend(endMonth: string, count: number, txs: Transaction[], refunds: Refund[]) {
  return Array.from({ length: count }, (_, i) => {
    const s = summarizeMonth(shiftMonth(endMonth, i - count + 1), txs, refunds);
    return { month: s.month, netSpend: s.netSpend, income: s.income };
  });
}
```

`src/core/csv.ts`:

```ts
import type { Category, PaymentMethod, Refund, Transaction } from './model';
import { RECORD_METHOD_LABEL, TX_TYPE_LABEL } from './model';

const HEADER = ['날짜', '시각', '유형', '금액', '가맹점', '카테고리', '결제수단', '도착 수단', '메모', '기록 방식', '환불액'];

function cell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(txs: Transaction[], refunds: Refund[], categories: Category[], methods: PaymentMethod[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const pm = new Map(methods.map((p) => [p.id, p.name]));
  const refunded = new Map<string, number>();
  for (const r of refunds) refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount);

  const rows = [...txs]
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .map((t) =>
      [
        t.date, t.time, TX_TYPE_LABEL[t.type], t.amount, t.merchant, cat.get(t.categoryId),
        pm.get(t.paymentMethodId), t.toPaymentMethodId ? pm.get(t.toPaymentMethodId) : undefined,
        t.memo, RECORD_METHOD_LABEL[t.recordMethod], refunded.get(t.id),
      ].map(cell).join(','),
    );
  return '﻿' + [HEADER.join(','), ...rows].join('\r\n');
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/core && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): 월 예산·통계 계산과 CSV 내보내기"
```

---

### Task 10: IndexedDB 저장소·암호화·기본 데이터·앱 서비스

**Files:**
- Create: `src/data/db.ts`, `src/data/dexieRepo.ts`, `src/data/crypto.ts`, `src/data/seed.ts`, `src/data/app.ts`
- Test: `tests/data/dexieRepo.test.ts`, `tests/data/crypto.test.ts`, `tests/data/seed.test.ts`

**Interfaces:**
- Consumes: `Repo`, `WriteBatch` (Task 2), `Deps`, `drainPending` (Task 7), `purgeExpiredCandidates` (Task 8), `runRepoContract` (Task 2)
- Produces:
  - `class GagyebuDB extends Dexie` (테이블: transactions, refunds, candidates, records, categories, paymentMethods, budgets, kv, pending)
  - `createDexieRepo(db: GagyebuDB): Repo`
  - `generateDeviceKey(): Promise<CryptoKey>`, `encryptText(key, text): Promise<string>`, `decryptText(key, payload): Promise<string>`
  - `hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string }>`, `verifyPin(pin, hash, salt): Promise<boolean>`
  - `defaultSeed(): WriteBatch`, `ensureSeeded(repo: Repo): Promise<void>`, `sampleCardMethods(existing: PaymentMethod[]): PaymentMethod[]`
  - `AppServices { repo: Repo; deps: Deps; decrypt: (payload: string) => Promise<string> }`, `createAppServices(): Promise<AppServices>`, `wipeAllData(services: AppServices): Promise<void>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/data/dexieRepo.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { GagyebuDB } from '../../src/data/db';
import { createDexieRepo } from '../../src/data/dexieRepo';
import { runRepoContract } from './repoContract';

let i = 0;
runRepoContract('dexie', async () => createDexieRepo(new GagyebuDB(`test-${++i}`)));
```

`tests/data/crypto.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateDeviceKey, encryptText, decryptText, hashPin, verifyPin } from '../../src/data/crypto';

describe('crypto', () => {
  it('round-trips with random IV', async () => {
    const key = await generateDeviceKey();
    const a = await encryptText(key, '가나카드 12,000원 스타벅스');
    const b = await encryptText(key, '가나카드 12,000원 스타벅스');
    expect(a).not.toBe(b);
    expect(a).not.toContain('스타벅스');
    expect(await decryptText(key, a)).toBe('가나카드 12,000원 스타벅스');
  });
  it('fails with another key', async () => {
    const payload = await encryptText(await generateDeviceKey(), 'x');
    await expect(decryptText(await generateDeviceKey(), payload)).rejects.toThrow();
  });
  it('hashes and verifies PIN', async () => {
    const { hash, salt } = await hashPin('1234');
    expect(hash).not.toContain('1234');
    expect(await verifyPin('1234', hash, salt)).toBe(true);
    expect(await verifyPin('1235', hash, salt)).toBe(false);
  });
});
```

`tests/data/seed.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/data`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/data/db.ts`:

```ts
import Dexie, { type Table } from 'dexie';
import type {
  Budget, Candidate, Category, NotificationRecord, PaymentMethod, PendingItem, Refund, Transaction,
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
  }
}
```

`src/data/dexieRepo.ts`:

```ts
import type { Repo, WriteBatch } from '../core/repo';
import type { AppSettings, AutoRecordSettings } from '../core/model';
import { DEFAULT_APP_SETTINGS, DEFAULT_AUTO_SETTINGS } from '../core/model';
import type { GagyebuDB } from './db';

export function createDexieRepo(db: GagyebuDB): Repo {
  const kvGet = async <T>(key: string, fallback: T): Promise<T> =>
    ((await db.kv.get(key))?.value as T | undefined) ?? structuredClone(fallback);
  const dataTables = () => [
    db.transactions, db.refunds, db.candidates, db.records, db.categories,
    db.paymentMethods, db.budgets, db.kv, db.pending,
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
```

`src/data/crypto.ts`:

```ts
const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function generateDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), iv.length);
  return toB64(out);
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const bytes = fromB64(payload);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(pt);
}

const PIN_ITERATIONS = 150_000;

export async function hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = salt ? fromB64(salt) : crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PIN_ITERATIONS }, base, 256,
  );
  return { hash: toB64(bits), salt: toB64(saltBytes) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  return (await hashPin(pin, salt)).hash === hash;
}
```

`src/data/seed.ts`:

```ts
import type { Repo, WriteBatch } from '../core/repo';
import type { Category, PaymentMethod } from '../core/model';
import { UNCATEGORIZED_ID } from '../core/model';

const EXPENSE = ['식비', '카페', '편의점', '교통', '쇼핑', '생활', '주거·통신', '의료', '문화·여가', '기타'];
const INCOME = ['급여', '용돈', '기타 수입'];

export function defaultSeed(): WriteBatch {
  const categories: Category[] = [
    ...EXPENSE.map((name, i) => ({ id: `cat-e${i}`, name, kind: 'expense' as const, sortOrder: i, archived: false })),
    { id: UNCATEGORIZED_ID, name: '미분류', kind: 'expense', sortOrder: 98, archived: false },
    ...INCOME.map((name, i) => ({ id: `cat-i${i}`, name, kind: 'income' as const, sortOrder: 100 + i, archived: false })),
  ];
  const paymentMethods: PaymentMethod[] = [
    { id: 'pm-cash', name: '현금', kind: 'cash', matchKeys: [], sortOrder: 0, archived: false },
    { id: 'pm-account', name: '계좌', kind: 'account', matchKeys: [], sortOrder: 1, archived: false },
  ];
  return { categories, paymentMethods };
}

export async function ensureSeeded(repo: Repo): Promise<void> {
  if ((await repo.listCategories()).length > 0) return;
  await repo.commit(defaultSeed());
}

const SAMPLE: Omit<PaymentMethod, 'sortOrder' | 'archived'>[] = [
  { id: 'pm-sample-gana', name: '가나카드', kind: 'card', matchKeys: ['가나카드*1234'] },
  { id: 'pm-sample-dara', name: '다라카드', kind: 'card', matchKeys: ['다라카드'] },
  { id: 'pm-sample-maba', name: '마바페이', kind: 'pay', matchKeys: ['마바페이'] },
];

/** 시뮬레이터용 가상 결제수단. 같은 이름이 이미 있으면 건너뛴다. */
export function sampleCardMethods(existing: PaymentMethod[]): PaymentMethod[] {
  const names = new Set(existing.map((p) => p.name));
  return SAMPLE.filter((s) => !names.has(s.name)).map((s, i) => ({
    ...s, sortOrder: existing.length + i, archived: false,
  }));
}
```

`src/data/app.ts`:

```ts
import type { Deps } from '../core/deps';
import { newId } from '../core/ids';
import type { Repo } from '../core/repo';
import { drainPending } from '../core/pipeline/ingest';
import { purgeExpiredCandidates } from '../core/actions';
import { GagyebuDB } from './db';
import { createDexieRepo } from './dexieRepo';
import { decryptText, encryptText, generateDeviceKey } from './crypto';
import { ensureSeeded } from './seed';

export interface AppServices {
  repo: Repo;
  deps: Deps;
  decrypt: (payload: string) => Promise<string>;
}

async function loadDeviceKey(db: GagyebuDB): Promise<CryptoKey> {
  const row = await db.kv.get('deviceKey');
  if (row) return row.value as CryptoKey;
  const key = await generateDeviceKey();
  await db.kv.put({ key: 'deviceKey', value: key });
  return key;
}

export async function createAppServices(): Promise<AppServices> {
  const db = new GagyebuDB();
  const repo = createDexieRepo(db);
  const key = await loadDeviceKey(db);
  const deps: Deps = { repo, now: Date.now, newId, encrypt: (s) => encryptText(key, s) };
  await ensureSeeded(repo);
  await purgeExpiredCandidates(deps);
  await drainPending(deps);
  return { repo, deps, decrypt: (p) => decryptText(key, p) };
}

/** 전체 삭제 후 페이지를 다시 불러와 새 기기 키·기본 데이터로 시작한다. */
export async function wipeAllData(services: AppServices): Promise<void> {
  await services.repo.clearAll();
  location.reload();
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (Dexie 계약 테스트 포함)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): IndexedDB 저장소, 발췌 암호화, PIN 해시, 기본 데이터"
```

---

### Task 11: 앱 셸 + 공용 UI + 홈 화면

**Files:**
- Create: `src/ui/AppContext.tsx`, `src/ui/hooks.ts`, `src/ui/format.ts`, `src/ui/styles.css`, `src/ui/App.tsx`
- Create: `src/ui/components/TabBar.tsx`, `src/ui/components/PageHeader.tsx`, `src/ui/components/BudgetBar.tsx`, `src/ui/components/TxRow.tsx`, `src/ui/components/Undo.tsx`
- Create: `src/ui/screens/Home.tsx`
- Modify: `src/main.tsx` (전체 교체)
- Test: `tests/ui/format.test.ts`

**Interfaces:**
- Consumes: `createAppServices`, `AppServices` (Task 10), `summarizeMonth` (Task 9), `formatWon` (Task 1)
- Produces:
  - `useServices(): AppServices`
  - `useLive<T>(fn: (repo: Repo) => Promise<T>, deps?: unknown[]): T | undefined`
  - `useLookups(): { categories: Category[]; methods: PaymentMethod[]; catName: (id: string) => string; pmName: (id?: string) => string } | undefined`
  - `currentMonth(): string`, `monthLabel(month: string): string`, `dayLabel(date: string): string`, `timeLabel(ms: number): string`, `sortTxDesc(a, b): number`, `signedAmount(t: Transaction): string`
  - `useUndo(): (message: string, undo: () => Promise<void>) => void`, `<UndoProvider>`
  - `<PageHeader title back? right?>`, `<BudgetBar summary>`, `<TxRow tx refunded? catName pmName>`
  - `App.tsx`의 `<Routes>`에 이후 Task가 `<Route>`를 추가한다

- [ ] **Step 1: 실패하는 테스트 작성** (UI 순수 함수만 단위 테스트)

`tests/ui/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { monthLabel, dayLabel, signedAmount, sortTxDesc } from '../../src/ui/format';
import type { Transaction } from '../../src/core/model';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', type: 'expense', amount: 12000, date: '2026-10-15', categoryId: 'c', paymentMethodId: 'p',
  recordMethod: 'manual', dateFromReceipt: false, userEdited: false, createdAt: 1, updatedAt: 1, ...over,
});

describe('format', () => {
  it('labels', () => {
    expect(monthLabel('2026-10')).toBe('2026년 10월');
    expect(dayLabel('2026-10-15')).toBe('10월 15일 (목)');
  });
  it('signed amounts', () => {
    expect(signedAmount(tx({}))).toBe('-12,000원');
    expect(signedAmount(tx({ type: 'income' }))).toBe('+12,000원');
    expect(signedAmount(tx({ type: 'transfer' }))).toBe('12,000원');
  });
  it('sorts newest first by date, time, createdAt', () => {
    const list = [
      tx({ id: 'a', date: '2026-10-14', time: '23:00' }),
      tx({ id: 'b', date: '2026-10-15', time: '09:00' }),
      tx({ id: 'c', date: '2026-10-15', time: '09:00', createdAt: 2 }),
      tx({ id: 'd', date: '2026-10-15' }),
    ];
    expect(list.sort(sortTxDesc).map((t) => t.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});
```

`vite.config.ts`의 `test.include`는 이미 `tests/**/*.test.ts`라 추가 설정 불필요.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ui`
Expected: FAIL

- [ ] **Step 3: 구현 — 유틸·컨텍스트·훅**

`src/ui/format.ts`:

```ts
import { formatWon } from '../core/money';
import { toDateKey } from '../core/dates';
import type { Transaction } from '../core/model';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const currentMonth = () => toDateKey(new Date()).slice(0, 7);
export const today = () => toDateKey(new Date());

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}년 ${m}월`;
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

export function timeLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function signedAmount(t: Transaction): string {
  if (t.type === 'income') return `+${formatWon(t.amount)}`;
  if (t.type === 'expense') return `-${formatWon(t.amount)}`;
  return formatWon(t.amount);
}

export function sortTxDesc(a: Transaction, b: Transaction): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.time ?? '').localeCompare(a.time ?? '') ||
    b.createdAt - a.createdAt
  );
}
```

`src/ui/AppContext.tsx`:

```tsx
import { createContext, useContext } from 'react';
import type { AppServices } from '../data/app';

export const AppCtx = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const s = useContext(AppCtx);
  if (!s) throw new Error('AppCtx provider missing');
  return s;
}
```

`src/ui/hooks.ts`:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import type { Repo } from '../core/repo';
import { useServices } from './AppContext';

export function useLive<T>(fn: (repo: Repo) => Promise<T>, deps: unknown[] = []): T | undefined {
  const { repo } = useServices();
  return useLiveQuery(() => fn(repo), deps);
}

export function useLookups() {
  return useLive(async (repo) => {
    const [categories, methods] = await Promise.all([repo.listCategories(), repo.listPaymentMethods()]);
    categories.sort((a, b) => a.sortOrder - b.sortOrder);
    methods.sort((a, b) => a.sortOrder - b.sortOrder);
    const cat = new Map(categories.map((c) => [c.id, c.name]));
    const pm = new Map(methods.map((p) => [p.id, p.name]));
    return {
      categories,
      methods,
      catName: (id: string) => (id ? cat.get(id) ?? '삭제된 카테고리' : '이체'),
      pmName: (id?: string) => (id ? pm.get(id) ?? '삭제된 수단' : '-'),
    };
  });
}
```

`src/ui/components/Undo.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Show = (message: string, undo: () => Promise<void>) => void;
const UndoCtx = createContext<Show>(() => {});
export const useUndo = () => useContext(UndoCtx);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; undo: () => Promise<void> } | null>(null);
  const show = useCallback<Show>((message, undo) => setToast({ id: Date.now(), message, undo }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <UndoCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={async () => {
              const u = toast.undo;
              setToast(null);
              await u();
            }}
          >
            실행 취소
          </button>
        </div>
      )}
    </UndoCtx.Provider>
  );
}
```

- [ ] **Step 4: 구현 — 공용 컴포넌트**

`src/ui/components/TabBar.tsx`:

```tsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: '홈', icon: '⌂' },
  { to: '/history', label: '내역', icon: '☰' },
  { to: '/stats', label: '통계', icon: '▥' },
  { to: '/settings', label: '설정', icon: '⚙' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

`src/ui/components/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={() => navigate(-1)}>
          ←
        </button>
      )}
      <h1>{title}</h1>
      <div className="page-header-right">{right}</div>
    </header>
  );
}
```

`src/ui/components/BudgetBar.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { MonthSummary } from '../../core/budget';
import { formatWon } from '../../core/money';

export function BudgetBar({ summary }: { summary: MonthSummary }) {
  if (summary.budget === undefined) {
    return (
      <p className="muted">
        예산이 없어요. <Link to="/settings/budget">이번 달 예산 설정하기</Link>
      </p>
    );
  }
  const rate = summary.usageRate ?? 0;
  const pct = Math.round(rate * 100);
  const over = (summary.remaining ?? 0) < 0;
  return (
    <div className="budget">
      <div className="budget-row">
        <span>{over ? '예산 초과' : '남은 예산'}</span>
        <strong className={over ? 'neg' : undefined}>{formatWon(Math.abs(summary.remaining ?? 0))}</strong>
      </div>
      <div
        className={`bar ${over ? 'bar-over' : pct >= 80 ? 'bar-warn' : ''}`}
        role="progressbar"
        aria-label="예산 사용률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
      >
        <span style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
      <div className="budget-row small muted">
        <span>사용률 {pct}%{pct >= 80 && !over ? ' · 80% 넘음' : ''}</span>
        <span>예산 {formatWon(summary.budget)}</span>
      </div>
    </div>
  );
}
```

`src/ui/components/TxRow.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Transaction } from '../../core/model';
import { formatWon } from '../../core/money';
import { signedAmount } from '../format';

export function TxRow({ tx, refunded, catName, pmName }: {
  tx: Transaction; refunded?: number; catName: (id: string) => string; pmName: (id?: string) => string;
}) {
  const title = tx.merchant ?? tx.memo ?? catName(tx.categoryId);
  const sub = tx.type === 'transfer'
    ? `${pmName(tx.paymentMethodId)} → ${pmName(tx.toPaymentMethodId)}`
    : `${catName(tx.categoryId)} · ${pmName(tx.paymentMethodId)}`;
  return (
    <li>
      <Link to={`/tx/${tx.id}`} className="tx-row">
        <div className="tx-main">
          <span className="tx-title">{title}</span>
          <span className="tx-sub">
            {tx.time ? `${tx.time} · ` : ''}{sub}
            {tx.recordMethod !== 'manual' && <span className="badge">자동</span>}
          </span>
        </div>
        <div className="tx-amount">
          <span className={tx.type === 'income' ? 'pos' : undefined}>{signedAmount(tx)}</span>
          {refunded ? <span className="small pos">환불 {formatWon(refunded)}</span> : null}
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 5: 구현 — 홈 화면과 앱 셸**

`src/ui/screens/Home.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { summarizeMonth } from '../../core/budget';
import { formatWon } from '../../core/money';
import { useLive, useLookups } from '../hooks';
import { currentMonth, monthLabel, sortTxDesc, timeLabel } from '../format';
import { BudgetBar } from '../components/BudgetBar';
import { TxRow } from '../components/TxRow';

export function Home() {
  const month = currentMonth();
  const lookups = useLookups();
  const data = useLive(async (repo) => {
    const [txs, refunds, budget, candidates, auto] = await Promise.all([
      repo.listTransactions(), repo.listRefunds(), repo.getBudget(month), repo.listCandidates(), repo.getAutoSettings(),
    ]);
    return { txs, refunds, budget, pending: candidates.filter((c) => c.status === 'pending').length, auto };
  }, [month]);
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget);
  const refunded = new Map<string, number>();
  data.refunds.forEach((r) => refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount));
  const recent = [...data.txs].sort(sortTxDesc).slice(0, 5);
  const a = data.auto;
  const autoText = !a.enabled
    ? '자동 기록 꺼짐'
    : a.permission !== 'granted'
      ? '알림 접근 권한이 필요해요'
      : `자동 기록 켜짐${a.lastProcessedAt ? ` · 마지막 처리 ${timeLabel(a.lastProcessedAt)}` : ' · 아직 처리한 알림 없음'}`;
  const autoState = !a.enabled ? 'off' : a.permission !== 'granted' ? 'warn' : 'on';

  return (
    <div className="page">
      <header className="page-header"><h1>{monthLabel(month)}</h1></header>

      <section className="card">
        <p className="muted small">이번 달 순지출</p>
        <p className="big">{formatWon(s.netSpend)}</p>
        <BudgetBar summary={s} />
      </section>

      {data.pending > 0 && (
        <Link to="/inbox" className="card banner">
          <span>확인이 필요한 내역</span>
          <strong>{data.pending}건 ›</strong>
        </Link>
      )}

      <Link to="/settings/auto" className={`card status status-${autoState}`}>
        <span className="dot" aria-hidden="true" />
        <span>{autoText}</span>
      </Link>

      <section>
        <div className="section-head">
          <h2>최근 거래</h2>
          <Link to="/history">전체 보기</Link>
        </div>
        {recent.length === 0 ? (
          <p className="empty">아직 거래가 없어요. + 버튼으로 첫 거래를 기록해 보세요.</p>
        ) : (
          <ul className="tx-list">
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} refunded={refunded.get(t.id)} catName={lookups.catName} pmName={lookups.pmName} />
            ))}
          </ul>
        )}
      </section>

      <Link to="/tx/new" className="fab" aria-label="거래 추가">+</Link>
    </div>
  );
}
```

`src/ui/App.tsx`:

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { Home } from './screens/Home';

export default function App() {
  return (
    <HashRouter>
      <UndoProvider>
        <div className="app">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
```

`src/main.tsx` (전체 교체):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAppServices } from './data/app';
import { AppCtx } from './ui/AppContext';
import App from './ui/App';
import './ui/styles.css';

const root = createRoot(document.getElementById('root')!);

createAppServices()
  .then((services) =>
    root.render(
      <StrictMode>
        <AppCtx.Provider value={services}>
          <App />
        </AppCtx.Provider>
      </StrictMode>,
    ),
  )
  .catch((e) => {
    console.warn('startup_failed', e instanceof Error ? e.name : 'unknown');
    root.render(<p className="fatal">이 브라우저에서는 기기 저장소를 사용할 수 없어요. 시크릿 모드가 아닌 일반 창에서 열어 주세요.</p>);
  });
```

`src/ui/styles.css`:

```css
:root {
  --bg: #f6f7f5;
  --surface: #ffffff;
  --text: #1c2421;
  --muted: #5f6b66;
  --line: #e2e6e3;
  --accent: #2f6f5e;
  --accent-soft: #e3f0eb;
  --neg: #b42318;
  --pos: #1d6fb8;
  --warn: #b26a00;
  --radius: 14px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111513;
    --surface: #1a201d;
    --text: #e8ece9;
    --muted: #9aa6a0;
    --line: #2a322e;
    --accent: #6cc3a6;
    --accent-soft: #1f322b;
    --neg: #ff8a7a;
    --pos: #7db8f0;
    --warn: #f0b350;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html { font-size: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
  line-height: 1.5;
}
a { color: var(--accent); }
button, input, select, textarea { font: inherit; color: inherit; }
.app { max-width: 560px; margin: 0 auto; min-height: 100vh; padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
.page { padding: 0 16px 24px; }
.page-header { display: flex; align-items: center; gap: 8px; padding: 16px 0 8px; }
.page-header h1 { font-size: 1.25rem; margin: 0; flex: 1; }
.page-header-right { display: flex; gap: 8px; }
h2 { font-size: 1rem; margin: 0; }
.icon-btn { border: 0; background: transparent; font-size: 1.25rem; padding: 4px 8px; cursor: pointer; }
.card { display: block; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; margin: 12px 0; color: inherit; text-decoration: none; }
.banner { display: flex; justify-content: space-between; background: var(--accent-soft); border-color: var(--accent); }
.status { display: flex; gap: 8px; align-items: center; font-size: 0.9rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); flex: none; }
.status-on .dot { background: var(--accent); }
.status-warn .dot { background: var(--warn); }
.big { font-size: 1.75rem; font-weight: 700; margin: 4px 0 12px; }
.muted { color: var(--muted); }
.small { font-size: 0.85rem; }
.neg { color: var(--neg); }
.pos { color: var(--pos); }
.empty { color: var(--muted); text-align: center; padding: 24px 0; }
.loading, .fatal { padding: 24px 16px; }
.budget-row { display: flex; justify-content: space-between; align-items: baseline; }
.bar { height: 10px; border-radius: 5px; background: var(--line); overflow: hidden; margin: 8px 0; }
.bar span { display: block; height: 100%; background: var(--accent); }
.bar-warn span { background: var(--warn); }
.bar-over span { background: var(--neg); }
.section-head { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 8px; }
.tx-list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
.tx-list li + li { border-top: 1px solid var(--line); }
.tx-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; color: inherit; text-decoration: none; }
.tx-main, .tx-amount { display: flex; flex-direction: column; min-width: 0; }
.tx-amount { align-items: flex-end; white-space: nowrap; font-weight: 600; }
.tx-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-sub { font-size: 0.8rem; color: var(--muted); }
.badge { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); font-size: 0.75rem; }
.day-head { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted); margin: 16px 4px 6px; }
.fab { position: fixed; right: max(16px, calc(50% - 264px)); bottom: calc(84px + env(safe-area-inset-bottom)); width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: var(--bg); font-size: 2rem; display: grid; place-items: center; text-decoration: none; box-shadow: 0 4px 12px rgb(0 0 0 / 0.2); }
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; background: var(--surface); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
.tab { flex: 1; max-width: 140px; display: flex; flex-direction: column; align-items: center; padding: 8px 0; color: var(--muted); text-decoration: none; font-size: 0.8rem; }
.tab.active { color: var(--accent); font-weight: 700; }
.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field > span { font-size: 0.85rem; color: var(--muted); }
.field input, .field select, .field textarea { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); min-height: 44px; }
.row { display: flex; gap: 8px; }
.row > * { flex: 1; }
.segmented { display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.segmented label { flex: 1; text-align: center; padding: 10px 0; cursor: pointer; }
.segmented input { position: absolute; opacity: 0; pointer-events: none; }
.segmented label:has(input:checked) { background: var(--accent); color: var(--bg); font-weight: 700; }
.segmented label:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: -4px; }
.btn { border: 1px solid var(--line); background: var(--surface); padding: 10px 16px; border-radius: 10px; min-height: 44px; cursor: pointer; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--bg); font-weight: 700; }
.btn-danger { color: var(--neg); border-color: var(--neg); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: var(--neg); font-size: 0.9rem; }
.toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(80px + env(safe-area-inset-bottom)); background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 10px; display: flex; gap: 16px; align-items: center; z-index: 10; }
.toast button { background: transparent; border: 0; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
.list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
.list > li { padding: 12px 16px; }
.list > li + li { border-top: 1px solid var(--line); }
.list a.item { display: flex; justify-content: space-between; color: inherit; text-decoration: none; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.8rem; }
.chip-warn { background: transparent; border: 1px solid var(--warn); color: var(--warn); }
.month-nav { display: flex; align-items: center; justify-content: space-between; }
.hbar { display: grid; grid-template-columns: 6rem 1fr auto; gap: 8px; align-items: center; margin: 6px 0; font-size: 0.9rem; }
.hbar .bar { margin: 0; }
pre.excerpt { white-space: pre-wrap; background: var(--bg); padding: 12px; border-radius: 10px; font-size: 0.85rem; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
```

- [ ] **Step 6: 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

Run: `npm run dev` 후 브라우저에서 `http://localhost:5173` 열기
Expected: "2026년 10월"(현재 월), 순지출 0원, "예산이 없어요" 안내, "자동 기록 꺼짐", "아직 거래가 없어요", 하단 탭 4개, + 버튼. 다크 모드에서도 글자가 보임.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): 앱 셸, 하단 탭, 홈 화면"
```

---

### Task 12: 거래 입력·상세 + 내역 화면

**Files:**
- Create: `src/ui/components/TxForm.tsx`, `src/ui/screens/TxEditor.tsx`, `src/ui/screens/History.tsx`, `src/ui/filter.ts`
- Modify: `src/ui/App.tsx` (Route 추가)
- Test: `tests/ui/filter.test.ts`

**Interfaces:**
- Consumes: `TxInput`, `validateTxInput`, `saveManualTransaction`, `updateTransaction`, `deleteTransaction`, `restoreTransaction` (Task 8), `useLookups`, `useLive`, `useServices`, `useUndo`, `PageHeader`, `TxRow` (Task 11)
- Produces:
  - `<TxForm initial: Partial<TxInput> submitLabel: string onSubmit: (i: TxInput) => Promise<void> />`
  - `TxFilter { query: string; type: '' | TxType; categoryId: string; paymentMethodId: string; recordMethod: '' | RecordMethod }`, `EMPTY_FILTER`, `filterTransactions(txs, month, f): Transaction[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/filter.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ui/filter.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 필터**

`src/ui/filter.ts`:

```ts
import { monthKey } from '../core/dates';
import type { RecordMethod, Transaction, TxType } from '../core/model';

export interface TxFilter {
  query: string;
  type: '' | TxType;
  categoryId: string;
  paymentMethodId: string;
  recordMethod: '' | RecordMethod;
}

export const EMPTY_FILTER: TxFilter = { query: '', type: '', categoryId: '', paymentMethodId: '', recordMethod: '' };

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function filterTransactions(txs: Transaction[], month: string, f: TxFilter): Transaction[] {
  const q = squash(f.query);
  return txs.filter(
    (t) =>
      monthKey(t.date) === month &&
      (!q || squash(`${t.merchant ?? ''} ${t.memo ?? ''}`).includes(q)) &&
      (!f.type || t.type === f.type) &&
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.paymentMethodId || t.paymentMethodId === f.paymentMethodId || t.toPaymentMethodId === f.paymentMethodId) &&
      (!f.recordMethod || t.recordMethod === f.recordMethod),
  );
}
```

- [ ] **Step 4: 구현 — 입력 폼**

`src/ui/components/TxForm.tsx`:

```tsx
import { useRef, useState, type FormEvent } from 'react';
import { validateTxInput, type TxInput } from '../../core/actions';
import { parseWon } from '../../core/money';
import type { TxType } from '../../core/model';
import { TX_TYPE_LABEL } from '../../core/model';
import { useLookups } from '../hooks';
import { today } from '../format';

export function TxForm({ initial, submitLabel, onSubmit }: {
  initial: Partial<TxInput>;
  submitLabel: string;
  onSubmit: (i: TxInput) => Promise<void>;
}) {
  const lookups = useLookups();
  const [type, setType] = useState<TxType>(initial.type ?? 'expense');
  const [amount, setAmount] = useState(initial.amount ? initial.amount.toLocaleString('ko-KR') : '');
  const [date, setDate] = useState(initial.date ?? today());
  const [time, setTime] = useState(initial.time ?? '');
  const [merchant, setMerchant] = useState(initial.merchant ?? '');
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '');
  const [paymentMethodId, setPaymentMethodId] = useState(initial.paymentMethodId ?? '');
  const [toPaymentMethodId, setToPaymentMethodId] = useState(initial.toPaymentMethodId ?? '');
  const [memo, setMemo] = useState(initial.memo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  if (!lookups) return <p className="loading">불러오는 중…</p>;
  const catKind = type === 'income' ? 'income' : 'expense';
  const cats = lookups.categories.filter((c) => c.kind === catKind && (!c.archived || c.id === categoryId));
  const methods = lookups.methods.filter((m) => !m.archived || m.id === paymentMethodId || m.id === toPaymentMethodId);

  const changeType = (t: TxType) => {
    setType(t);
    const current = lookups.categories.find((c) => c.id === categoryId);
    if (current && current.kind !== (t === 'income' ? 'income' : 'expense')) setCategoryId('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const input: TxInput = {
      type, amount: parseWon(amount) ?? 0, date, time: time || undefined, merchant,
      categoryId: type === 'transfer' ? '' : categoryId, paymentMethodId,
      toPaymentMethodId: type === 'transfer' ? toPaymentMethodId : undefined, memo,
    };
    const err = validateTxInput(input);
    if (err) {
      setError(err);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '저장하지 못했어요');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="segmented" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="visually-hidden">유형</legend>
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <label key={t}>
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => changeType(t)} />
            {TX_TYPE_LABEL[t]}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>금액 (원)</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
          }}
          placeholder="0"
          required
        />
      </label>

      <div className="row">
        <label className="field"><span>날짜</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="field"><span>시각 (선택)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>

      {type !== 'transfer' && (
        <label className="field"><span>가맹점·내용 (선택)</span><input value={merchant} onChange={(e) => setMerchant(e.target.value)} /></label>
      )}

      {type !== 'transfer' && (
        <label className="field">
          <span>카테고리</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">선택하세요</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (보관됨)' : ''}</option>)}
          </select>
        </label>
      )}

      <label className="field">
        <span>{type === 'transfer' ? '출발 수단' : '결제수단'}</span>
        <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} required>
          <option value="">선택하세요</option>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name}{m.archived ? ' (보관됨)' : ''}</option>)}
        </select>
      </label>

      {type === 'transfer' && (
        <label className="field">
          <span>도착 수단</span>
          <select value={toPaymentMethodId} onChange={(e) => setToPaymentMethodId(e.target.value)} required>
            <option value="">선택하세요</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      )}

      <label className="field"><span>메모 (선택)</span><textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></label>

      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '저장 중…' : submitLabel}</button>
    </form>
  );
}
```

- [ ] **Step 5: 구현 — 입력·상세 화면**

`src/ui/screens/TxEditor.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { deleteTransaction, restoreTransaction, saveManualTransaction, updateTransaction } from '../../core/actions';
import { formatWon } from '../../core/money';
import { RECORD_METHOD_LABEL, SOURCE_APP_LABEL } from '../../core/model';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { dayLabel, timeLabel } from '../format';
import { PageHeader } from '../components/PageHeader';
import { TxForm } from '../components/TxForm';
import { useUndo } from '../components/Undo';

export function TxEditor() {
  const { id } = useParams();
  const { deps } = useServices();
  const navigate = useNavigate();
  const showUndo = useUndo();
  const data = useLive(async (repo) => {
    if (!id) return { tx: undefined, sources: [], refunds: [] };
    const [tx, records, refunds] = await Promise.all([repo.getTransaction(id), repo.listRecords(), repo.listRefunds()]);
    return {
      tx,
      sources: records.filter((r) => r.linkedTxId === id),
      refunds: refunds.filter((r) => r.originalTxId === id),
    };
  }, [id]);

  if (!id) {
    return (
      <div className="page">
        <PageHeader title="거래 추가" back />
        <TxForm initial={{}} submitLabel="저장" onSubmit={async (i) => { await saveManualTransaction(i, deps); navigate(-1); }} />
      </div>
    );
  }
  if (!data) return <p className="loading">불러오는 중…</p>;
  const { tx, sources, refunds } = data;
  if (!tx) {
    return (
      <div className="page">
        <PageHeader title="거래" back />
        <p className="empty">삭제되었거나 없는 거래예요.</p>
      </div>
    );
  }

  const onDelete = async () => {
    const snap = await deleteTransaction(tx.id, deps);
    navigate(-1);
    showUndo('거래를 삭제했어요', () => restoreTransaction(snap, deps));
  };
  const refundTotal = refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page">
      <PageHeader title="거래 상세" back right={<button type="button" className="btn btn-danger" onClick={onDelete}>삭제</button>} />

      <section className="card small">
        <p>기록 방식: <strong>{RECORD_METHOD_LABEL[tx.recordMethod]}</strong>{tx.userEdited ? ' · 직접 수정함' : ''}</p>
        {tx.dateFromReceipt && <p className="muted">알림에 거래 시각이 없어 받은 시각으로 기록했어요.</p>}
        {sources.length > 0 && (
          <p>출처: {sources.map((s) => `${SOURCE_APP_LABEL[s.sourceApp]} (${timeLabel(s.receivedAt)})`).join(', ')}</p>
        )}
        {refunds.length > 0 && (
          <>
            <p>환불 합계 <strong className="pos">{formatWon(refundTotal)}</strong> · 순지출 {formatWon(tx.amount - refundTotal)}</p>
            <ul>
              {refunds.map((r) => <li key={r.id}>{dayLabel(r.date)} {formatWon(r.amount)}</li>)}
            </ul>
          </>
        )}
      </section>

      <TxForm
        key={tx.updatedAt}
        initial={tx}
        submitLabel="수정 저장"
        onSubmit={async (i) => { await updateTransaction(tx.id, i, deps); navigate(-1); }}
      />
    </div>
  );
}
```

- [ ] **Step 6: 구현 — 내역 화면**

`src/ui/screens/History.tsx`:

```tsx
import { useState } from 'react';
import { shiftMonth } from '../../core/dates';
import { formatWon } from '../../core/money';
import { RECORD_METHOD_LABEL, TX_TYPE_LABEL } from '../../core/model';
import { useLive, useLookups } from '../hooks';
import { currentMonth, dayLabel, monthLabel, sortTxDesc } from '../format';
import { EMPTY_FILTER, filterTransactions, type TxFilter } from '../filter';
import { PageHeader } from '../components/PageHeader';
import { TxRow } from '../components/TxRow';

export function History() {
  const [month, setMonth] = useState(currentMonth());
  const [f, setF] = useState<TxFilter>(EMPTY_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const lookups = useLookups();
  const data = useLive(async (repo) => ({ txs: await repo.listTransactions(), refunds: await repo.listRefunds() }));
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const list = filterTransactions(data.txs, month, f).sort(sortTxDesc);
  const refunded = new Map<string, number>();
  data.refunds.forEach((r) => refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount));
  const groups = new Map<string, typeof list>();
  list.forEach((t) => groups.set(t.date, [...(groups.get(t.date) ?? []), t]));
  const set = <K extends keyof TxFilter>(k: K, v: TxFilter[K]) => setF({ ...f, [k]: v });
  const activeFilters = [f.type, f.categoryId, f.paymentMethodId, f.recordMethod].filter(Boolean).length;

  return (
    <div className="page">
      <PageHeader title="내역" />
      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>

      <div className="form" style={{ marginTop: 8 }}>
        <label className="field">
          <span className="visually-hidden">검색</span>
          <input type="search" placeholder="가맹점·메모 검색" value={f.query} onChange={(e) => set('query', e.target.value)} />
        </label>
        <button type="button" className="btn" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          필터{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        {showFilters && (
          <div className="form">
            <label className="field"><span>유형</span>
              <select value={f.type} onChange={(e) => set('type', e.target.value as TxFilter['type'])}>
                <option value="">전체</option>
                {(['expense', 'income', 'transfer'] as const).map((t) => <option key={t} value={t}>{TX_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>카테고리</span>
              <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">전체</option>
                {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>결제수단</span>
              <select value={f.paymentMethodId} onChange={(e) => set('paymentMethodId', e.target.value)}>
                <option value="">전체</option>
                {lookups.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="field"><span>기록 방식</span>
              <select value={f.recordMethod} onChange={(e) => set('recordMethod', e.target.value as TxFilter['recordMethod'])}>
                <option value="">전체</option>
                {(['manual', 'auto', 'confirmed'] as const).map((m) => <option key={m} value={m}>{RECORD_METHOD_LABEL[m]}</option>)}
              </select>
            </label>
            <button type="button" className="btn" onClick={() => setF({ ...EMPTY_FILTER, query: f.query })}>필터 초기화</button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <p className="empty">이 달에 해당하는 거래가 없어요.</p>
      ) : (
        [...groups.entries()].map(([date, items]) => {
          const spend = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <section key={date}>
              <div className="day-head"><span>{dayLabel(date)}</span><span>지출 {formatWon(spend)}</span></div>
              <ul className="tx-list">
                {items.map((t) => (
                  <TxRow key={t.id} tx={t} refunded={refunded.get(t.id)} catName={lookups.catName} pmName={lookups.pmName} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
```

`src/ui/App.tsx`의 `<Routes>` 안에 추가 (import도 추가):

```tsx
<Route path="/history" element={<History />} />
<Route path="/tx/new" element={<TxEditor />} />
<Route path="/tx/:id" element={<TxEditor />} />
```

```tsx
import { History } from './screens/History';
import { TxEditor } from './screens/TxEditor';
```

- [ ] **Step 7: 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

Run: `npm run dev` 후 수동 확인
- + 버튼 → 지출 12,000원·식비·현금 저장 → 홈 순지출 12,000원, 최근 거래 1건
- 저장 버튼을 빠르게 두 번 눌러도 1건만 생김
- 금액 0으로 저장 → "금액을 1원 이상 입력하세요"
- 이체 선택 → 카테고리 숨김, 출발·도착 같으면 오류 문구
- 내역 → 거래 눌러 금액 수정 → 홈 합계 갱신
- 상세에서 삭제 → 토스트 "실행 취소" → 거래 복원
- 검색 "식" / 필터 유형=수입 동작, 이전 달 이동

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): 거래 입력·상세·삭제 실행 취소와 내역 검색·필터"
```

---

### Task 13: 통계 + 월 예산 설정

**Files:**
- Create: `src/ui/screens/Stats.tsx`, `src/ui/screens/BudgetSettings.tsx`
- Modify: `src/ui/App.tsx` (Route 추가)

**Interfaces:**
- Consumes: `summarizeMonth`, `monthlyTrend` (Task 9), `shiftMonth` (Task 1), `useLive`, `useLookups`, `useServices`, `PageHeader` (Task 11)
- Produces: 화면만 (다른 Task가 사용하는 인터페이스 없음)

계산은 Task 9에서 테스트했으므로 이 Task는 화면 조립과 수동 확인만 한다.

- [ ] **Step 1: 통계 화면**

`src/ui/screens/Stats.tsx`:

```tsx
import { useState } from 'react';
import { monthlyTrend, summarizeMonth } from '../../core/budget';
import { shiftMonth } from '../../core/dates';
import { formatWon } from '../../core/money';
import { useLive, useLookups } from '../hooks';
import { currentMonth, monthLabel } from '../format';
import { PageHeader } from '../components/PageHeader';

export function Stats() {
  const [month, setMonth] = useState(currentMonth());
  const lookups = useLookups();
  const data = useLive(async (repo) => ({
    txs: await repo.listTransactions(),
    refunds: await repo.listRefunds(),
    budget: await repo.getBudget(month),
  }), [month]);
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget);
  const prev = summarizeMonth(shiftMonth(month, -1), data.txs, data.refunds);
  const diff = s.netSpend - prev.netSpend;
  const trend = monthlyTrend(month, 6, data.txs, data.refunds);
  const maxTrend = Math.max(1, ...trend.map((t) => t.netSpend));
  const positives = s.byCategory.filter((c) => c.amount > 0);

  return (
    <div className="page">
      <PageHeader title="통계" />
      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>

      <section className="card">
        <div className="budget-row"><span>지출</span><strong>{formatWon(s.expense)}</strong></div>
        <div className="budget-row"><span>환불</span><strong className="pos">-{formatWon(s.refund)}</strong></div>
        <div className="budget-row"><span>순지출</span><strong>{formatWon(s.netSpend)}</strong></div>
        <div className="budget-row"><span>수입</span><strong className="pos">{formatWon(s.income)}</strong></div>
        <p className="small muted">
          전월 대비 {diff === 0 ? '변동 없음' : `${diff > 0 ? '▲ 증가' : '▼ 감소'} ${formatWon(Math.abs(diff))}`}
        </p>
      </section>

      <section className="card">
        <h2>카테고리별 소비</h2>
        {s.netSpend <= 0 || positives.length === 0 ? (
          <ul className="list" style={{ marginTop: 8 }}>
            {s.byCategory.length === 0 && <li className="muted">이 달의 지출이 없어요.</li>}
            {s.byCategory.map((c) => (
              <li key={c.categoryId} className="budget-row"><span>{lookups.catName(c.categoryId)}</span><span>{formatWon(c.amount)}</span></li>
            ))}
          </ul>
        ) : (
          positives.map((c) => {
            const pct = Math.round((c.amount / s.netSpend) * 100);
            return (
              <div key={c.categoryId} className="hbar">
                <span>{lookups.catName(c.categoryId)}</span>
                <div className="bar" aria-hidden="true"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <span className="small">{formatWon(c.amount)} · {pct}%</span>
              </div>
            );
          })
        )}
      </section>

      <section className="card">
        <h2>최근 6개월 순지출</h2>
        <svg viewBox="0 0 300 140" width="100%" role="img" aria-label="최근 6개월 순지출 막대 그래프">
          {trend.map((t, i) => {
            const h = Math.max(0, (t.netSpend / maxTrend) * 100);
            const x = 10 + i * 48;
            return (
              <g key={t.month}>
                <rect x={x} y={110 - h} width="32" height={h} rx="4" fill={t.month === month ? 'var(--accent)' : 'var(--line)'} />
                <text x={x + 16} y="128" textAnchor="middle" fontSize="11" fill="var(--muted)">{Number(t.month.slice(5))}월</text>
              </g>
            );
          })}
        </svg>
        <ul className="list small">
          {trend.map((t) => (
            <li key={t.month} className="budget-row"><span>{monthLabel(t.month)}</span><span>{formatWon(t.netSpend)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 예산 설정 화면**

`src/ui/screens/BudgetSettings.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftMonth } from '../../core/dates';
import { formatWon, parseWon } from '../../core/money';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { currentMonth, monthLabel } from '../format';
import { PageHeader } from '../components/PageHeader';

export function BudgetSettings() {
  const month = currentMonth();
  const { repo } = useServices();
  const navigate = useNavigate();
  const data = useLive(async (r) => ({ cur: await r.getBudget(month), prev: await r.getBudget(shiftMonth(month, -1)) }), [month]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.cur) setText(data.cur.total.toLocaleString('ko-KR'));
  }, [data?.cur]);

  if (!data) return <p className="loading">불러오는 중…</p>;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const total = parseWon(text);
    if (total === null || total < 1) {
      setError('예산을 1원 이상 입력하세요');
      return;
    }
    await repo.commit({ budgets: [{ month, total }] });
    navigate(-1);
  };

  return (
    <div className="page">
      <PageHeader title="월 예산" back />
      <form className="form" onSubmit={save} noValidate>
        <label className="field">
          <span>{monthLabel(month)} 전체 예산 (원)</span>
          <input
            inputMode="numeric"
            value={text}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '');
              setText(d ? Number(d).toLocaleString('ko-KR') : '');
            }}
          />
        </label>
        {data.prev && !data.cur && (
          <button type="button" className="btn" onClick={() => setText(data.prev!.total.toLocaleString('ko-KR'))}>
            지난달과 같게 ({formatWon(data.prev.total)})
          </button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">저장</button>
      </form>
      <p className="small muted">예산은 달마다 따로 저장돼요. 카테고리별 예산은 다음 버전에서 제공할 예정이에요.</p>
    </div>
  );
}
```

`src/ui/App.tsx`에 추가:

```tsx
<Route path="/stats" element={<Stats />} />
<Route path="/settings/budget" element={<BudgetSettings />} />
```

```tsx
import { Stats } from './screens/Stats';
import { BudgetSettings } from './screens/BudgetSettings';
```

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

Run: `npm run dev` 수동 확인
- 홈 "이번 달 예산 설정하기" → 500,000 저장 → 홈에 남은 예산·사용률 막대와 % 텍스트
- 지출 합계가 예산 80% 이상이면 "80% 넘음", 초과하면 "예산 초과" 텍스트와 빨간 막대
- 통계: 카테고리 비율 막대, 6개월 그래프와 아래 목록, 전월 대비 문구
- 이체만 있는 달 → 지출 0원, "이 달의 지출이 없어요"

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): 통계 화면과 월 예산 설정"
```

---

### Task 14: 확인함

**Files:**
- Create: `src/ui/screens/Inbox.tsx`, `src/ui/screens/CandidateDetail.tsx`
- Modify: `src/ui/App.tsx` (Route 추가)

**Interfaces:**
- Consumes: `confirmCandidate`, `mergeCandidate`, `linkCandidateRefund`, `ignoreCandidate`, `candidateToInput` (Task 8), `refundableAmount` (Task 6), `REASON_LABEL`, `SOURCE_APP_LABEL`, `REFUND_LOOKBACK_MS` (Task 2), `TxForm`, `TxRow` (Task 11·12), `AppServices.decrypt` (Task 10)
- Produces: 화면만

동작 로직은 Task 8에서 테스트했으므로 이 Task는 화면 조립과 수동 확인만 한다. 수동 확인은 Task 16의 시뮬레이터가 생긴 뒤 다시 한 번 전체 흐름으로 검증한다.

- [ ] **Step 1: 확인함 목록**

`src/ui/screens/Inbox.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { formatWon } from '../../core/money';
import { REASON_LABEL, SOURCE_APP_LABEL } from '../../core/model';
import { useLive } from '../hooks';
import { dayLabel } from '../format';
import { PageHeader } from '../components/PageHeader';

export function Inbox() {
  const list = useLive(async (repo) =>
    (await repo.listCandidates()).filter((c) => c.status === 'pending').sort((a, b) => b.createdAt - a.createdAt),
  );
  if (!list) return <p className="loading">불러오는 중…</p>;

  return (
    <div className="page">
      <PageHeader title="확인함" back />
      <p className="small muted">확인 전 내역은 예산과 통계에 포함되지 않아요. 30일이 지나면 자동으로 지워져요.</p>
      {list.length === 0 ? (
        <p className="empty">확인할 내역이 없어요.</p>
      ) : (
        <ul className="list">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/inbox/${c.id}`} className="item">
                <div>
                  <div>
                    {c.fields.kind === 'cancel' ? '취소·환불' : '결제'} · {c.fields.merchant ?? '가맹점 미확인'}
                  </div>
                  <div className="small muted">
                    {dayLabel(c.fields.date)} · {SOURCE_APP_LABEL[c.sourceApp]}
                  </div>
                  <div className="chips" style={{ marginTop: 4 }}>
                    {c.reasons.map((r) => <span key={r} className="chip chip-warn">{REASON_LABEL[r]}</span>)}
                  </div>
                </div>
                <strong>{c.fields.amount !== undefined ? formatWon(c.fields.amount) : '금액 미확인'}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 후보 상세 (승인·중복·환불 처리)**

`src/ui/screens/CandidateDetail.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  candidateToInput, confirmCandidate, ignoreCandidate, linkCandidateRefund, mergeCandidate,
} from '../../core/actions';
import { txAt } from '../../core/dates';
import { formatWon, parseWon } from '../../core/money';
import type { Candidate, Refund, Transaction } from '../../core/model';
import { REASON_LABEL, REFUND_LOOKBACK_MS, SOURCE_APP_LABEL } from '../../core/model';
import { refundableAmount } from '../../core/refund';
import { useServices } from '../AppContext';
import { useLive, useLookups } from '../hooks';
import { dayLabel, sortTxDesc } from '../format';
import { PageHeader } from '../components/PageHeader';
import { TxForm } from '../components/TxForm';
import { TxRow } from '../components/TxRow';

export function CandidateDetail() {
  const { id = '' } = useParams();
  const services = useServices();
  const navigate = useNavigate();
  const lookups = useLookups();
  const [excerpt, setExcerpt] = useState<string | null>(null);
  const [mode, setMode] = useState<'choose' | 'form'>('choose');
  const data = useLive(async (repo) => ({
    c: await repo.getCandidate(id),
    txs: await repo.listTransactions(),
    refunds: await repo.listRefunds(),
  }), [id]);

  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;
  const { c } = data;
  if (!c || c.status !== 'pending') {
    return (
      <div className="page">
        <PageHeader title="확인함" back />
        <p className="empty">이미 처리했거나 만료된 내역이에요.</p>
      </div>
    );
  }

  const done = () => navigate('/inbox', { replace: true });
  const showExcerpt = async () => {
    try {
      setExcerpt(c.encryptedExcerpt ? await services.decrypt(c.encryptedExcerpt) : '보관된 내용이 없어요.');
    } catch {
      setExcerpt('내용을 열 수 없어요.');
    }
  };
  const dup = c.duplicateOfTxId ? data.txs.find((t) => t.id === c.duplicateOfTxId) : undefined;

  return (
    <div className="page">
      <PageHeader title={c.fields.kind === 'cancel' ? '취소·환불 확인' : '결제 확인'} back />

      <section className="card small">
        <div className="chips">{c.reasons.map((r) => <span key={r} className="chip chip-warn">{REASON_LABEL[r]}</span>)}</div>
        <p>
          {SOURCE_APP_LABEL[c.sourceApp]} · {dayLabel(c.fields.date)} {c.fields.time ?? ''}
          {c.fields.dateFromReceipt ? ' (받은 시각 기준)' : ''}
        </p>
        <p>
          인식한 값: {c.fields.amount !== undefined ? formatWon(c.fields.amount) : '금액 없음'} · {c.fields.merchant ?? '가맹점 없음'} ·{' '}
          {c.fields.paymentMethodId ? lookups.pmName(c.fields.paymentMethodId) : `결제수단 미연결${c.fields.cardName ? ` (${c.fields.cardName}${c.fields.cardLast4 ? ` ${c.fields.cardLast4}` : ''})` : ''}`}
          {c.fields.installment ? ' · 할부' : ''}{c.fields.foreign ? ' · 외화' : ''}
        </p>
        {excerpt === null ? (
          <button type="button" className="btn" onClick={showExcerpt}>알림 내용 보기</button>
        ) : (
          <pre className="excerpt">{excerpt}</pre>
        )}
      </section>

      {c.fields.kind === 'approval' ? (
        <>
          {dup && mode === 'choose' && (
            <section className="card">
              <h2>이미 기록된 거래</h2>
              <ul className="tx-list" style={{ margin: '8px 0' }}>
                <TxRow tx={dup} catName={lookups.catName} pmName={lookups.pmName} />
              </ul>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={async () => { await mergeCandidate(c.id, services.deps); done(); }}>
                  같은 거래예요
                </button>
                <button type="button" className="btn" onClick={() => setMode('form')}>다른 거래로 저장</button>
              </div>
            </section>
          )}
          {(!dup || mode === 'form') && (
            <TxForm
              initial={candidateToInput(c)}
              submitLabel="확인하고 저장"
              onSubmit={async (i) => { await confirmCandidate(c.id, i, services.deps); done(); }}
            />
          )}
        </>
      ) : (
        <RefundLink c={c} txs={data.txs} refunds={data.refunds} onDone={done} />
      )}

      <button
        type="button"
        className="btn btn-danger"
        style={{ width: '100%', marginTop: 16 }}
        onClick={async () => { await ignoreCandidate(c.id, services.deps); done(); }}
      >
        무시하기
      </button>
    </div>
  );
}

function RefundLink({ c, txs, refunds, onDone }: {
  c: Candidate; txs: Transaction[]; refunds: Refund[]; onDone: () => void;
}) {
  const services = useServices();
  const lookups = useLookups();
  const at = txAt(c.fields.date, c.fields.time);
  const options = (c.refundCandidateTxIds?.length
    ? txs.filter((t) => c.refundCandidateTxIds!.includes(t.id))
    : txs.filter((t) => t.type === 'expense' && at - txAt(t.date, t.time) <= REFUND_LOOKBACK_MS && txAt(t.date, t.time) <= at + 120_000)
  ).sort(sortTxDesc).slice(0, 50);
  const [selected, setSelected] = useState(options.length === 1 ? options[0].id : '');
  const [amount, setAmount] = useState(c.fields.amount ? c.fields.amount.toLocaleString('ko-KR') : '');
  const [date, setDate] = useState(c.fields.date);
  const [error, setError] = useState<string | null>(null);
  if (!lookups) return null;

  const submit = async () => {
    const amt = parseWon(amount);
    if (!selected) return setError('원거래를 선택하세요');
    if (amt === null || amt < 1) return setError('환불 금액을 확인하세요');
    try {
      await linkCandidateRefund(c.id, selected, amt, date, services.deps);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결하지 못했어요');
    }
  };

  return (
    <section className="card form">
      <h2>원거래 선택</h2>
      {options.length === 0 ? (
        <p className="muted">최근 90일 안에 연결할 지출이 없어요. 무시하거나 거래를 먼저 기록해 주세요.</p>
      ) : (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visually-hidden">원거래</legend>
          {options.map((t) => (
            <label key={t.id} className="row" style={{ alignItems: 'center', padding: '6px 0' }}>
              <input type="radio" name="orig" style={{ flex: 'none' }} checked={selected === t.id} onChange={() => setSelected(t.id)} />
              <span>
                {dayLabel(t.date)} {t.time ?? ''} · {t.merchant ?? lookups.catName(t.categoryId)} · {lookups.pmName(t.paymentMethodId)}
                <br />
                <span className="small muted">결제 {formatWon(t.amount)} · 환불 가능 {formatWon(refundableAmount(t, refunds))}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="row">
        <label className="field"><span>환불 금액 (원)</span>
          <input inputMode="numeric" value={amount} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setAmount(d ? Number(d).toLocaleString('ko-KR') : ''); }} />
        </label>
        <label className="field"><span>환불 날짜</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={submit} disabled={options.length === 0}>환불 연결</button>
    </section>
  );
}
```

`src/ui/App.tsx`에 추가:

```tsx
<Route path="/inbox" element={<Inbox />} />
<Route path="/inbox/:id" element={<CandidateDetail />} />
```

```tsx
import { Inbox } from './screens/Inbox';
import { CandidateDetail } from './screens/CandidateDetail';
```

- [ ] **Step 3: 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

Run: `npm run dev` → `#/inbox` 접속 → "확인할 내역이 없어요" 표시. (후보 처리 흐름은 Task 16 시뮬레이터로 확인)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): 확인함 목록과 후보 저장·합치기·환불 연결·무시"
```

---

### Task 15: 설정 · 카테고리/결제수단 관리 · 자동 기록 설정 · 첫 실행

**Files:**
- Create: `src/ui/screens/Settings.tsx`, `src/ui/screens/ManageList.tsx`, `src/ui/screens/AutoRecordSettings.tsx`, `src/ui/screens/Onboarding.tsx`, `src/ui/sources.ts`
- Modify: `src/ui/App.tsx` (Route 추가, 첫 실행 게이트)
- Test: `tests/ui/sources.test.ts`

**Interfaces:**
- Consumes: `FORMAT_RULES` (Task 3), 모델·상수 (Task 2), `useLive`, `useServices`, `PageHeader` (Task 11)
- Produces:
  - `AUTO_APPS: SourceApp[]` (`['sms', 'kakaotalk', 'payapp']`)
  - `sourcesToForm(allowed: AllowedSource[]): Record<string, { on: boolean; senders: string }>`
  - `formToSources(form): AllowedSource[]`
  - `enableAutoRecord(repo: Repo, saveMode?: SaveMode): Promise<void>` — 권한(웹 모의) 허용 + 기본 출처 3개 + 켜기
  - `/settings` 허브는 Task 16 화면(`/settings/paste`, `/settings/simulator`, `/settings/lock`, `/settings/export`, `/settings/wipe`)으로 가는 링크를 미리 포함한다

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/sources.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sourcesToForm, formToSources, enableAutoRecord } from '../../src/ui/sources';
import { createMemoryRepo } from '../../src/data/memoryRepo';

describe('allowed sources form', () => {
  it('round-trips app toggles and sender lists', () => {
    const form = sourcesToForm([{ app: 'sms', sender: '1588' }, { app: 'sms', sender: '1599' }, { app: 'kakaotalk' }]);
    expect(form).toEqual({
      sms: { on: true, senders: '1588, 1599' },
      kakaotalk: { on: true, senders: '' },
      payapp: { on: false, senders: '' },
    });
    expect(formToSources(form)).toEqual([{ app: 'sms', sender: '1588' }, { app: 'sms', sender: '1599' }, { app: 'kakaotalk' }]);
  });
  it('enableAutoRecord grants mock permission with default sources', async () => {
    const repo = createMemoryRepo();
    await enableAutoRecord(repo, 'review_all');
    expect(await repo.getAutoSettings()).toMatchObject({
      enabled: true, permission: 'granted', saveMode: 'review_all',
      allowedSources: [{ app: 'sms' }, { app: 'kakaotalk' }, { app: 'payapp' }],
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ui/sources.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 출처 폼 유틸**

`src/ui/sources.ts`:

```ts
import type { AllowedSource, SaveMode, SourceApp } from '../core/model';
import type { Repo } from '../core/repo';

export const AUTO_APPS: SourceApp[] = ['sms', 'kakaotalk', 'payapp'];

export type SourcesForm = Record<string, { on: boolean; senders: string }>;

export function sourcesToForm(allowed: AllowedSource[]): SourcesForm {
  const form: SourcesForm = {};
  for (const app of AUTO_APPS) {
    const rows = allowed.filter((s) => s.app === app);
    form[app] = { on: rows.length > 0, senders: rows.flatMap((r) => (r.sender ? [r.sender] : [])).join(', ') };
  }
  return form;
}

export function formToSources(form: SourcesForm): AllowedSource[] {
  return AUTO_APPS.flatMap((app) => {
    const f = form[app];
    if (!f?.on) return [];
    const senders = f.senders.split(',').map((s) => s.trim()).filter(Boolean);
    return senders.length ? senders.map((sender) => ({ app, sender })) : [{ app }];
  });
}

export async function enableAutoRecord(repo: Repo, saveMode: SaveMode = 'auto'): Promise<void> {
  const s = await repo.getAutoSettings();
  await repo.commit({
    autoSettings: {
      ...s,
      enabled: true,
      permission: 'granted',
      saveMode,
      allowedSources: s.allowedSources.length ? s.allowedSources : AUTO_APPS.map((app) => ({ app })),
    },
  });
}
```

- [ ] **Step 4: 구현 — 설정 허브**

`src/ui/screens/Settings.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

const ITEMS = [
  { to: '/settings/budget', label: '월 예산' },
  { to: '/settings/auto', label: '자동 기록' },
  { to: '/settings/categories', label: '카테고리' },
  { to: '/settings/methods', label: '결제수단' },
  { to: '/settings/paste', label: '알림 내용 붙여넣기 분석' },
  { to: '/settings/simulator', label: '알림 시뮬레이터 (테스트용)' },
  { to: '/settings/lock', label: '앱 잠금' },
  { to: '/settings/export', label: 'CSV 내보내기' },
  { to: '/settings/wipe', label: '전체 데이터 삭제' },
];

export function Settings() {
  return (
    <div className="page">
      <PageHeader title="설정" />
      <ul className="list">
        {ITEMS.map((i) => (
          <li key={i.to}><Link to={i.to} className="item"><span>{i.label}</span><span aria-hidden="true">›</span></Link></li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: 16 }}>
        모든 데이터는 이 기기의 브라우저 저장소에만 저장되고 외부로 전송되지 않아요. 브라우저 데이터를 지우거나 기기를 잃어버리면 복원할 수 없어요.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: 구현 — 카테고리·결제수단 관리**

`src/ui/screens/ManageList.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { Category, PaymentMethod } from '../../core/model';
import { UNCATEGORIZED_ID } from '../../core/model';
import { useServices } from '../AppContext';
import { useLookups } from '../hooks';
import { PageHeader } from '../components/PageHeader';

const CAT_KINDS = { expense: '지출', income: '수입' } as const;
const PM_KINDS = { card: '카드', pay: '간편결제', account: '계좌', cash: '현금' } as const;

export function ManageList({ target }: { target: 'categories' | 'methods' }) {
  const { repo, deps } = useServices();
  const lookups = useLookups();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>(target === 'categories' ? 'expense' : 'card');
  const [error, setError] = useState<string | null>(null);
  if (!lookups) return <p className="loading">불러오는 중…</p>;

  const isCat = target === 'categories';
  const items: (Category | PaymentMethod)[] = isCat ? lookups.categories : lookups.methods;
  const kinds: Record<string, string> = isCat ? CAT_KINDS : PM_KINDS;
  const save = (item: Category | PaymentMethod) =>
    repo.commit(isCat ? { categories: [item as Category] } : { paymentMethods: [item as PaymentMethod] });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('이름을 입력하세요');
    if (items.some((i) => i.name === n && i.kind === kind && !i.archived)) return setError('같은 이름이 이미 있어요');
    const base = { id: deps.newId(), name: n, sortOrder: Math.max(0, ...items.map((i) => i.sortOrder)) + 1, archived: false };
    await save(isCat
      ? { ...base, kind: kind as Category['kind'] }
      : { ...base, kind: kind as PaymentMethod['kind'], matchKeys: [] });
    setName('');
    setError(null);
  };

  const rename = async (item: Category | PaymentMethod) => {
    const n = window.prompt('새 이름', item.name)?.trim();
    if (n) await save({ ...item, name: n });
  };

  const editKeys = async (pm: PaymentMethod) => {
    const v = window.prompt('알림 매칭 키 (쉼표로 구분, 예: 가나카드*1234, 마바페이)', pm.matchKeys.join(', '));
    if (v !== null) await save({ ...pm, matchKeys: v.split(',').map((s) => s.trim()).filter(Boolean) });
  };

  const render = (list: (Category | PaymentMethod)[]) => (
    <ul className="list">
      {list.map((i) => (
        <li key={i.id}>
          <div className="budget-row">
            <span>
              {i.name} <span className="small muted">{kinds[i.kind]}</span>
              {!isCat && (i as PaymentMethod).matchKeys.length > 0 && (
                <span className="small muted"> · 매칭: {(i as PaymentMethod).matchKeys.join(', ')}</span>
              )}
            </span>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn" onClick={() => rename(i)}>이름 수정</button>
            {!isCat && i.kind !== 'cash' && (
              <button type="button" className="btn" onClick={() => editKeys(i as PaymentMethod)}>매칭 키</button>
            )}
            {i.id !== UNCATEGORIZED_ID && (
              <button type="button" className="btn" onClick={() => save({ ...i, archived: !i.archived })}>
                {i.archived ? '보관 해제' : '보관'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page">
      <PageHeader title={isCat ? '카테고리' : '결제수단'} back />
      <form className="form card" onSubmit={add} noValidate>
        <div className="row">
          <label className="field"><span>이름</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>종류</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">추가</button>
      </form>
      {render(items.filter((i) => !i.archived))}
      {items.some((i) => i.archived) && (
        <>
          <h2 style={{ margin: '20px 0 8px' }}>보관됨</h2>
          <p className="small muted">보관해도 기존 거래 내역은 그대로 남아요.</p>
          {render(items.filter((i) => i.archived))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 구현 — 자동 기록 설정**

`src/ui/screens/AutoRecordSettings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { AutoRecordSettings as Settings, PermissionState, SaveMode } from '../../core/model';
import { SOURCE_APP_LABEL } from '../../core/model';
import { FORMAT_RULES } from '../../core/parser';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { timeLabel } from '../format';
import { AUTO_APPS, formToSources, sourcesToForm, type SourcesForm } from '../sources';
import { PageHeader } from '../components/PageHeader';

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: '허용됨',
  denied: '거절됨 — 휴대폰 설정에서 허용해야 해요',
  revoked: '해제됨 — 휴대폰 설정에서 다시 허용해야 해요',
  unknown: '아직 요청하지 않았어요',
};

export function AutoRecordSettings() {
  const { repo } = useServices();
  const s = useLive((r) => r.getAutoSettings());
  const [form, setForm] = useState<SourcesForm | null>(null);
  useEffect(() => {
    if (s && !form) setForm(sourcesToForm(s.allowedSources));
  }, [s, form]);
  if (!s || !form) return <p className="loading">불러오는 중…</p>;

  const save = (patch: Partial<Settings>) => repo.commit({ autoSettings: { ...s, ...patch } });
  const setPermission = (permission: PermissionState) => save({ permission });
  const updateForm = (next: SourcesForm) => {
    setForm(next);
    void save({ allowedSources: formToSources(next) });
  };
  const status = !s.enabled ? '꺼짐' : s.permission !== 'granted' ? '권한 문제로 멈춤' : '켜짐';

  return (
    <div className="page">
      <PageHeader title="자동 기록" back />

      <section className="card small">
        <p><strong>무엇을 하나요?</strong> 문자·카카오톡·간편결제 앱의 결제 알림에서 금액·가맹점·결제수단·시각을 읽어 가계부에 기록해요.</p>
        <p>알림 접근을 허용하면 다른 알림도 앱에 전달될 수 있어요. 허용한 출처의 결제 알림만 분석하고 나머지는 즉시 버려요. 분석과 저장은 모두 이 기기 안에서만 이뤄져요.</p>
        <p className="muted">웹 버전은 다른 앱의 알림을 받을 수 없어요. 아래 권한은 안드로이드 동작을 흉내 내는 테스트용이고, 실제 입력은 붙여넣기·시뮬레이터로 해요.</p>
      </section>

      <section className="card form">
        <p>상태: <strong>{status}</strong></p>
        <p>알림 접근 권한(모의): <strong>{PERMISSION_LABEL[s.permission]}</strong></p>
        <div className="row">
          <button type="button" className="btn" onClick={() => setPermission('granted')}>권한 허용</button>
          <button type="button" className="btn" onClick={() => setPermission('revoked')}>권한 해제</button>
        </div>
        <label className="row" style={{ alignItems: 'center' }}>
          <input
            type="checkbox"
            style={{ flex: 'none', width: 22, height: 22 }}
            checked={s.enabled}
            disabled={s.permission !== 'granted'}
            onChange={(e) => save({ enabled: e.target.checked })}
          />
          <span>자동 기록 사용{s.permission !== 'granted' ? ' (먼저 권한을 허용하세요)' : ''}</span>
        </label>
        <p className="small muted">
          마지막 처리: {s.lastProcessedAt ? timeLabel(s.lastProcessedAt) : '없음'}. 결제가 없으면 알림도 오지 않으므로, 처리 기록이 없다고 해서 오류는 아니에요.
        </p>
      </section>

      <section className="card form">
        <h2>기록할 출처</h2>
        {AUTO_APPS.map((app) => (
          <div key={app} className="form" style={{ gap: 6 }}>
            <label className="row" style={{ alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ flex: 'none', width: 22, height: 22 }}
                checked={form[app].on}
                onChange={(e) => updateForm({ ...form, [app]: { ...form[app], on: e.target.checked } })}
              />
              <span>{SOURCE_APP_LABEL[app]}</span>
            </label>
            {form[app].on && (
              <label className="field">
                <span>발신자 제한 (선택, 쉼표로 구분 · 비우면 전체)</span>
                <input
                  value={form[app].senders}
                  onChange={(e) => setForm({ ...form, [app]: { ...form[app], senders: e.target.value } })}
                  onBlur={() => updateForm(form)}
                />
              </label>
            )}
          </div>
        ))}
        <p className="small muted">출처를 꺼도 이미 기록된 거래는 그대로 남아요.</p>
      </section>

      <section className="card form">
        <h2>저장 방식</h2>
        {(['auto', 'review_all'] as SaveMode[]).map((m) => (
          <label key={m} className="row" style={{ alignItems: 'center' }}>
            <input type="radio" name="saveMode" style={{ flex: 'none' }} checked={s.saveMode === m} onChange={() => save({ saveMode: m })} />
            <span>{m === 'auto' ? '확실한 내역은 자동 저장 (불확실하면 확인함)' : '모든 내역 확인 후 저장'}</span>
          </label>
        ))}
        <p className="small muted">변경 내용은 이후에 받는 알림부터 적용돼요.</p>
      </section>

      <section className="card">
        <h2>지원하는 알림 형식</h2>
        <p className="small muted">개발용 가상 형식이에요. 실제 카드사 형식은 안드로이드 버전에서 검증 후 추가돼요. 할부·외화·형식 밖 알림은 항상 확인함으로 가요.</p>
        <ul className="list small">
          {FORMAT_RULES.map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong> · {r.apps.map((a) => SOURCE_APP_LABEL[a]).join(', ')}
              <pre className="excerpt">{r.example}</pre>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: 구현 — 첫 실행**

`src/ui/screens/Onboarding.tsx`:

```tsx
import { useState } from 'react';
import { parseWon } from '../../core/money';
import { useServices } from '../AppContext';
import { currentMonth } from '../format';
import { enableAutoRecord } from '../sources';

export function Onboarding() {
  const { repo } = useServices();
  const [step, setStep] = useState<'intro' | 'auto' | 'budget'>('intro');
  const [budget, setBudget] = useState('');

  const finish = async (withBudget: boolean) => {
    const total = parseWon(budget);
    const app = await repo.getAppSettings();
    await repo.commit({
      appSettings: { ...app, onboarded: true },
      budgets: withBudget && total ? [{ month: currentMonth(), total }] : [],
    });
  };

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      {step === 'intro' && (
        <section className="form">
          <h1>결제 알림이 오면 가계부가 알아서 적어요</h1>
          <p>문자·카카오톡·간편결제 앱의 결제 알림을 읽어 자동으로 기록하고, 이번 달 남은 예산을 알려드려요.</p>
          <p className="small muted">가입 없이 이 기기에만 저장돼요. 자동 기록 없이 직접 입력만 해도 쓸 수 있어요.</p>
          <button type="button" className="btn btn-primary" onClick={() => setStep('auto')}>자동 기록 설정하기</button>
          <button type="button" className="btn" onClick={() => setStep('budget')}>건너뛰기</button>
        </section>
      )}
      {step === 'auto' && (
        <section className="form">
          <h1>자동 기록 설정</h1>
          <p>허용한 출처(문자·카카오톡·간편결제 앱)의 결제 알림만 분석하고, 나머지 알림은 즉시 버려요. 분석과 저장은 이 기기 안에서만 이뤄져요.</p>
          <p className="small muted">웹 버전에서는 권한이 모의로 허용되고, 실제 알림 대신 붙여넣기·시뮬레이터로 입력해요.</p>
          <button type="button" className="btn btn-primary" onClick={async () => { await enableAutoRecord(repo); setStep('budget'); }}>
            허용하고 계속
          </button>
          <button type="button" className="btn" onClick={() => setStep('budget')}>나중에 하기</button>
        </section>
      )}
      {step === 'budget' && (
        <section className="form">
          <h1>이번 달 예산</h1>
          <label className="field">
            <span>한 달 생활비 예산 (원)</span>
            <input
              inputMode="numeric"
              value={budget}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setBudget(d ? Number(d).toLocaleString('ko-KR') : ''); }}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={!parseWon(budget)} onClick={() => finish(true)}>시작하기</button>
          <button type="button" className="btn" onClick={() => finish(false)}>건너뛰기</button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 8: App에 Route와 첫 실행 게이트 추가**

`src/ui/App.tsx` 전체를 다음으로 교체 (Task 11~14의 Route 포함, 이후 Task 16이 Route와 잠금 게이트를 추가):

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { useLive } from './hooks';
import { AutoRecordSettings } from './screens/AutoRecordSettings';
import { BudgetSettings } from './screens/BudgetSettings';
import { CandidateDetail } from './screens/CandidateDetail';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { ManageList } from './screens/ManageList';
import { Onboarding } from './screens/Onboarding';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';
import { TxEditor } from './screens/TxEditor';

export default function App() {
  const app = useLive((r) => r.getAppSettings());
  if (!app) return <p className="loading">불러오는 중…</p>;
  if (!app.onboarded) return <Onboarding />;

  return (
    <HashRouter>
      <UndoProvider>
        <div className="app">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/history" element={<History />} />
              <Route path="/tx/new" element={<TxEditor />} />
              <Route path="/tx/:id" element={<TxEditor />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/inbox/:id" element={<CandidateDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/budget" element={<BudgetSettings />} />
              <Route path="/settings/auto" element={<AutoRecordSettings />} />
              <Route path="/settings/categories" element={<ManageList key="c" target="categories" />} />
              <Route path="/settings/methods" element={<ManageList key="m" target="methods" />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
```

- [ ] **Step 9: 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS

Run: 브라우저 개발자 도구에서 IndexedDB `gagyebu` 삭제 후 `npm run dev`
- 첫 실행 화면 → "자동 기록 설정하기" → "허용하고 계속" → 예산 500,000 → 홈. 홈 상태 "자동 기록 켜짐 · 아직 처리한 알림 없음"
- 다시 삭제 후 "건너뛰기" 두 번 → 홈에 "자동 기록 꺼짐", 수동 입력 정상
- 설정 → 카테고리 추가·이름 수정·보관 → 보관된 카테고리는 새 거래 선택지에서 사라지고 기존 거래 표시는 유지
- 결제수단 → 매칭 키 편집
- 자동 기록 → 권한 해제 → 상태 "권한 문제로 멈춤", 체크박스 비활성, 홈 상태 "알림 접근 권한이 필요해요" → 권한 허용 시 다시 "켜짐"

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(ui): 설정, 카테고리·결제수단 관리, 자동 기록 설정, 첫 실행"
```

---

### Task 16: 붙여넣기 분석 · 알림 시뮬레이터 · 앱 잠금 · CSV 내보내기 · 전체 삭제 · PWA

**Files:**
- Create: `src/ui/presets.ts`, `src/ui/screens/PasteAnalyze.tsx`, `src/ui/screens/Simulator.tsx`, `src/ui/screens/LockSettings.tsx`, `src/ui/screens/LockScreen.tsx`, `src/ui/screens/ExportCsv.tsx`, `src/ui/screens/Wipe.tsx`, `public/icon.svg`
- Modify: `src/ui/App.tsx` (Route 5개 + 잠금 게이트), `vite.config.ts` (PWA)
- Test: `tests/ui/presets.test.ts`

**Interfaces:**
- Consumes: `ingestSafely` (Task 7), `IngestResult` (Task 7), `sampleCardMethods` (Task 10), `hashPin`, `verifyPin` (Task 10), `wipeAllData` (Task 10), `toCsv` (Task 9), `parseNotification` (Task 3)
- Produces:
  - `Preset { id: string; label: string; sourceApp: SourceApp; text: string }`
  - `buildPresets(now: Date): Preset[]`
  - `OUTCOME_LABEL: Record<string, string>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPresets } from '../../src/ui/presets';
import { parseNotification } from '../../src/core/parser';

describe('simulator presets', () => {
  const presets = buildPresets(new Date(2026, 9, 15, 9, 5));
  const get = (id: string) => presets.find((p) => p.id === id)!;

  it('uses the given date and time', () => {
    expect(get('sms-approve').text).toContain('10/15 09:05');
    expect(get('pay-approve').text).toContain('10월 15일 09:05');
  });
  it('each preset parses as intended', () => {
    const status = (id: string) => parseNotification(get(id).text, get(id).sourceApp).status;
    for (const id of ['sms-approve', 'kakao-approve', 'sms-cancel', 'kakao-cancel', 'sms-partial', 'pay-approve', 'sms-dara']) {
      expect(status(id), id).toBe('tx');
    }
    expect(status('sms-installment')).toBe('tx');
    expect(status('sms-unknown')).toBe('unsupported');
    for (const id of ['ad', 'otp', 'bill']) expect(status(id), id).toBe('non_tx');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ui/presets.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 프리셋**

`src/ui/presets.ts`:

```ts
import type { SourceApp } from '../core/model';

export interface Preset {
  id: string;
  label: string;
  sourceApp: SourceApp;
  text: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function buildPresets(now: Date): Preset[] {
  const md = `${now.getMonth() + 1}/${now.getDate()}`;
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const kor = `${now.getMonth() + 1}월 ${now.getDate()}일 ${hm}`;
  return [
    { id: 'sms-approve', label: '문자 승인 12,000원', sourceApp: 'sms', text: `[Web발신]\n가나카드(1234)승인 홍*동 12,000원 일시불 ${md} ${hm} 스타벅스 누적 345,000원` },
    { id: 'kakao-approve', label: '카톡 승인 (같은 결제)', sourceApp: 'kakaotalk', text: `가나카드 결제 승인\n금액: 12,000원\n가맹점: 스타벅스\n일시: ${md} ${hm}\n카드: 가나(1234)` },
    { id: 'sms-cancel', label: '문자 전액 취소', sourceApp: 'sms', text: `[Web발신]\n가나카드(1234)취소 홍*동 12,000원 ${md} ${hm} 스타벅스` },
    { id: 'kakao-cancel', label: '카톡 전액 취소 (같은 취소)', sourceApp: 'kakaotalk', text: `가나카드 결제 취소\n금액: 12,000원\n가맹점: 스타벅스\n일시: ${md} ${hm}\n카드: 가나(1234)` },
    { id: 'sms-partial', label: '문자 부분 환불 5,000원', sourceApp: 'sms', text: `[Web발신]\n가나카드(1234)취소 홍*동 5,000원 ${md} ${hm} 스타벅스` },
    { id: 'sms-dara', label: '다라카드 편의점 (승인번호)', sourceApp: 'sms', text: `다라카드 승인 5678 8,500원 ${md} ${hm} GS25역삼점 승인번호 ${now.getTime() % 100000000}` },
    { id: 'pay-approve', label: '마바페이 결제', sourceApp: 'payapp', text: `마바페이 결제 완료 9,900원 · 올리브영 · ${kor}` },
    { id: 'sms-installment', label: '할부 결제 (확인함)', sourceApp: 'sms', text: `[Web발신]\n가나카드(1234)승인 홍*동 600,000원 3개월 ${md} ${hm} 전자랜드` },
    { id: 'sms-unknown', label: '지원하지 않는 형식', sourceApp: 'sms', text: `라마카드 사용 23,000원 올리브영` },
    { id: 'ad', label: '광고', sourceApp: 'sms', text: '(광고) 가나카드 10월 이벤트 최대 5,000원 캐시백' },
    { id: 'otp', label: '인증번호', sourceApp: 'sms', text: '[가나카드] 인증번호 [482913]를 입력해주세요' },
    { id: 'bill', label: '카드대금 출금', sourceApp: 'sms', text: '가나카드 10월 결제대금 345,000원 출금 완료' },
  ];
}

export const OUTCOME_LABEL: Record<string, string> = {
  saved: '자동 저장됨',
  merged: '기존 기록에 출처 추가 (중복 방지)',
  candidate: '확인함으로 보냄',
  ignored_non_tx: '거래 알림 아님 — 무시',
  refund_linked: '원거래에 환불 연결',
  dropped: '수집 대상 아님 — 폐기 (자동 기록 꺼짐·권한 없음·출처 제외)',
  already_processed: '이미 처리한 알림 — 다시 처리하지 않음',
  queued: '저장 실패 — 대기열에 보관, 다음 실행 때 재처리',
};
```

- [ ] **Step 4: 구현 — 붙여넣기 분석**

`src/ui/screens/PasteAnalyze.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ingestSafely } from '../../core/pipeline/ingest';
import { useServices } from '../AppContext';
import { PageHeader } from '../components/PageHeader';

export function PasteAnalyze() {
  const { deps } = useServices();
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const r = await ingestSafely(
      { sourceApp: 'paste', text, receivedAt: deps.now(), notificationKey: `paste-${deps.newId()}` },
      deps,
      { paste: true },
    );
    setBusy(false);
    setText('');
    setResult(r.outcome === 'candidate' ? 'candidate' : r.outcome === 'ignored_non_tx' ? 'non_tx' : 'queued');
  };

  return (
    <div className="page">
      <PageHeader title="붙여넣기 분석" back />
      <p className="small muted">결제 문자나 카톡 알림 내용을 붙여넣으면 거래 후보를 만들어 확인함에 넣어요. 붙여넣은 내용만 분석하고 클립보드를 따로 읽지 않아요.</p>
      <div className="form">
        <label className="field">
          <span>알림 내용</span>
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스" />
        </label>
        <button type="button" className="btn btn-primary" disabled={!text.trim() || busy} onClick={analyze}>분석하기</button>
      </div>
      {result === 'candidate' && <p role="status">확인함에 추가했어요. <Link to="/inbox">확인함으로 가기</Link></p>}
      {result === 'non_tx' && <p role="status">결제·취소 알림이 아니라서 기록하지 않았어요.</p>}
      {result === 'queued' && <p role="status">지금은 저장하지 못해 보관해 두었어요. 앱을 다시 열면 처리돼요.</p>}
    </div>
  );
}
```

- [ ] **Step 5: 구현 — 알림 시뮬레이터**

`src/ui/screens/Simulator.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { SourceApp } from '../../core/model';
import { SOURCE_APP_LABEL } from '../../core/model';
import { ingestSafely } from '../../core/pipeline/ingest';
import { sampleCardMethods } from '../../data/seed';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { buildPresets, OUTCOME_LABEL } from '../presets';
import { AUTO_APPS } from '../sources';
import { PageHeader } from '../components/PageHeader';

export function Simulator() {
  const { deps, repo } = useServices();
  const auto = useLive((r) => r.getAutoSettings());
  const presets = useMemo(() => buildPresets(new Date()), []);
  const [sourceApp, setSourceApp] = useState<SourceApp>('sms');
  const [sender, setSender] = useState('');
  const [key, setKey] = useState(() => deps.newId());
  const [text, setText] = useState(presets[0].text);
  const [log, setLog] = useState<{ at: string; line: string }[]>([]);

  const send = async (reuseKey: boolean) => {
    const notificationKey = reuseKey ? key : deps.newId();
    setKey(notificationKey);
    const r = await ingestSafely({ sourceApp, sender: sender.trim() || undefined, text, receivedAt: Date.now(), notificationKey }, deps);
    const line = `${SOURCE_APP_LABEL[sourceApp]} · ${OUTCOME_LABEL[r.outcome] ?? r.outcome}`;
    setLog((l) => [{ at: new Date().toLocaleTimeString('ko-KR'), line }, ...l].slice(0, 20));
  };

  const addSamples = async () => {
    const added = sampleCardMethods(await repo.listPaymentMethods());
    await repo.commit({ paymentMethods: added });
    setLog((l) => [{ at: new Date().toLocaleTimeString('ko-KR'), line: added.length ? `샘플 결제수단 ${added.length}개 추가` : '샘플 결제수단이 이미 있어요' }, ...l]);
  };

  const off = auto && (!auto.enabled || auto.permission !== 'granted');

  return (
    <div className="page">
      <PageHeader title="알림 시뮬레이터" back />
      <p className="small muted">
        안드로이드에서 알림을 받는 상황을 흉내 내 전체 처리 과정(수집 대상 확인 → 분석 → 중복 검사 → 자동 저장/확인함)을 시험해요. 실제 거래로 저장되니 시험 후 내역에서 지우세요.
      </p>
      {off && <p className="error">자동 기록이 꺼져 있거나 권한이 없어 보낸 알림이 폐기돼요. 설정 → 자동 기록에서 켜세요.</p>}
      <button type="button" className="btn" onClick={addSamples}>샘플 결제수단(가나카드·다라카드·마바페이) 추가</button>

      <h2 style={{ margin: '16px 0 8px' }}>프리셋</h2>
      <div className="chips">
        {presets.map((p) => (
          <button key={p.id} type="button" className="btn" onClick={() => { setSourceApp(p.sourceApp); setText(p.text); }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="form" style={{ marginTop: 16 }}>
        <div className="row">
          <label className="field"><span>출처 앱</span>
            <select value={sourceApp} onChange={(e) => setSourceApp(e.target.value as SourceApp)}>
              {AUTO_APPS.map((a) => <option key={a} value={a}>{SOURCE_APP_LABEL[a]}</option>)}
            </select>
          </label>
          <label className="field"><span>발신자 (선택)</span><input value={sender} onChange={(e) => setSender(e.target.value)} /></label>
        </div>
        <label className="field"><span>알림 내용</span><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => send(false)}>새 알림으로 보내기</button>
          <button type="button" className="btn" onClick={() => send(true)}>같은 알림 다시 보내기</button>
        </div>
        <p className="small muted">"같은 알림 다시 보내기"는 직전 알림 키를 재사용해 재전달·내용 갱신 상황을 흉내 내요.</p>
      </div>

      <h2 style={{ margin: '16px 0 8px' }}>결과</h2>
      {log.length === 0 ? <p className="muted">아직 보낸 알림이 없어요.</p> : (
        <ul className="list small" aria-live="polite">
          {log.map((l, i) => <li key={i}>{l.at} · {l.line}</li>)}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 구현 — 앱 잠금**

`src/ui/screens/LockSettings.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hashPin, verifyPin } from '../../data/crypto';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { PageHeader } from '../components/PageHeader';

const PIN_RE = /^\d{4,6}$/;

export function LockSettings() {
  const { repo } = useServices();
  const navigate = useNavigate();
  const app = useLive((r) => r.getAppSettings());
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!app) return <p className="loading">불러오는 중…</p>;

  const enable = async () => {
    if (!PIN_RE.test(pin)) return setError('숫자 4~6자리로 입력하세요');
    if (pin !== pin2) return setError('두 PIN이 달라요');
    const { hash, salt } = await hashPin(pin);
    await repo.commit({ appSettings: { ...app, lockEnabled: true, pinHash: hash, pinSalt: salt } });
    navigate(-1);
  };
  const disable = async () => {
    if (!app.pinHash || !app.pinSalt || !(await verifyPin(pin, app.pinHash, app.pinSalt))) return setError('PIN이 맞지 않아요');
    await repo.commit({ appSettings: { ...app, lockEnabled: false, pinHash: undefined, pinSalt: undefined } });
    navigate(-1);
  };
  const pinInput = (label: string, v: string, set: (s: string) => void) => (
    <label className="field"><span>{label}</span>
      <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={v} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} />
    </label>
  );

  return (
    <div className="page">
      <PageHeader title="앱 잠금" back />
      <div className="form">
        {app.lockEnabled ? (
          <>
            <p>앱 잠금이 켜져 있어요. 끄려면 현재 PIN을 입력하세요.</p>
            {pinInput('현재 PIN', pin, setPin)}
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn btn-danger" onClick={disable}>잠금 끄기</button>
          </>
        ) : (
          <>
            <p>앱을 열 때와 다른 앱에 다녀왔을 때 PIN을 물어봐요.</p>
            {pinInput('새 PIN (숫자 4~6자리)', pin, setPin)}
            {pinInput('PIN 확인', pin2, setPin2)}
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary" onClick={enable}>잠금 켜기</button>
          </>
        )}
        <p className="small muted">PIN을 잊으면 브라우저 데이터를 지워야 해요. 이때 가계부 데이터도 함께 지워져요.</p>
      </div>
    </div>
  );
}
```

`src/ui/screens/LockScreen.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { AppSettings } from '../../core/model';
import { verifyPin } from '../../data/crypto';

export function LockScreen({ app, onUnlock }: { app: AppSettings; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (app.pinHash && app.pinSalt && (await verifyPin(pin, app.pinHash, app.pinSalt))) onUnlock();
    else {
      setError(true);
      setPin('');
    }
  };
  return (
    <form className="page form" style={{ paddingTop: 64 }} onSubmit={submit}>
      <h1>가계부 잠금</h1>
      <label className="field"><span>PIN</span>
        <input type="password" inputMode="numeric" autoFocus autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <p className="error" role="alert">PIN이 맞지 않아요</p>}
      <button type="submit" className="btn btn-primary">열기</button>
    </form>
  );
}
```

- [ ] **Step 7: 구현 — CSV 내보내기와 전체 삭제**

`src/ui/screens/ExportCsv.tsx`:

```tsx
import { useState } from 'react';
import { toCsv } from '../../core/csv';
import { useServices } from '../AppContext';
import { currentMonth, today } from '../format';
import { PageHeader } from '../components/PageHeader';

export function ExportCsv() {
  const { repo } = useServices();
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(today());
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    if (from > to) return setMsg('시작일이 종료일보다 늦어요');
    const [txs, refunds, cats, methods] = await Promise.all([
      repo.listTransactions(), repo.listRefunds(), repo.listCategories(), repo.listPaymentMethods(),
    ]);
    const inRange = txs.filter((t) => t.date >= from && t.date <= to);
    const blob = new Blob([toCsv(inRange, refunds, cats, methods)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `가계부_${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`${inRange.length}건을 내보냈어요.`);
  };

  return (
    <div className="page">
      <PageHeader title="CSV 내보내기" back />
      <div className="form">
        <div className="row">
          <label className="field"><span>시작일</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>종료일</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={run}>내보내기</button>
        {msg && <p role="status">{msg}</p>}
        <p className="small muted">파일에는 금액·가맹점·메모가 들어 있어요. 공유할 때 주의하세요.</p>
      </div>
    </div>
  );
}
```

`src/ui/screens/Wipe.tsx`:

```tsx
import { useState } from 'react';
import { wipeAllData } from '../../data/app';
import { useServices } from '../AppContext';
import { PageHeader } from '../components/PageHeader';

export function Wipe() {
  const services = useServices();
  const [confirm, setConfirm] = useState('');
  return (
    <div className="page">
      <PageHeader title="전체 데이터 삭제" back />
      <div className="form">
        <p>거래·예산·카테고리·결제수단·확인함 후보·알림 처리 기록·설정·잠금 PIN을 모두 지우고 처음 상태로 돌아가요. 되돌릴 수 없어요.</p>
        <label className="field"><span>계속하려면 "삭제"를 입력하세요</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button type="button" className="btn btn-danger" disabled={confirm.trim() !== '삭제'} onClick={() => wipeAllData(services)}>
          모두 삭제
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: App에 Route와 잠금 게이트 추가**

`src/ui/App.tsx`를 다음으로 교체:

```tsx
import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { useLive } from './hooks';
import { AutoRecordSettings } from './screens/AutoRecordSettings';
import { BudgetSettings } from './screens/BudgetSettings';
import { CandidateDetail } from './screens/CandidateDetail';
import { ExportCsv } from './screens/ExportCsv';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { LockScreen } from './screens/LockScreen';
import { LockSettings } from './screens/LockSettings';
import { ManageList } from './screens/ManageList';
import { Onboarding } from './screens/Onboarding';
import { PasteAnalyze } from './screens/PasteAnalyze';
import { Settings } from './screens/Settings';
import { Simulator } from './screens/Simulator';
import { Stats } from './screens/Stats';
import { TxEditor } from './screens/TxEditor';
import { Wipe } from './screens/Wipe';

export default function App() {
  const app = useLive((r) => r.getAppSettings());
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  if (!app) return <p className="loading">불러오는 중…</p>;
  if (!app.onboarded) return <Onboarding />;
  if (app.lockEnabled && !unlocked) return <LockScreen app={app} onUnlock={() => setUnlocked(true)} />;

  return (
    <HashRouter>
      <UndoProvider>
        <div className="app">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/history" element={<History />} />
              <Route path="/tx/new" element={<TxEditor />} />
              <Route path="/tx/:id" element={<TxEditor />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/inbox/:id" element={<CandidateDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/budget" element={<BudgetSettings />} />
              <Route path="/settings/auto" element={<AutoRecordSettings />} />
              <Route path="/settings/categories" element={<ManageList key="c" target="categories" />} />
              <Route path="/settings/methods" element={<ManageList key="m" target="methods" />} />
              <Route path="/settings/paste" element={<PasteAnalyze />} />
              <Route path="/settings/simulator" element={<Simulator />} />
              <Route path="/settings/lock" element={<LockSettings />} />
              <Route path="/settings/export" element={<ExportCsv />} />
              <Route path="/settings/wipe" element={<Wipe />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
```

잠금을 막 켠 직후에는 `unlocked`가 false라 즉시 잠금 화면이 뜬다. 이것은 의도한 동작이다(설정이 적용됐음을 바로 확인).

- [ ] **Step 9: PWA 설정**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#2f6f5e"/>
  <rect x="128" y="120" width="256" height="300" rx="28" fill="#ffffff"/>
  <rect x="168" y="180" width="176" height="24" rx="12" fill="#2f6f5e"/>
  <rect x="168" y="236" width="128" height="24" rx="12" fill="#9cc7b9"/>
  <rect x="168" y="292" width="152" height="24" rx="12" fill="#9cc7b9"/>
  <circle cx="352" cy="376" r="64" fill="#f0b350"/>
  <text x="352" y="398" font-size="64" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#ffffff">₩</text>
</svg>
```

`vite.config.ts`를 다음으로 교체:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '가계부',
        short_name: '가계부',
        description: '결제 알림 자동 기록과 예산 관리',
        lang: 'ko',
        start_url: '.',
        display: 'standalone',
        background_color: '#f6f7f5',
        theme_color: '#2f6f5e',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

`index.html`의 `<head>`에 `<link rel="icon" href="/icon.svg" type="image/svg+xml" />` 추가.

- [ ] **Step 10: 전체 검증**

Run: `npx vitest run`
Expected: 모든 테스트 PASS

Run: `npm run build`
Expected: 타입 오류 없이 `dist/`와 `dist/sw.js`, `dist/manifest.webmanifest` 생성

Run: `npm run preview` 후 브라우저 수동 시나리오 (IndexedDB 초기화 상태에서 시작)
1. 첫 실행 → 자동 기록 허용 → 예산 300,000 → 홈 "자동 기록 켜짐"
2. 설정 → 시뮬레이터 → 샘플 결제수단 추가
3. "문자 승인" 새 알림 → "자동 저장됨". 홈 순지출 12,000원, 카테고리 카페
4. "카톡 승인 (같은 결제)" 새 알림 → "기존 기록에 출처 추가". 거래 1건 유지, 상세에 출처 2개
5. "같은 알림 다시 보내기" → "이미 처리한 알림"
6. "문자 승인" 한 번 더 → 거래 2건 (같은 금액 실제 연속 결제)
7. "문자 전액 취소" → 원거래 후보가 2건이라 "확인함으로 보냄" → 홈 "확인 필요 1건" → 상세에서 원거래 선택 후 환불 연결 → 순지출 12,000원
8. "카톡 전액 취소 (같은 취소)" → "기존 기록에 출처 추가", 환불 1건 유지
9. "할부 결제", "지원하지 않는 형식" → 확인함. 할부 후보에서 결제수단 선택해 저장, 다른 하나는 무시 → 확인함 비어 있음
10. "광고", "인증번호", "카드대금 출금" → "거래 알림 아님"
11. 자동 기록 → 권한 해제 → 아무 프리셋 → "수집 대상 아님 — 폐기". 홈 "알림 접근 권한이 필요해요"
12. 붙여넣기 분석에 문자 승인 문구 → 확인함 추가 (자동 기록이 꺼져 있어도 동작)
13. 앱 잠금 켜기 → 즉시 잠금 화면 → 틀린 PIN 오류 → 맞는 PIN 열림 → 다른 탭에 갔다 오면 다시 잠김
14. CSV 내보내기 → 파일을 엑셀로 열어 한글이 깨지지 않음
15. 개발자 도구 Network 탭에서 앱 사용 중 외부 요청 없음
16. 개발자 도구 → 오프라인 → 새로고침 → 앱이 열리고 거래 추가 가능
17. 전체 삭제 → "삭제" 입력 → 첫 실행 화면. IndexedDB의 records·candidates·kv 비어 있음
18. 브라우저 글자 크기 200%에서 화면이 겹치지 않고, 스크린리더로 탭·버튼 이름이 읽힘

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(ui): 붙여넣기 분석, 알림 시뮬레이터, 앱 잠금, CSV, 전체 삭제, PWA"
```
