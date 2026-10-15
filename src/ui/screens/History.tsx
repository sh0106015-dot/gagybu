import { useState } from 'react';
import { Link } from 'react-router-dom';
import { summarizeMonth } from '../../core/budget';
import { shiftMonth } from '../../core/dates';
import { spendByPaymentKind } from '../../core/insights';
import { formatWon } from '../../core/money';
import type { Refund, Transaction } from '../../core/model';
import { PAYMENT_KIND_LABEL, RECORD_METHOD_LABEL, TX_TYPE_LABEL } from '../../core/model';
import { periodKey, periodLabel, periodRange } from '../../core/period';
import { calendarGrid, rangeTotals, weekRanges } from '../../core/views';
import { useLive, useLookups, useStartDay } from '../hooks';
import { currentPeriod, dayLabel, sortTxDesc, today } from '../format';
import { EMPTY_FILTER, filterTransactions, type TxFilter } from '../filter';
import { Sticker } from '../art/Bunny';
import { EmptyArt } from '../art/Scenes';
import { MemoTab } from '../components/MemoTab';
import { TxRow } from '../components/TxRow';

type Tab = 'daily' | 'calendar' | 'monthly' | 'settle' | 'memo';
const TABS: { id: Tab; label: string }[] = [
  { id: 'daily', label: '일일' },
  { id: 'calendar', label: '달력' },
  { id: 'monthly', label: '월별' },
  { id: 'settle', label: '결산' },
  { id: 'memo', label: '메모' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const md = (date: string) => `${date.slice(5, 7)}.${date.slice(8, 10)}`;
const short = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString('ko-KR'));
const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};
type Lookups = NonNullable<ReturnType<typeof useLookups>>;

