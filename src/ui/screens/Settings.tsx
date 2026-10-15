import { Link } from 'react-router-dom';
import type { AppSettings } from '../../core/model';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { PageHeader } from '../components/PageHeader';

const THEMES: { value: NonNullable<AppSettings['theme']>; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

const ITEMS = [
  { to: '/settings/budget', label: '월 예산' },
  { to: '/settings/auto', label: '자동 기록' },
  { to: '/settings/categories', label: '카테고리' },
  { to: '/settings/methods', label: '결제수단' },
  { to: '/settings/paste', label: '알림 내용 붙여넣기 분석' },
  { to: '/settings/simulator', label: '알림 시뮬레이터 (테스트용)' },
  { to: '/settings/lock', label: '앱 잠금' },
  { to: '/settings/export', label: 'CSV 내보내기' },
  { to: '/settings/wipe', label: '전체 데이터 삭제' },
];

export function Settings() {
  const { repo } = useServices();
  const app = useLive((r) => r.getAppSettings());
  const theme = app?.theme ?? 'auto';
  return (
    <div className="page">
      <PageHeader title="설정" />
      <section className="card form">
        <fieldset className="segmented" style={{ margin: 0, padding: 0 }}>
          <legend className="small muted" style={{ padding: '0 0 6px' }}>화면 테마 (자동은 휴대폰 설정을 따라요)</legend>
          {THEMES.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="theme"
                checked={theme === t.value}
                disabled={!app}
                onChange={() => app && repo.commit({ appSettings: { ...app, theme: t.value } })}
              />
              {t.label}
            </label>
          ))}
        </fieldset>
      </section>
      <ul className="list">
        {ITEMS.map((i) => (
          <li key={i.to}><Link to={i.to} className="item"><span>{i.label}</span><span aria-hidden="true">›</span></Link></li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: 16 }}>
        모든 데이터는 이 기기의 브라우저 저장소에만 저장되고 외부로 전송되지 않아요. 브라우저 데이터를 지우거나 기기를 잃어버리면 복원할 수 없어요.
      </p>
    </div>
  );
}
