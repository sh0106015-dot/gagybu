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
