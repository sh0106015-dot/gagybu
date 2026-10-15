import type { NonTxReason } from './types';

export function classifyNonTx(text: string): NonTxReason | null {
  if (/\(광고\)|\[광고\]|이벤트|쿠폰/.test(text)) return 'ad';
  if (/인증\s*번호|OTP/i.test(text)) return 'otp';
  if (/카드\s*대금|결제\s*대금|대금\s*출금/.test(text)) return 'bill_payment';
  if (/(결제|청구)\s*예정|이용\s*한도|잔여\s*한도|잔액\s*안내/.test(text)) return 'info';
  return null;
}
