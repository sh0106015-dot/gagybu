import type { ReactNode } from 'react';
import { Bunny, INK, type BunnyPose } from './Bunny';

const line = { stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** 홈 상단 방 풍경: 격자 창문, 화분, 작은 책상과 계산기. 토끼는 오른쪽에 선다. */
function Room() {
  return (
    <svg className="hero-room" viewBox="0 0 220 120" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <g {...line}>
        <rect x="104" y="10" width="62" height="50" rx="3" fill="#eaf4fb" />
        <path d="M135 10v50M104 35h62" fill="none" />
        <path d="M108 54q10-16 24-8" fill="none" stroke="#bfe0f2" />
        <rect x="174" y="70" width="40" height="30" rx="3" fill="#f6d39b" />
        <path d="M178 100v14M210 100v14" fill="none" />
        <rect x="184" y="58" width="20" height="13" rx="2" fill="#a8dcc8" />
        <path d="M188 63h3M193 63h3M198 63h3M188 67h3M193 67h3M198 67h3" fill="none" strokeWidth="1.4" />
        <path d="M98 86h18l-3 26h-12z" fill="#f2a98a" />
        <path d="M107 86q-12-14-4-24q6 10 4 24M107 86q10-18 18-14q-6 10-18 14" fill="#8cc79a" />
      </g>
      <path d="M0 116h220" stroke={INK} strokeWidth="1.6" opacity="0.4" />
    </svg>
  );
}

export function Hero({ pose, title, message, children }: { pose: BunnyPose; title: string; message: string; children?: ReactNode }) {
  return (
    <section className="card hero">
      <Room />
      <div className="hero-text">
        <p className="hero-title">{title}</p>
        <p className="hero-msg">{message}</p>
        {children}
      </div>
      <div className="hero-bunny">
        <Bunny pose={pose} size={92} />
      </div>
    </section>
  );
}

/** 빈 화면 안내: 잠든 토끼 + 문구 */
export function EmptyArt({ children, pose = 'sleep' }: { children: ReactNode; pose?: BunnyPose }) {
  return (
    <div className="empty-art">
      <Bunny pose={pose} size={88} />
      <p>{children}</p>
    </div>
  );
}