export function History() {
  const startDay = useStartDay();
  const [tab, setTab] = useState<Tab>('daily');
  const [picked, setPicked] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [f, setF] = useState<TxFilter>(EMPTY_FILTER);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const lookups = useLookups();
  const data = useLive(async (repo) => ({ txs: await repo.listTransactions(), refunds: await repo.listRefunds() }));
  if (!data || !lookups || !startDay) return <p className="loading">불러오는 중…</p>;

  const month = picked ?? currentPeriod(startDay);
  const thisPeriod = currentPeriod(startDay);
  const shownYear = year ?? Number(month.slice(0, 4));
  const now = today();
  const filtered = filterTransactions(data.txs, month, f, startDay).sort(sortTxDesc);
  const refunded = new Map<string, number>();
  data.refunds.forEach((r) => refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount));
  const activeFilters = [f.type, f.categoryId, f.paymentMethodId, f.recordMethod].filter(Boolean).length + (f.query ? 1 : 0);
  const set = <K extends keyof TxFilter>(k: K, v: TxFilter[K]) => setF({ ...f, [k]: v });

  const changeMonth = (m: string) => {
    setPicked(m);
    setDay(null);
  };
  const shift = (delta: number) => {
    if (tab === 'monthly') setYear(shownYear + delta);
    else changeMonth(shiftMonth(month, delta));
  };

  // 합계 줄: 월별 탭은 그해 전체, 나머지는 선택한 기간(검색·필터 반영)
  const range = tab === 'monthly'
    ? { from: periodRange(`${shownYear}-01`, startDay).from, to: periodRange(`${shownYear}-12`, startDay).to }
    : periodRange(month, startDay);
  const totals = rangeTotals(range.from, range.to, tab === 'monthly' ? data.txs : filtered, data.refunds);

  const row = (t: Transaction) => (
    <TxRow key={t.id} tx={t} refunded={refunded.get(t.id)} catName={lookups.catName} pmName={lookups.pmName} />
  );
  const dayGroups = (list: Transaction[]) => {
    const groups = new Map<string, Transaction[]>();
    list.forEach((t) => groups.set(t.date, [...(groups.get(t.date) ?? []), t]));
    return [...groups.entries()].map(([date, items]) => {
      const tt = rangeTotals(date, date, items, []);
      const wd = weekdayOf(date);
      return (
        <section key={date} className="card day-card">
          <div className="day-head">
            <span className={`day-title ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}`}>{dayLabel(date)}</span>
            <span className="day-sum">
              {tt.income > 0 && <span className="pos">+{formatWon(tt.income)}</span>}
              {tt.expense > 0 && <span className="neg">-{formatWon(tt.expense)}</span>}
              {tt.savings > 0 && <span className="refund">🐷 {formatWon(tt.savings)}</span>}
            </span>
          </div>
          <ul className="tx-list">{items.map(row)}</ul>
        </section>
      );
    });
  };

  return (
    <div className="page history">
      <header className="page-header hist-header">
        <div className="hist-nav">
          <button type="button" className="hist-arrow" aria-label={tab === 'monthly' ? '이전 해' : '이전 달'} onClick={() => shift(-1)}>‹</button>
          <h1 aria-live="polite">{tab === 'monthly' ? `${shownYear}년` : periodLabel(month, startDay)}</h1>
          <button type="button" className="hist-arrow" aria-label={tab === 'monthly' ? '다음 해' : '다음 달'} onClick={() => shift(1)}>›</button>
        </div>
        <div className="hist-tools">
          <button type="button" className="tool-btn" aria-label="검색" aria-pressed={showSearch} onClick={() => setShowSearch(!showSearch)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
          </button>
          <button
            type="button"
            className="tool-btn"
            aria-label={`필터${activeFilters ? ` ${activeFilters}개 적용 중` : ''}`}
            aria-pressed={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.2" /><circle cx="15" cy="17" r="2.2" /></svg>
            {activeFilters > 0 && <span className="tool-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <nav className="hist-tabs" role="tablist" aria-label="보기">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="hist-tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <section className="hist-totals" aria-label="합계">
        <div><span className="label">수입</span><strong className="pos">{formatWon(totals.income)}</strong></div>
        <div><span className="label">지출</span><strong className="neg">{formatWon(totals.expense)}</strong></div>
        <div><span className="label">합계</span><strong>{formatWon(totals.total)}</strong></div>
      </section>

      {showSearch && (
        <label className="field" style={{ marginTop: 8 }}>
          <span className="visually-hidden">검색</span>
          <input type="search" autoFocus placeholder="가맹점·메모 검색" value={f.query} onChange={(e) => set('query', e.target.value)} />
        </label>
      )}
      {showFilters && (
        <div className="card form" style={{ marginTop: 8 }}>
          <div className="row">
            <label className="field"><span>유형</span>
              <select value={f.type} onChange={(e) => set('type', e.target.value as TxFilter['type'])}>
                <option value="">전체</option>
                {(['expense', 'income', 'transfer'] as const).map((t) => <option key={t} value={t}>{TX_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>기록 방식</span>
              <select value={f.recordMethod} onChange={(e) => set('recordMethod', e.target.value as TxFilter['recordMethod'])}>
                <option value="">전체</option>
                {(['manual', 'auto', 'confirmed'] as const).map((m) => <option key={m} value={m}>{RECORD_METHOD_LABEL[m]}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
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
          </div>
          <button type="button" className="btn" onClick={() => setF(EMPTY_FILTER)}>필터·검색 초기화</button>
        </div>
      )}

      {tab === 'daily' && (filtered.length === 0 ? <EmptyArt>데이터가 없어요.</EmptyArt> : dayGroups(filtered))}

      {tab === 'calendar' && (
        <>
          <div className="fcal" role="grid" aria-label={`${periodLabel(month, startDay)} 달력`}>
            <div className="fcal-row" role="row">
              {WEEKDAYS.map((w, i) => <span key={w} role="columnheader" className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
            </div>
            <div className="fcal-grid">
              {calendarGrid(month, startDay).map((c, i) => {
                const tt = rangeTotals(c.date, c.date, c.inPeriod ? filtered : data.txs, data.refunds);
                const d = Number(c.date.slice(8, 10));
                const wd = i % 7;
                return (
                  <button
                    key={c.date}
                    type="button"
                    role="gridcell"
                    className={`fcal-cell${c.inPeriod ? '' : ' out'}${c.date === now ? ' today' : ''}${day === c.date ? ' sel' : ''}`}
                    aria-label={`${dayLabel(c.date)} 수입 ${tt.income}원 지출 ${tt.expense}원`}
                    aria-selected={day === c.date}
                    onClick={() => (c.inPeriod ? setDay(c.date) : changeMonth(periodKey(c.date, startDay)))}
                  >
                    <span className={`fcal-num ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}`}>{d === 1 ? `${Number(c.date.slice(5, 7))}.1` : d}</span>
                    {tt.income > 0 && <span className="fcal-amt pos">{short(tt.income)}</span>}
                    {tt.expense > 0 && <span className="fcal-amt neg">{short(tt.expense)}</span>}
                    {tt.savings > 0 && <span className="fcal-amt refund">🐷{short(tt.savings)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {day && (() => {
            const items = filtered.filter((t) => t.date === day);
            return items.length ? dayGroups(items) : <EmptyArt pose="write">{dayLabel(day)}에는 기록이 없어요.</EmptyArt>;
          })()}
        </>
      )}

      {tab === 'monthly' && (
        <ul className="mlist">
          {Array.from({ length: 12 }, (_, i) => `${shownYear}-${String(12 - i).padStart(2, '0')}`)
            .filter((m) => m <= thisPeriod)
            .map((m) => {
              const r = periodRange(m, startDay);
              const tt = rangeTotals(r.from, r.to, data.txs, data.refunds);
              const open = (expanded ?? thisPeriod) === m;
              return (
                <li key={m}>
                  <button type="button" className="mrow" aria-expanded={open} onClick={() => setExpanded(open ? '' : m)}>
                    <span className="mname">
                      <strong>{Number(m.slice(5))}월</strong>
                      {open && <span className="small muted">{md(r.from)} ~ {md(r.to)}</span>}
                    </span>
                    <span className="pos">{formatWon(tt.income)}</span>
                    <span className="mright"><span className="neg">{formatWon(tt.expense)}</span><span className="small muted">{formatWon(tt.total)}</span></span>
                  </button>
                  {open && (
                    <ul className="wlist">
                      {weekRanges(m, startDay).map((w) => {
                        const wt = rangeTotals(w.from, w.to, data.txs, data.refunds);
                        const cur = now >= w.from && now <= w.to;
                        return (
                          <li key={w.from} className={cur ? 'cur' : undefined}>
                            <span className="wname">{md(w.from)} ~ {md(w.to)}{cur && <span className="small muted">이번 주</span>}</span>
                            <span className="pos">{formatWon(wt.income)}</span>
                            <span className="mright"><span className="neg">{formatWon(wt.expense)}</span><span className="small muted">합계 {formatWon(wt.total)}</span></span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          {shownYear > Number(thisPeriod.slice(0, 4)) && <li><EmptyArt>아직 오지 않은 해예요.</EmptyArt></li>}
        </ul>
      )}

      {tab === 'settle' && <Settlement month={month} startDay={startDay} txs={data.txs} refunds={data.refunds} lookups={lookups} />}

      {tab === 'memo' && (
        <MemoTab
          month={month}
          startDay={startDay}
          txs={filtered}
          query={f.query}
          catName={lookups.catName}
          composeOpen={memoOpen}
          onCloseCompose={() => setMemoOpen(false)}
        />
      )}

      {tab === 'memo' ? (
        <button type="button" className="fab" aria-label="메모 쓰기" aria-haspopup="dialog" onClick={() => setMemoOpen(true)}>+</button>
      ) : (
        <Link to="/tx/new" className="fab" aria-label="거래 추가">+</Link>
      )}
    </div>
  );
}

function Settlement({ month, startDay, txs, refunds, lookups }: {
  month: string;
  startDay: number;
  txs: Transaction[];
  refunds: Refund[];
  lookups: Lookups;
}) {
  const budget = useLive((r) => r.getBudget(month), [month]);
  const s = summarizeMonth(month, txs, refunds, budget, startDay);
  const top = s.byCategory.filter((c) => c.amount > 0).slice(0, 3);
  const kinds = spendByPaymentKind(month, txs, refunds, lookups.methods, startDay);
  if (s.income + s.expense + s.savings === 0) return <EmptyArt>이 달은 정산할 기록이 없어요.</EmptyArt>;
  return (
    <>
      <section className="card">
        <div className="recap-head">
          <Sticker pose="write" size={46} tilt={-5} />
          <h2>{periodLabel(month, startDay)} 결산</h2>
        </div>
        <div className="budget-row"><span>수입</span><strong className="pos">{formatWon(s.income)}</strong></div>
        <div className="budget-row"><span>지출</span><strong className="neg">{formatWon(s.expense)}</strong></div>
        <div className="budget-row small muted"><span>　ㄴ 고정 / 변동</span><span>{formatWon(s.fixedExpense)} / {formatWon(s.variableExpense)}</span></div>
        {s.refund > 0 && <div className="budget-row"><span>환불</span><strong className="refund">-{formatWon(s.refund)}</strong></div>}
        <div className="budget-row"><span>저축</span><strong className="refund">{formatWon(s.savings)}</strong></div>
        {s.savings > 0 && (
          <div className="budget-row small muted">
            <span>　ㄴ 단기 / 중기 / 장기</span>
            <span>{(['short', 'mid', 'long'] as const).map((t) => formatWon(s.savingsByTerm[t])).join(' / ')}</span>
          </div>
        )}
        <div className="budget-row settle-total"><span>남은 돈 (수입 − 순지출 − 저축)</span><strong>{formatWon(s.income - s.netSpend - s.savings)}</strong></div>
      </section>
      {s.budget !== undefined && (
        <section className="card">
          <div className="budget-row"><span>예산</span><strong>{formatWon(s.budget)}</strong></div>
          <div className="budget-row">
            <span>{(s.remaining ?? 0) < 0 ? '예산 초과' : '예산 남김'}</span>
            <strong className={(s.remaining ?? 0) < 0 ? 'neg' : 'refund'}>{formatWon(Math.abs(s.remaining ?? 0))}</strong>
          </div>
        </section>
      )}
      {top.length > 0 && (
        <section className="card">
          <h2>많이 쓴 곳</h2>
          {top.map((c, i) => (
            <div key={c.categoryId} className="budget-row" style={{ marginTop: 6 }}>
              <span>{i + 1}. {lookups.catName(c.categoryId)}</span><strong>{formatWon(c.amount)}</strong>
            </div>
          ))}
        </section>
      )}
      {kinds.length > 0 && (
        <section className="card">
          <h2>결제수단별</h2>
          {kinds.map((k) => (
            <div key={k.kind} className="budget-row" style={{ marginTop: 6 }}>
              <span>{PAYMENT_KIND_LABEL[k.kind]} <span className="small muted">{k.count}건</span></span><strong>{formatWon(k.amount)}</strong>
            </div>
          ))}
        </section>
      )}
      <p className="small muted" style={{ textAlign: 'center' }}><Link to="/stats">통계에서 더 보기</Link></p>
    </>
  );
}
