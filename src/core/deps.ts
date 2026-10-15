import type { Repo } from './repo';

export interface Deps {
  repo: Repo;
  now: () => number;
  newId: () => string;
  /** 확인함 발췌 암호화. 반환값은 저장 가능한 문자열. */
  encrypt: (plain: string) => Promise<string>;
}
