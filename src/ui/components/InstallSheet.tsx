import { useEffect, useState } from 'react';
import { Bunny } from '../art/Bunny';
import { detectInstallEnv, externalOpenUrl, getInstallPrompt, isStandalone, onInstallPromptChange } from '../install';

const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`;
const INSTALL_URL = `${APP_URL}?install=1`;

/** 휴대폰 설치 안내 창. QR(?install=1)로 들어오거나 설정에서 열면 나타난다. */
export function InstallSheet({ onClose }: { onClose: () => void }) {
  const env = detectInstallEnv(navigator.userAgent, isStandalone());
  const [prompt, setPrompt] = useState(getInstallPrompt());
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const external = externalOpenUrl(env, INSTALL_URL);

  useEffect(() => onInstallPromptChange(() => setPrompt(getInstallPrompt())), []);
  // 카카오톡·앱 안 브라우저에서는 설치가 안 되므로 바로 바깥 브라우저로 다시 연다.
  useEffect(() => {
    if (external) location.href = external;
  }, [external]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setDone(true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  let body: JSX.Element;
  if (env === 'installed' || done) {
    body = <p className="install-lead">설치됐어요! 홈 화면의 <strong>토리 아이콘</strong>으로 열어 주세요.</p>;
  } else if (external) {
    body = (
      <>
        <p className="install-lead">{env === 'kakao' ? '카카오톡' : '이 앱'} 안에서는 설치할 수 없어요. 브라우저로 다시 열게요.</p>
        <a className="btn btn-primary btn-big install-btn" href={external}>브라우저로 열어서 설치하기</a>
        <p className="small muted">안 열리면 오른쪽 위 ⋮ → <strong>다른 브라우저로 열기</strong>를 눌러 주세요.</p>
      </>
    );
  } else if (env === 'android') {
    body = prompt ? (
      <>
        <p className="install-lead">버튼을 누르고 <strong>설치</strong>만 누르면 끝이에요.</p>
        <button type="button" className="btn btn-primary btn-big install-btn" onClick={install}>토리 가계부 설치하기</button>
      </>
    ) : (
      <>
        <p className="install-lead">브라우저 메뉴에서 설치해 주세요.</p>
        <ol className="install-steps">
          <li><strong>크롬</strong>: 오른쪽 위 <kbd>⋮</kbd> → <strong>앱 설치</strong> (또는 홈 화면에 추가)</li>
          <li><strong>삼성 인터넷</strong>: 아래 <kbd>≡</kbd> → <strong>현재 페이지 추가</strong> → <strong>홈 화면</strong></li>
        </ol>
        <p className="small muted">설치 버튼이 잠시 뒤 나타날 수도 있어요.</p>
      </>
    );
  } else if (env === 'ios-safari') {
    body = (
      <>
        <p className="install-lead">사파리에서 세 번만 누르면 돼요.</p>
        <ol className="install-steps">
          <li>화면 아래 <span className="ios-share" aria-label="공유 버튼">□↑</span> <strong>공유</strong> 버튼</li>
          <li>목록을 내려서 <strong>홈 화면에 추가</strong></li>
          <li>오른쪽 위 <strong>추가</strong></li>
        </ol>
        <p className="install-arrow" aria-hidden="true">↓</p>
      </>
    );
  } else if (env === 'ios-other') {
    body = (
      <>
        <p className="install-lead">아이폰은 <strong>사파리</strong>에서만 설치할 수 있어요.</p>
        <button type="button" className="btn btn-primary btn-big install-btn" onClick={copy}>{copied ? '주소를 복사했어요' : '주소 복사하기'}</button>
        <p className="small muted">사파리를 열고 주소창에 붙여넣은 뒤, 공유 → 홈 화면에 추가를 눌러 주세요.</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="install-lead">휴대폰 카메라로 QR을 찍으면 설치 화면이 열려요.</p>
        <img className="install-qr" src={`${import.meta.env.BASE_URL}install-qr.png`} alt={`설치 주소 QR 코드: ${APP_URL}`} />
        <p className="small muted" style={{ wordBreak: 'break-all' }}>{APP_URL}</p>
      </>
    );
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden="true" />
        <div className="install-head">
          <Bunny pose="wave" size={84} />
          <div>
            <h2 id="install-title">토리 가계부 설치</h2>
            <p className="small muted" style={{ margin: 0 }}>홈 화면에 앱으로 설치해요. 데이터는 이 휴대폰에만 저장돼요.</p>
          </div>
        </div>
        {body}
        <button type="button" className="btn" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>나중에 하기</button>
      </div>
    </div>
  );
}
