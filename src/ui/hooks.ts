import { useLiveQuery } from 'dexie-react-hooks';
import type { Repo } from '../core/repo';
import { useServices } from './AppContext';

export function useLive<T>(fn: (repo: Repo) => Promise<T>, deps: unknown[] = []): T | undefined {
  const { repo } = useServices();
  return useLiveQuery(() => fn(repo), deps);
}

export function useLookups() {
  return useLive(async (repo) => {
    const [categories, methods] = await Promise.all([repo.listCategories(), repo.listPaymentMethods()]);
    categories.sort((a, b) => a.sortOrder - b.sortOrder);
    methods.sort((a, b) => a.sortOrder - b.sortOrder);
    const cat = new Map(categories.map((c) => [c.id, c.name]));
    const pm = new Map(methods.map((p) => [p.id, p.name]));
    return {
      categories,
      methods,
      catName: (id: string) => (id ? cat.get(id) ?? '삭제된 카테고리' : '이체'),
      pmName: (id?: string) => (id ? pm.get(id) ?? '삭제된 수단' : '-'),
    };
  });
}
