import { Link } from 'react-router-dom';
import type { MonthSummary } from '../../core/budget';
import { formatWon } from '../../core/money';

export function BudgetBar({ summary }: { summary: MonthSummary }) {
  if (summary.budget === undefined) {
    return (
      <p className="muted">
        예산이 없어요. <Link to="/settings/budget">이번 달 예산 설정하기</Link>
      </p>
    );
  }
  const rate = summary.usageRate ?? 0;
  const pct = Math.round(rate * 100);
  const over = (summary.remaining ?? 0) < 0;
  return (
    <div className="budget">
      <div className="budget-row">
        <span>{over ? '예산 초과' : '남은 예산'}</span>
        <strong className={over ? 'neg' : undefined}>{formatWon(Math.abs(summary.remaining ?? 0))}</strong>
      </div>
      <div
        className={`bar ${over ? 'bar-over' : pct >= 80 ? 'bar-warn' : ''}`}
        role="progressbar"
        aria-label="예산 사용률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
      >
        <span style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
      <div className="budget-row small muted">
        <span>사용률 {pct}%{pct >= 80 && !over ? ' · 80% 넘음' : ''}</span>
        <span>예산 {formatWon(summary.budget)}</span>
      </div>
    </div>
  );
}
