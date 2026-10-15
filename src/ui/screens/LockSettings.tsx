import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hashPin } from '../../data/crypto';
import { tryPin } from '../../data/pinGuard';
import { waitLabel } from './LockScreen';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { PageHeader } from '../components/PageHeader';

const PIN_RE = /^\d{4,6}$/;

export function LockSettings() {
  const { repo } = useServices();
  const navigate = useNavigate();
  const app = useLive((r) => r.getAppSettings());
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!app) return <p className="loading">불러오는 중…</p>;

  const enable = async () => {
    if (!PIN_RE.test(pin)) return setError('숫자 4~6자리로 입력하세요');
    if (pin !== pin2) return setError('두 PIN이 달라요');
    const { hash, salt } = await hashPin(pin);
    await repo.commit({ appSettings: { ...app, lockEnabled: true, pinHash: hash, pinSalt: salt, failedPinAttempts: 0, pinLockedUntil: undefined } });
    navigate(-1);
  };
  const disable = async () => {
    // 잠금 끄기도 잠금 화면과 같은 틀림 횟수 제한을 따른다.
    const r = await tryPin(repo, pin);
    if (!r.ok) {
      setPin('');
      return setError(r.waitMs > 0 ? `PIN을 여러 번 틀렸어요. ${waitLabel(r.waitMs)} 뒤에 다시 시도하세요.` : `PIN이 맞지 않아요. ${r.attemptsLeft}번 더 틀리면 잠시 기다려야 해요.`);
    }
    const fresh = await repo.getAppSettings();
    await repo.commit({ appSettings: { ...fresh, lockEnabled: false, pinHash: undefined, pinSalt: undefined, failedPinAttempts: 0, pinLockedUntil: undefined } });
    navigate(-1);
  };
  const pinInput = (label: string, v: string, set: (s: string) => void) => (
    <label className="field"><span>{label}</span>
      <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={v} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} />
    </label>
  );

  return (
    <div className="page">
      <PageHeader title="앱 잠금" back />
      <div className="form">
        {app.lockEnabled ? (
          <>
            <p>앱 잠금이 켜져 있어요. 끄려면 현재 PIN을 입력하세요.</p>
            {pinInput('현재 PIN', pin, setPin)}
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn btn-danger" onClick={disable}>잠금 끄기</button>
          </>
        ) : (
          <>
            <p>앱을 열 때와 다른 앱에 다녀왔을 때 PIN을 물어봐요.</p>
            {pinInput('새 PIN (숫자 4~6자리)', pin, setPin)}
            {pinInput('PIN 확인', pin2, setPin2)}
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary" onClick={enable}>잠금 켜기</button>
          </>
        )}
        <p className="small muted">PIN을 잊으면 브라우저 데이터를 지워야 해요. 이때 가계부 데이터도 함께 지워져요.</p>
      </div>
    </div>
  );
}
