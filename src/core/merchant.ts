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
