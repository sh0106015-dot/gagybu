import { useState } from 'react';
import { monthlyTrend, summarizeMonth } from '../../core/budget';
import { shiftMonth } from '../../core/dates';
import { formatWon } from '../../core/money';
import { useLive, useLookups } from '../hooks';
import { currentMonth, monthLabel } from '../format';
import { MonthNav } from '../components/MonthNav';
import { PageHeader } from '../components/PageHeader';

export function Stats() {
  const [month, setMonth] = useState(currentMonth());
  const lookups = useLookups();
  const data = useLive(async (repo) => ({
    txs: await repo.listTransactions(),
    refunds: await repo.listRefunds(),
    budget: await repo.getBudget(month),
  }), [month]);
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget);
  const prev = summarizeMonth(shiftMonth(month, -1), data.txs, data.refunds);
  const diff = s.netSpend - prev.netSpend;
  const trend = monthlyTrend(month, 6, data.txs, data.refunds);
  const maxTrend = Math.max(1, ...trend.map((t) => t.netSpend));
  const positives = s.byCategory.filter((c) => c.amount > 0);

  return (
    <div className="page">
      <PageHeader title="통계" />
      <MonthNav month={month} onChange={setMonth} />

      <section className="card">
        <div className="budget-row"><span>지출</span><strong className="neg">{formatWon(s.expense)}</strong></div>
        <div className="budget-row"><span>환불</span><strong className="refund">-{formatWon(s.refund)}</strong></div>
        <div className="budget-row"><span>순지출</span><strong>{formatWon(s.netSpend)}</strong></div>
        <div className="budget-row"><span>수입</span><strong className="pos">{formatWon(s.income)}</strong></div>
        <p className="small muted">
          전월 대비 {diff === 0 ? '변동 없음' : `${diff > 0 ? '▲ 증가' : '▼ 감소'} ${formatWon(Math.abs(diff))}`}
        </p>
      </section>

      <section className="card">
        <h2>카테고리별 소비</h2>
        {s.netSpend <= 0 || positives.length === 0 ? (
          <ul className="list" style={{ marginTop: 8 }}>
            {s.byCategory.length === 0 && <li className="muted">이 달의 지출이 없어요.</li>}
            {s.byCategory.map((c) => (
              <li key={c.categoryId} className="budget-row"><span>{lookups.catName(c.categoryId)}</span><span>{formatWon(c.amount)}</span></li>
            ))}
          </ul>
        ) : (
          positives.map((c) => {
            const pct = Math.round((c.amount / s.netSpend) * 100);
            return (
              <div key={c.categoryId} className="hbar">
                <span>{lookups.catName(c.categoryId)}</span>
                <div className="bar" aria-hidden="true"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <span className="small">{formatWon(c.amount)} · {pct}%</span>
              </div>
            );
          })
        )}
      </section>

      <section className="card">
        <h2>최근 6개월 순지출</h2>
        <svg viewBox="0 0 300 140" width="100%" role="img" aria-label="최근 6개월 순지출 막대 그래프">
          {trend.map((t, i) => {
            const h = Math.max(0, (t.netSpend / maxTrend) * 100);
            const x = 10 + i * 48;
            return (
              <g key={t.month}>
                <rect x={x} y={110 - h} width="32" height={h} rx="4" fill={t.month === month ? 'var(--accent)' : 'var(--line)'} />
                <text x={x + 16} y="128" textAnchor="middle" fontSize="11" fill="var(--muted)">{Number(t.month.slice(5))}월</text>
              </g>
            );
          })}
        </svg>
        <ul className="list small">
          {trend.map((t) => (
            <li key={t.month} className="budget-row"><span>{monthLabel(t.month)}</span><span>{formatWon(t.netSpend)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
