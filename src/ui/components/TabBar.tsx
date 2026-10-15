import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: '홈', icon: '⌂' },
  { to: '/history', label: '내역', icon: '☰' },
  { to: '/stats', label: '통계', icon: '▥' },
  { to: '/settings', label: '설정', icon: '⚙' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
