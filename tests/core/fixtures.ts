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
