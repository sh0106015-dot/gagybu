import { shiftMonth } from '../../core/dates';
import { periodLabel } from '../../core/period';

export function MonthNav({ month, startDay = 1, onChange }: { month: string; startDay?: number; onChange: (m: string) => void }) {
  return (
    <div className="month-nav">
      <button type="button" className="arrow-btn" aria-label="이전 달" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
      <span className="month-pill" aria-live="polite">{periodLabel(month, startDay)}</span>
      <button type="button" className="arrow-btn" aria-label="다음 달" onClick={() => onChange(shiftMonth(month, 1))}>›</button>
    </div>
  );
}
