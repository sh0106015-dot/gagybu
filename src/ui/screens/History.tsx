import { useState } from 'react';
import { shiftMonth } from '../../core/dates';
import { formatWon } from '../../core/money';
import { RECORD_METHOD_LABEL, TX_TYPE_LABEL } from '../../core/model';
import { useLive, useLookups } from '../hooks';
import { currentMonth, dayLabel, monthLabel, sortTxDesc } from '../format';
import { EMPTY_FILTER, filterTransactions, type TxFilter } from '../filter';
import { PageHeader } from '../components/PageHeader';
import { TxRow } from '../components/TxRow';

export function History() {
  const [month, setMonth] = useState(currentMonth());
  const [f, setF] = useState<TxFilter>(EMPTY_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const lookups = useLookups();
  const data = useLive(async (repo) => ({ txs: await repo.listTransactions(), refunds: await repo.listRefunds() }));
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const list = filterTransactions(data.txs, month, f).sort(sortTxDesc);
  const refunded = new Map<string, number>();
  data.refunds.forEach((r) => refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount));
  const groups = new Map<string, typeof list>();
  list.forEach((t) => groups.set(t.date, [...(groups.get(t.date) ?? []), t]));
  const set = <K extends keyof TxFilter>(k: K, v: TxFilter[K]) => setF({ ...f, [k]: v });
  const activeFilters = [f.type, f.categoryId, f.paymentMethodId, f.recordMethod].filter(Boolean).length;

  return (
    <div className="page">
      <PageHeader title="내역" />
      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>

      <div className="form" style={{ marginTop: 8 }}>
        <label className="field">
          <span className="visually-hidden">검색</span>
          <input type="search" placeholder="가맹점·메모 검색" value={f.query} onChange={(e) => set('query', e.target.value)} />
        </label>
        <button type="button" className="btn" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          필터{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        {showFilters && (
          <div className="form">
            <label className="field"><span>유형</span>
              <select value={f.type} onChange={(e) => set('type', e.target.value as TxFilter['type'])}>
                <option value="">전체</option>
                {(['expense', 'income', 'transfer'] as const).map((t) => <option key={t} value={t}>{TX_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>카테고리</span>
              <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">전체</option>
                {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>결제수단</span>
              <select value={f.paymentMethodId} onChange={(e) => set('paymentMethodId', e.target.value)}>
                <option value="">전체</option>
                {lookups.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="field"><span>기록 방식</span>
              <select value={f.recordMethod} onChange={(e) => set('recordMethod', e.target.value as TxFilter['recordMethod'])}>
                <option value="">전체</option>
                {(['manual', 'auto', 'confirmed'] as const).map((m) => <option key={m} value={m}>{RECORD_METHOD_LABEL[m]}</option>)}
              </select>
            </label>
            <button type="button" className="btn" onClick={() => setF({ ...EMPTY_FILTER, query: f.query })}>필터 초기화</button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <p className="empty">이 달에 해당하는 거래가 없어요.</p>
      ) : (
        [...groups.entries()].map(([date, items]) => {
          const spend = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <section key={date}>
              <div className="day-head"><span>{dayLabel(date)}</span><span>지출 {formatWon(spend)}</span></div>
              <ul className="tx-list">
                {items.map((t) => (
                  <TxRow key={t.id} tx={t} refunded={refunded.get(t.id)} catName={lookups.catName} pmName={lookups.pmName} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
