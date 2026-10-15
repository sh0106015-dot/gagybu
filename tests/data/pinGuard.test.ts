import { describe, it, expect } from 'vitest';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { hashPin } from '../../src/data/crypto';
import { tryPin } from '../../src/data/pinGuard';
import { DEFAULT_APP_SETTINGS } from '../../src/core/model';

async function lockedRepo() {
  const repo = createMemoryRepo();
  const { hash, salt } = await hashPin('1234');
  await repo.commit({ appSettings: { ...DEFAULT_APP_SETTINGS, onboarded: true, lockEnabled: true, pinHash: hash, pinSalt: salt } });
  return repo;
}

describe('tryPin', () => {
  it('blocks after five wrong PINs, even the right one, until the wait passes', async () => {
    const repo = await lockedRepo();
    for (let i = 1; i <= 4; i++) expect(await tryPin(repo, '0000', 1000)).toEqual({ ok: false, waitMs: 0, attemptsLeft: 5 - i });
    expect(await tryPin(repo, '0000', 1000)).toEqual({ ok: false, waitMs: 30_000, attemptsLeft: 0 });
    expect(await tryPin(repo, '1234', 20_000)).toEqual({ ok: false, waitMs: 11_000, attemptsLeft: 0 });
    expect(await tryPin(repo, '1234', 31_000)).toEqual({ ok: true });
    expect(await repo.getAppSettings()).toMatchObject({ failedPinAttempts: 0, pinLockedUntil: undefined });
  });
  it('a wrong PIN after the first lock waits twice as long', async () => {
    const repo = await lockedRepo();
    for (let i = 0; i < 5; i++) await tryPin(repo, '0000', 1000);
    expect(await tryPin(repo, '0000', 31_000)).toEqual({ ok: false, waitMs: 60_000, attemptsLeft: 0 });
  });
});
