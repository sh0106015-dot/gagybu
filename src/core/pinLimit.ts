/** PIN을 이만큼 틀릴 때까지는 기다림 없이 다시 시도할 수 있다. */
export const FREE_ATTEMPTS = 5;
const FIRST_LOCK_MS = 30_000;
const MAX_LOCK_MS = 30 * 60_000;

export interface PinLimitState {
  failedPinAttempts?: number;
  pinLockedUntil?: number;
}

/** 틀린 횟수에 따른 대기 시간: 5번째 30초, 이후 두 배씩, 최대 30분. */
export function lockoutMs(failed: number): number {
  if (failed < FREE_ATTEMPTS) return 0;
  return Math.min(FIRST_LOCK_MS * 2 ** (failed - FREE_ATTEMPTS), MAX_LOCK_MS);
}

export function registerPinFailure(s: PinLimitState, now: number): Required<Pick<PinLimitState, 'failedPinAttempts'>> & PinLimitState {
  const failed = (s.failedPinAttempts ?? 0) + 1;
  const wait = lockoutMs(failed);
  return { failedPinAttempts: failed, pinLockedUntil: wait ? now + wait : undefined };
}

export function remainingLockMs(s: PinLimitState, now: number): number {
  return Math.max(0, (s.pinLockedUntil ?? 0) - now);
}
