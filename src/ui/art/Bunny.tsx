/**
 * 가계부 마스코트 토끼 "토리".
 * 얇은 갈색 외곽선 + 파스텔 면 채색 + 점 눈·볼터치의 손그림 느낌으로 그린다.
 */
export type BunnyPose = 'wave' | 'coin' | 'bag' | 'sleep' | 'worry' | 'party' | 'write';

export const INK = '#5b4636';
const FUR = '#fff7ea';
const EAR = '#f6c7c2';
const BLUSH = '#f4a8a0';
const GOLD = '#f4c95d';
const MINT = '#a8dcc8';
const MUSTARD = '#f2c46b';
const PINK = '#f7b6c2';
const BAG = '#d9a873';

const line = { stroke: INK, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Face({ pose }: { pose: BunnyPose }) {
  if (pose === 'sleep') {
    return (
      <g fill="none" {...line}>
        <path d="M46 63q4 3 8 0M66 63q4 3 8 0" />
        <path d="M57 71q3 2 6 0" />
      </g>
    );
  }
  if (pose === 'worry') {
    return (
      <g {...line}>
        <path d="M45 59l7-3M75 59l-7-3" fill="none" />
        <circle cx="50" cy="64" r="2.4" fill={INK} stroke="none" />
        <circle cx="70" cy="64" r="2.4" fill={INK} stroke="none" />
        <path d="M54 73q3-3 6 0q3 3 6 0" fill="none" />
      </g>
    );
  }
  return (
    <g {...line}>
      <circle cx="50" cy="63" r="2.6" fill={INK} stroke="none" />
      <circle cx="70" cy="63" r="2.6" fill={INK} stroke="none" />
      <path d={pose === 'party' ? 'M54 69q6 7 12 0z' : 'M56 70q4 4 8 0'} fill={pose === 'party' ? '#e8837a' : 'none'} />
    </g>
  );
}

function Arms({ pose }: { pose: BunnyPose }) {
  switch (pose) {
    case 'wave':
      return (
        <g fill={FUR} {...line}>
          <path d="M37 88q-12-8-16-24" fill="none" />
          <ellipse cx="20" cy="61" rx="5" ry="6" />
          <path d="M10 52q-3 4 0 8M8 46q-6 8 0 16" fill="none" strokeWidth="1.6" />
          <path d="M83 86q6 6 2 12" fill="none" />
        </g>
      );
    case 'party':
      return (
        <g fill={FUR} {...line}>
          <path d="M37 84q-10-12-8-26M83 84q10-12 8-26" fill="none" />
          <ellipse cx="29" cy="56" rx="5" ry="6" />
          <ellipse cx="91" cy="56" rx="5" ry="6" />
        </g>
      );
    case 'coin':
      return (
        <g {...line}>
          <circle cx="60" cy="94" r="13" fill={GOLD} />
          <text x="60" y="99" textAnchor="middle" fontSize="14" fontWeight="800" fill={INK} stroke="none">₩</text>
          <ellipse cx="46" cy="93" rx="6" ry="5" fill={FUR} />
          <ellipse cx="74" cy="93" rx="6" ry="5" fill={FUR} />
        </g>
      );
    case 'bag':
      return (
        <g {...line}>
          <path d="M78 72l4-14M84 72l6-12" stroke="#6fb36f" strokeWidth="3" fill="none" />
          <path d="M66 78h28l-3 30H69z" fill={BAG} />
          <path d="M72 86h16" fill="none" />
          <ellipse cx="66" cy="90" rx="6" ry="5" fill={FUR} />
          <path d="M37 86q-6 6-3 12" fill="none" />
        </g>
      );
    case 'write':
      return (
        <g {...line}>
          <rect x="38" y="88" width="44" height="22" rx="3" fill={MINT} />
          <path d="M44 95h20M44 101h14" fill="none" />
          <path d="M70 104l14-16 4 3-14 16-5 2z" fill={MUSTARD} />
          <ellipse cx="72" cy="104" rx="5" ry="4" fill={FUR} />
        </g>
      );
    case 'worry':
      return (
        <g {...line}>
          <path d="M84 50q4 6 0 9q-4-3 0-9z" fill="#9ccbf0" />
          <ellipse cx="46" cy="94" rx="6" ry="5" fill={FUR} />
          <ellipse cx="74" cy="94" rx="6" ry="5" fill={FUR} />
        </g>
      );
    case 'sleep':
      return (
        <g {...line}>
          <path d="M34 98q26-12 52 0v12H34z" fill={PINK} />
          <path d="M40 104h40" fill="none" strokeDasharray="2 5" />
          <text x="90" y="40" fontSize="13" fontWeight="800" fill={INK} stroke="none">z</text>
          <text x="98" y="30" fontSize="10" fontWeight="800" fill={INK} stroke="none">z</text>
        </g>
      );
  }
}

function Extras({ pose }: { pose: BunnyPose }) {
  if (pose !== 'party') return null;
  return (
    <g stroke="none">
      <circle cx="18" cy="30" r="3" fill={PINK} />
      <circle cx="104" cy="24" r="3" fill={MINT} />
      <rect x="96" y="70" width="6" height="3" rx="1" fill={MUSTARD} transform="rotate(30 99 71)" />
      <rect x="14" y="74" width="6" height="3" rx="1" fill={MINT} transform="rotate(-25 17 75)" />
      <path d="M100 44l2 5 5 1-4 3 1 5-4-3-5 2 2-5-3-4 5 0z" fill={GOLD} />
    </g>
  );
}

export function Bunny({ pose = 'wave', size = 96, title }: { pose?: BunnyPose; size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="bunny"
    >
      <ellipse cx="60" cy="114" rx="30" ry="4" fill={INK} opacity="0.12" />
      <Extras pose={pose} />
      <g {...line}>
        <ellipse cx="46" cy="28" rx="9" ry="22" fill={FUR} transform="rotate(-12 46 28)" />
        <ellipse cx="46" cy="30" rx="4" ry="14" fill={EAR} stroke="none" transform="rotate(-12 46 30)" />
        <ellipse cx="74" cy="28" rx="9" ry="22" fill={FUR} transform={pose === 'worry' ? 'rotate(40 74 40)' : 'rotate(12 74 28)'} />
        <ellipse cx="74" cy="30" rx="4" ry="14" fill={EAR} stroke="none" transform={pose === 'worry' ? 'rotate(40 74 42)' : 'rotate(12 74 30)'} />
        <ellipse cx="60" cy="94" rx="26" ry="20" fill={FUR} />
        <ellipse cx="48" cy="112" rx="8" ry="4" fill={FUR} />
        <ellipse cx="72" cy="112" rx="8" ry="4" fill={FUR} />
        <ellipse cx="60" cy="64" rx="30" ry="25" fill={FUR} />
      </g>
      <ellipse cx="43" cy="71" rx="5" ry="3" fill={BLUSH} opacity="0.75" />
      <ellipse cx="77" cy="71" rx="5" ry="3" fill={BLUSH} opacity="0.75" />
      <Face pose={pose} />
      <Arms pose={pose} />
    </svg>
  );
}

/** 흰 테두리를 두른 스티커 모양. 살짝 기울여 붙인 느낌을 준다. */
export function Sticker({ pose, size = 72, tilt = -4, title }: { pose: BunnyPose; size?: number; tilt?: number; title?: string }) {
  return (
    <span className="sticker" style={{ transform: `rotate(${tilt}deg)` }}>
      <Bunny pose={pose} size={size} title={title} />
    </span>
  );
}
