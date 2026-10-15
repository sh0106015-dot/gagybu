export function parseWon(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}
