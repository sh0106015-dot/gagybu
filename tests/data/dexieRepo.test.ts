import 'fake-indexeddb/auto';
import { GagyebuDB } from '../../src/data/db';
import { createDexieRepo } from '../../src/data/dexieRepo';
import { runRepoContract } from './repoContract';

let i = 0;
runRepoContract('dexie', async () => createDexieRepo(new GagyebuDB(`test-${++i}`)));
