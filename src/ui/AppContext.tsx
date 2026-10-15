import { createContext, useContext } from 'react';
import type { AppServices } from '../data/app';

export const AppCtx = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const s = useContext(AppCtx);
  if (!s) throw new Error('AppCtx provider missing');
  return s;
}
