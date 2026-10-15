import { useState } from 'react';
import { monthlyTrend, summarizeMonth } from '../../core/budget';
import { shiftMonth } from '../../core/dates';
import { categoryBudgetStatus, categoryVsAverage, noSpendDays, spendByPaymentKind } from '../../core/insights';
import { PAYMENT_KIND_LABEL } from '../../core/model';
import { formatWon } from '../../core/money';
import { periodLabel } from '../../core/period';
import { useLive, useLookups, useStartDay } from '../hooks';
import { currentPeriod, today } from '../format';
import { MonthNav } from '../components/MonthNav';
import { NoSpendCalendar } from '../components/NoSpendCalendar';
import { PageHeader } from '../components/PageHeader';

export function Stats() {
  const startDay = useStartDay();
  const [picked, setMonth] = useState<string | null>(null);
  const month = picked ?? (startDay ? currentPeriod(startDay) : '');
  const lookups = useLookups();
  const data = useLive(async (repo) => ({
    txs: await repo.listTransactions(),
    refunds: await repo.listRefunds(),
    budget: month ? await repo.getBudget(month) : undefined,
  }), [month]);
  if (!data || !lookups || !startDay) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget, startDay);
  const prev = summarizeMonth(shiftMonth(month, -1), data.txs, data.refunds, undefined, startDay);
  const diff = s.netSpend - prev.netSpend;
  const trend = monthlyTrend(month, 6, data.txs, data.refunds, startDay);
  const maxTrend = Math.max(1, ...trend.map((t) => t.netSpend));
  const positives = s.byCategory.filter((c) => c.amount > 0);
  const vsAvg = categoryVsAverage(month, data.txs, data.refunds, startDay);
  const ns = noSpendDays(month, data.txs, startDay, today());
  const catBudgets = categoryBudgetStatus(s, data.budget);
  const byKind = spendByPaymentKind(month, data.txs, data.refunds, lookups.methods, startDay);
  const kindTotal = byKind.reduce((s2, k) => s2 + Math.max(0, k.amount), 0);
  const short = (m: string) => (startDay === 1 ? `${Number(m.slice(5))}월` : `${Number(m.slice(5))}/${startDay}~`);

  return (
    <div className="page">
      <PageHeader title="통계" />
      <MonthNav month={month} startDay={startDay} onChange={setMonth} />

      <section className="card">
        <div className="budget-row"><span>지출</span><strong className="neg">{formatWon(s.expense)}</strong></div>
        <div className="budget-row small muted"><span>　ㄴ 고정지출</span><span>{formatWon(s.fixedExpense)}</span></div>
        <div className="budget-row small muted"><span>　ㄴ 변동지출</span><span>{formatWon(s.variableExpense)}</span></div>
        <div className="budget-row"><span>환불</span><strong className="refund">-{formatWon(s.refund)}</strong></div>
        <div className="budget-row"><span>순지출</span><strong>{formatWon(s.netSpend)}</strong></div>
        <div className="budget-row"><span>수입</span><strong className="pos">{formatWon(s.income)}</strong></div>
        <p className="small muted">
          전월 대비 {diff === 0 ? '변동 없음' : `${diff > 0 ? '▲ 증가' : '▼ 감소'} ${formatWon(Math.abs(diff))}`}
        </p>
      </section>

      <section className="card">
        <h2>무지출 챌린지</h2>
        <p className="small" style={{ margin: '4px 0' }}>
          <strong className="refund">○ 무지출 {ns.count}일</strong>
          <span className="muted"> / 지난 {ns.elapsed}일 · ● 지출한 날 · 고정지출은 세지 않아요</span>
        </p>
        <NoSpendCalendar days={ns.days} />
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

      {catBudgets.length > 0 && (
        <section className="card">
          <h2>카테고리 예산</h2>
          {catBudgets.map((c) => {
            const pct = Math.round(c.rate * 100);
            const over = c.remaining < 0;
            return (
              <div key={c.categoryId} style={{ margin: '8px 0' }}>
                <div className="budget-row small">
                  <span><strong>{lookups.catName(c.categoryId)}</strong> {formatWon(c.spent)} / {formatWon(c.budget)}</span>
                  <span className={over ? 'neg' : 'refund'}>{over ? `${formatWon(-c.remaining)} 초과` : `${formatWon(c.remaining)} 남음`}</span>
                </div>
                <div className={`bar ${over ? 'bar-over' : pct >= 80 ? 'bar-warn' : ''}`} role="progressbar" aria-label={`${lookups.catName(c.categoryId)} 예산 사용률`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)}>
                  <span style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <h2>결제수단별 지출</h2>
        {byKind.length === 0 ? (
          <p className="muted small">이 달의 지출이 없어요.</p>
        ) : (
          byKind.map((k) => {
            const pct = kindTotal > 0 ? Math.round((Math.max(0, k.amount) / kindTotal) * 100) : 0;
            return (
              <div key={k.kind} className="hbar">
                <span>{PAYMENT_KIND_LABEL[k.kind]}</span>
                <div className="bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                <span className="small">{formatWon(k.amount)} · {pct}% · {k.count}건</span>
              </div>
            );
          })
        )}
        <p className="small muted" style={{ margin: '6px 0 0' }}>환불은 원래 결제한 수단에서 빼고 계산해요. 이체는 포함하지 않아요.</p>
      </section>

      <section className="card">
        <h2>최근 3개월 평균과 비교</h2>
        {vsAvg.length === 0 ? (
          <p className="muted small">이 달의 지출이 없어요.</p>
        ) : (
          <ul className="list small" style={{ marginTop: 8 }}>
            {vsAvg.map((c) => (
              <li key={c.categoryId} className="budget-row">
                <span>{lookups.catName(c.categoryId)}</span>
                <span>
                  {formatWon(c.amount)}{' '}
                  {c.diffRate === undefined ? (
                    <span className="muted">(이전 기록 없음)</span>
                  ) : (
                    <span className={c.diffRate > 0 ? 'vs-up' : 'vs-down'}>
                      {c.diffRate > 0 ? '▲' : '▼'} {Math.abs(Math.round(c.diffRate * 100))}%
                    </span>
                  )}
                  <span className="muted"> · 평균 {formatWon(c.average)}</span>
                </span>
              </li>
            ))}
          </ul>
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
                <rect x={x} y={110 - h} width="32" height={h} rx="4" fill={t.month === month ? 'var(--accent)' : 'var(--line-strong)'} />
                <text x={x + 16} y="128" textAnchor="middle" fontSize="11" fill="var(--muted)">{short(t.month)}</text>
              </g>
            );
          })}
        </svg>
        <ul className="list small">
          {trend.map((t) => (
            <li key={t.month} className="budget-row"><span>{periodLabel(t.month, startDay)}</span><span>{formatWon(t.netSpend)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
