import { shiftMonth } from '../../core/dates';
import { monthLabel } from '../format';

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="month-nav">
      <button type="button" className="arrow-btn" aria-label="이전 달" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
      <span className="month-pill" aria-live="polite">{monthLabel(month)}</span>
      <button type="button" className="arrow-btn" aria-label="다음 달" onClick={() => onChange(shiftMonth(month, 1))}>›</button>
    </div>
  );
}
