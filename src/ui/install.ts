/** 휴대폰 설치(홈 화면 추가) 방식을 고르기 위한 실행 환경 */
export type InstallEnv =
  | 'installed' // 이미 홈 화면 앱으로 실행 중
  | 'kakao' // 카카오톡 안의 브라우저
  | 'inapp-android' // 네이버·인스타 등 안드로이드 앱 안의 브라우저
  | 'android' // 크롬·삼성 인터넷 등: 설치 창을 바로 띄울 수 있음
  | 'ios-safari' // 아이폰 사파리: 공유 → 홈 화면에 추가
  | 'ios-other' // 아이폰의 다른 브라우저: 사파리로 열어야 함
  | 'desktop';

export function detectInstallEnv(ua: string, standalone: boolean): InstallEnv {
  if (standalone) return 'installed';
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (ios) return /CriOS|FxiOS|EdgiOS|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua) || !/Safari/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return /; wv\)|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua) ? 'inapp-android' : 'android';
  return 'desktop';
}

/** 앱 안 브라우저에서 바깥 브라우저로 같은 주소를 다시 여는 링크. 해당 없으면 undefined. */
export function externalOpenUrl(env: InstallEnv, url: string): string | undefined {
  if (env === 'kakao') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (env === 'inapp-android') return `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
  return undefined;
}

/** 브라우저가 주는 설치 창(beforeinstallprompt)을 앱 시작 전부터 붙잡아 둔다. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const getInstallPrompt = () => deferred;

export function onInstallPromptChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
