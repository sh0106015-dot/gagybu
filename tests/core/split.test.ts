import { describe, it, expect } from 'vitest';
import { splitMessages } from '../../src/core/parser/split';

describe('splitMessages', () => {
  it('splits on blank lines and trims', () => {
    expect(splitMessages('  A 12,000원 승인 \n\n\nB 3,000원 승인\n')).toEqual(['A 12,000원 승인', 'B 3,000원 승인']);
  });
  it('splits consecutive [Web발신] messages without blank lines', () => {
    const text = '[Web발신]\n가나카드(1234)승인 홍*동 12,000원 10/15 12:30 스타벅스\n[Web발신]\n가나카드(1234)승인 홍*동 3,000원 10/15 13:00 GS25';
    expect(splitMessages(text)).toEqual([
      '[Web발신]\n가나카드(1234)승인 홍*동 12,000원 10/15 12:30 스타벅스',
      '[Web발신]\n가나카드(1234)승인 홍*동 3,000원 10/15 13:00 GS25',
    ]);
  });
  it('keeps a multi-line kakao message together', () => {
    const kakao = '가나카드 결제 승인\n금액: 12,000원\n가맹점: 스타벅스\n일시: 10/15 12:30\n카드: 가나(1234)';
    expect(splitMessages(kakao)).toEqual([kakao]);
  });
  it('returns nothing for empty input', () => {
    expect(splitMessages(' \n \n')).toEqual([]);
  });
  it('caps the number of messages', () => {
    const many = Array.from({ length: 80 }, (_, i) => `메시지 ${i}`).join('\n\n');
    expect(splitMessages(many)).toHaveLength(50);
  });
});
