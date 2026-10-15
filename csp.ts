/**
 * 배포본에 넣는 콘텐츠 보안 정책(CSP).
 * 앱은 자기 사이트('self') 말고는 어디에도 연결·전송할 수 없다. 영수증 사진(data:)과 캔버스(blob:) 이미지만 허용한다.
 * 개발 서버는 React 새로고침용 인라인 스크립트를 쓰므로 빌드에만 넣는다(vite.config.ts).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
