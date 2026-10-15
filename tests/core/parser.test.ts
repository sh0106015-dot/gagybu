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
