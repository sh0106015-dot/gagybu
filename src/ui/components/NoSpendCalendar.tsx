import type { NoSpendDay } from '../../core/insights';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 무지출 달력. 무지출한 날은 ○, 지출한 날은 ●로 표시해 색 없이도 구분된다. */
export function NoSpendCalendar({ days }: { days: NoSpendDay[] }) {
  if (days.length === 0) return null;
  const [y, m, d] = days[0].date.split('-').map(Number);
  const lead = new Date(y, m - 1, d).getDay();
  return (
    <div className="ns-cal" role="table" aria-label="무지출 달력">
      <div className="ns-row" role="row">
        {WEEKDAYS.map((w) => <span key={w} className="ns-head" role="columnheader">{w}</span>)}
      </div>
      <div className="ns-grid">
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
        {days.map((day) => {
          const dd = Number(day.date.slice(8, 10));
          const state = day.future ? 'future' : day.spent ? 'spent' : 'saved';
          const label = day.future ? '' : day.spent ? '지출 있음' : '무지출';
          return (
            <span key={day.date} className={`ns-day ns-${state}`} role="cell" aria-label={`${Number(day.date.slice(5, 7))}월 ${dd}일 ${label}`}>
              <span className="ns-num">{dd}</span>
              <span aria-hidden="true">{day.future ? '' : day.spent ? '●' : '○'}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
