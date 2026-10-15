import { useEffect, useState, type FormEvent } from 'react';
import type { AppSettings } from '../../core/model';
import { remainingLockMs } from '../../core/pinLimit';
import { tryPin } from '../../data/pinGuard';
import { useServices } from '../AppContext';
import { Bunny } from '../art/Bunny';

/** 대기 시간 문구: "25초", "1분 30초" */
export const waitLabel = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}` : `${s}초`;
};

export function LockScreen({ app, onUnlock }: { app: AppSettings; onUnlock: () => void }) {
  const { repo } = useServices();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(app.pinLockedUntil ?? 0);
  const [now, setNow] = useState(Date.now());
  const waiting = remainingLockMs({ pinLockedUntil: waitUntil }, now);

  useEffect(() => {
    if (waiting <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting > 0]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (waiting > 0 || !pin) return;
    const r = await tryPin(repo, pin);
    if (r.ok) return onUnlock();
    setPin('');
    setNow(Date.now());
    setWaitUntil(Date.now() + r.waitMs);
    setMessage(r.waitMs > 0 ? null : `PIN이 맞지 않아요. ${r.attemptsLeft}번 더 틀리면 잠시 기다려야 해요.`);
  };

  return (
    <form className="page form" style={{ paddingTop: 64 }} onSubmit={submit}>
      <div className="onboard-art"><Bunny pose={waiting > 0 ? 'worry' : 'wave'} size={110} /></div>
      <h1 style={{ textAlign: 'center' }}>가계부 잠금</h1>
      <label className="field"><span>PIN</span>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          autoComplete="off"
          maxLength={6}
          value={pin}
          disabled={waiting > 0}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      {waiting > 0 ? (
        <p className="error" role="alert">PIN을 여러 번 틀렸어요. {waitLabel(waiting)} 뒤에 다시 시도할 수 있어요.</p>
      ) : (
        message && <p className="error" role="alert">{message}</p>
      )}
      <button type="submit" className="btn btn-primary" disabled={waiting > 0}>열기</button>
    </form>
  );
}
