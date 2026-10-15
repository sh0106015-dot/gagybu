import { useState, type FormEvent } from 'react';
import type { Category, PaymentMethod } from '../../core/model';
import { UNCATEGORIZED_ID } from '../../core/model';
import { useServices } from '../AppContext';
import { useLookups } from '../hooks';
import { PageHeader } from '../components/PageHeader';

const CAT_KINDS = { expense: '지출', income: '수입' } as const;
const PM_KINDS = { card: '카드', pay: '간편결제', account: '계좌', cash: '현금' } as const;

export function ManageList({ target }: { target: 'categories' | 'methods' }) {
  const { repo, deps } = useServices();
  const lookups = useLookups();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>(target === 'categories' ? 'expense' : 'card');
  const [error, setError] = useState<string | null>(null);
  if (!lookups) return <p className="loading">불러오는 중…</p>;

  const isCat = target === 'categories';
  const items: (Category | PaymentMethod)[] = isCat ? lookups.categories : lookups.methods;
  const kinds: Record<string, string> = isCat ? CAT_KINDS : PM_KINDS;
  const save = (item: Category | PaymentMethod) =>
    repo.commit(isCat ? { categories: [item as Category] } : { paymentMethods: [item as PaymentMethod] });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('이름을 입력하세요');
    if (items.some((i) => i.name === n && i.kind === kind && !i.archived)) return setError('같은 이름이 이미 있어요');
    const base = { id: deps.newId(), name: n, sortOrder: Math.max(0, ...items.map((i) => i.sortOrder)) + 1, archived: false };
    await save(isCat
      ? { ...base, kind: kind as Category['kind'] }
      : { ...base, kind: kind as PaymentMethod['kind'], matchKeys: [] });
    setName('');
    setError(null);
  };

  const rename = async (item: Category | PaymentMethod) => {
    const n = window.prompt('새 이름', item.name)?.trim();
    if (n) await save({ ...item, name: n });
  };

  const editKeys = async (pm: PaymentMethod) => {
    const v = window.prompt('알림 매칭 키 (쉼표로 구분, 예: 가나카드*1234, 마바페이)', pm.matchKeys.join(', '));
    if (v !== null) await save({ ...pm, matchKeys: v.split(',').map((s) => s.trim()).filter(Boolean) });
  };

  const render = (list: (Category | PaymentMethod)[]) => (
    <ul className="list">
      {list.map((i) => (
        <li key={i.id}>
          <div className="budget-row">
            <span>
              {i.name} <span className="small muted">{kinds[i.kind]}</span>
              {!isCat && (i as PaymentMethod).matchKeys.length > 0 && (
                <span className="small muted"> · 매칭: {(i as PaymentMethod).matchKeys.join(', ')}</span>
              )}
            </span>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn" onClick={() => rename(i)}>이름 수정</button>
            {!isCat && i.kind !== 'cash' && (
              <button type="button" className="btn" onClick={() => editKeys(i as PaymentMethod)}>매칭 키</button>
            )}
            {i.id !== UNCATEGORIZED_ID && (
              <button type="button" className="btn" onClick={() => save({ ...i, archived: !i.archived })}>
                {i.archived ? '보관 해제' : '보관'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page">
      <PageHeader title={isCat ? '카테고리' : '결제수단'} back />
      <form className="form card" onSubmit={add} noValidate>
        <div className="row">
          <label className="field"><span>이름</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>종류</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">추가</button>
      </form>
      {render(items.filter((i) => !i.archived))}
      {items.some((i) => i.archived) && (
        <>
          <h2 style={{ margin: '20px 0 8px' }}>보관됨</h2>
          <p className="small muted">보관해도 기존 거래 내역은 그대로 남아요.</p>
          {render(items.filter((i) => i.archived))}
        </>
      )}
    </div>
  );
}
