import { useState, type FormEvent } from 'react';
import type { AppSettings } from '../../core/model';
import { verifyPin } from '../../data/crypto';
import { Bunny } from '../art/Bunny';

export function LockScreen({ app, onUnlock }: { app: AppSettings; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (app.pinHash && app.pinSalt && (await verifyPin(pin, app.pinHash, app.pinSalt))) onUnlock();
    else {
      setError(true);
      setPin('');
    }
  };
  return (
    <form className="page form" style={{ paddingTop: 64 }} onSubmit={submit}>
      <div className="onboard-art"><Bunny pose="wave" size={110} /></div>
      <h1 style={{ textAlign: 'center' }}>가계부 잠금</h1>
      <label className="field"><span>PIN</span>
        <input type="password" inputMode="numeric" autoFocus autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <p className="error" role="alert">PIN이 맞지 않아요</p>}
      <button type="submit" className="btn btn-primary">열기</button>
    </form>
  );
}
