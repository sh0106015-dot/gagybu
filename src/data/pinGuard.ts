import type { Repo } from '../core/repo';
import { FREE_ATTEMPTS, registerPinFailure, remainingLockMs } from '../core/pinLimit';
import { verifyPin } from './crypto';

export type PinResult = { ok: true } | { ok: false; waitMs: number; attemptsLeft: number };

/**
 * 틀린 횟수 제한을 지키며 PIN을 확인한다. 기다리는 중에는 맞는 PIN도 확인하지 않는다.
 * 횟수와 대기 시각은 기기에 저장되므로 새로고침해도 풀리지 않는다.
 */
export async function tryPin(repo: Repo, pin: string, now = Date.now()): Promise<PinResult> {
  const app = await repo.getAppSettings();
  const wait = remainingLockMs(app, now);
  if (wait > 0) return { ok: false, waitMs: wait, attemptsLeft: 0 };

  if (app.pinHash && app.pinSalt && (await verifyPin(pin, app.pinHash, app.pinSalt))) {
    await repo.commit({ appSettings: { ...app, failedPinAttempts: 0, pinLockedUntil: undefined } });
    return { ok: true };
  }
  const next = registerPinFailure(app, now);
  await repo.commit({ appSettings: { ...app, ...next } });
  return {
    ok: false,
    waitMs: remainingLockMs(next, now),
    attemptsLeft: Math.max(0, FREE_ATTEMPTS - next.failedPinAttempts),
  };
}
