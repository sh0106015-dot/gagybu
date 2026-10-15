import { NavLink } from 'react-router-dom';
import { MenuArt, type MenuArtName } from '../art/MenuArt';

const TABS: { to: string; label: string; icon: MenuArtName }[] = [
  { to: '/', label: '홈', icon: 'home' },
  { to: '/history', label: '내역', icon: 'list' },
  { to: '/stats', label: '통계', icon: 'chart' },
  { to: '/settings', label: '설정', icon: 'settings' },
];

/** 하단 탭. 손그림 아이콘이라 색만으로는 구분이 어려워, 선택된 탭은 배경 알약·굵은 글씨·밑줄로도 표시한다. */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
          <span className="tab-art"><MenuArt name={t.icon} size={30} /></span>
          <span className="tab-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
