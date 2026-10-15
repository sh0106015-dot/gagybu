import type { Deps } from '../core/deps';
import { newId } from '../core/ids';
import type { Repo } from '../core/repo';
import { drainPending } from '../core/pipeline/ingest';
import { purgeExpiredCandidates } from '../core/actions';
import { GagyebuDB } from './db';
import { createDexieRepo } from './dexieRepo';
import { decryptText, encryptText, generateDeviceKey } from './crypto';
import { ensureSeeded } from './seed';

export interface AppServices {
  repo: Repo;
  deps: Deps;
  decrypt: (payload: string) => Promise<string>;
}

async function loadDeviceKey(db: GagyebuDB): Promise<CryptoKey> {
  const row = await db.kv.get('deviceKey');
  if (row) return row.value as CryptoKey;
  const key = await generateDeviceKey();
  await db.kv.put({ key: 'deviceKey', value: key });
  return key;
}

export async function createAppServices(): Promise<AppServices> {
  const db = new GagyebuDB();
  const repo = createDexieRepo(db);
  const key = await loadDeviceKey(db);
  const deps: Deps = { repo, now: Date.now, newId, encrypt: (s) => encryptText(key, s) };
  await ensureSeeded(repo);
  await purgeExpiredCandidates(deps);
  await drainPending(deps);
  return { repo, deps, decrypt: (p) => decryptText(key, p) };
}

/** 전체 삭제 후 페이지를 다시 불러와 새 기기 키·기본 데이터로 시작한다. */
export async function wipeAllData(services: AppServices): Promise<void> {
  await services.repo.clearAll();
  location.reload();
}
