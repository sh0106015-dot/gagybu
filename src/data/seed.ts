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
