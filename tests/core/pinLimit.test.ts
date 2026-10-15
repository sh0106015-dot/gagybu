import { describe, it, expect } from 'vitest';
import { FREE_ATTEMPTS, lockoutMs, registerPinFailure, remainingLockMs } from '../../src/core/pinLimit';

describe('PIN attempt limit', () => {
  it('allows the first five failures without waiting', () => {
    let s = {};
    for (let i = 0; i < FREE_ATTEMPTS - 1; i++) s = registerPinFailure(s, 1000);
    expect(s).toEqual({ failedPinAttempts: 4, pinLockedUntil: undefined });
    expect(remainingLockMs(s, 1000)).toBe(0);
  });
  it('locks 30s on the fifth failure and doubles after, capped at 30 minutes', () => {
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(7)).toBe(120_000);
    expect(lockoutMs(20)).toBe(30 * 60_000);
    const s = registerPinFailure({ failedPinAttempts: 4 }, 1000);
    expect(s).toEqual({ failedPinAttempts: 5, pinLockedUntil: 31_000 });
    expect(remainingLockMs(s, 11_000)).toBe(20_000);
    expect(remainingLockMs(s, 40_000)).toBe(0);
  });
});
