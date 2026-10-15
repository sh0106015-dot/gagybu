import { INK } from './Bunny';

/** 홈 메뉴용 손그림 아이콘. 갈색 외곽선 + 파스텔 면. */
export type MenuArtName = 'write' | 'list' | 'chart' | 'inbox' | 'budget' | 'settings';

const line = { stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ART: Record<MenuArtName, JSX.Element> = {
  write: (
    <g {...line}>
      <rect x="9" y="10" width="24" height="30" rx="3" fill="#a8dcc8" />
      <path d="M14 18h14M14 24h14M14 30h8" fill="none" />
      <path d="M28 36l12-14 4 3-12 14-5 2z" fill="#f2c46b" />
      <path d="M40 22l2-2 4 3-2 2" fill="#f7b6c2" />
    </g>
  ),
  list: (
    <g {...line}>
      <path d="M24 12q-8-3-15 0v28q7-3 15 0q8-3 15 0V12q-7-3-15 0z" fill="#fde3d8" />
      <path d="M24 12v28" fill="none" />
      <path d="M13 19h7M13 25h7M28 19h7M28 25h7M28 31h5" fill="none" />
    </g>
  ),
  chart: (
    <g {...line}>
      <rect x="9" y="26" width="8" height="14" rx="2" fill="#a8dcc8" />
      <rect x="20" y="16" width="8" height="24" rx="2" fill="#f2c46b" />
      <rect x="31" y="21" width="8" height="19" rx="2" fill="#f7b6c2" />
      <path d="M6 40h36" fill="none" />
    </g>
  ),
  inbox: (
    <g {...line}>
      <rect x="8" y="14" width="32" height="24" rx="3" fill="#fbe7b5" />
      <path d="M8 16l16 12 16-12" fill="none" />
      <circle cx="36" cy="14" r="5" fill="#f08a7e" />
    </g>
  ),
  budget: (
    <g {...line}>
      <rect x="7" y="16" width="32" height="22" rx="4" fill="#d9a873" />
      <path d="M27 23h12v10H27a5 5 0 0 1 0-10z" fill="#f6d39b" />
      <circle cx="29" cy="28" r="1.6" fill={INK} stroke="none" />
      <circle cx="18" cy="12" r="6" fill="#f4c95d" />
      <path d="M16 12h4" fill="none" />
    </g>
  ),
  settings: (
    <g {...line}>
      <path
        d="M24 9l3 4 5-1 1 5 5 2-2 5 2 5-5 2-1 5-5-1-3 4-3-4-5 1-1-5-5-2 2-5-2-5 5-2 1-5 5 1z"
        fill="#d8cdf0"
      />
      <circle cx="24" cy="25" r="5" fill="#fff7ea" />
    </g>
  ),
};

export function MenuArt({ name }: { name: MenuArtName }) {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      {ART[name]}
    </svg>
  );
}
