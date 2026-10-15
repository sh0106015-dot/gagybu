import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAppServices } from './data/app';
import { AppCtx } from './ui/AppContext';
import App from './ui/App';
import './ui/styles.css';
import { captureInstallPrompt } from './ui/install';

// 설치 창 이벤트는 앱이 그려지기 전에 올 수 있어 가장 먼저 붙잡는다.
captureInstallPrompt();

const root = createRoot(document.getElementById('root')!);

createAppServices()
  .then((services) =>
    root.render(
      <StrictMode>
        <AppCtx.Provider value={services}>
          <App />
        </AppCtx.Provider>
      </StrictMode>,
    ),
  )
  .catch((e) => {
    console.warn('startup_failed', e instanceof Error ? e.name : 'unknown');
    root.render(<p className="fatal">이 브라우저에서는 기기 저장소를 사용할 수 없어요. 시크릿 모드가 아닌 일반 창에서 열어 주세요.</p>);
  });
