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
