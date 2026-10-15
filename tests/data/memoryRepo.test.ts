import { createMemoryRepo } from '../../src/data/memoryRepo';
import { runRepoContract } from './repoContract';

runRepoContract('memory', async () => createMemoryRepo());
