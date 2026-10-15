import type { DayTotal } from '../../core/insights';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const short = (n: number) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString('ko-KR'));

/** 내역 달력. 날짜마다 지출(−, 빨강)과 수입(+, 파랑)을 기호와 색으로 함께 보여준다. */
export function CalendarView({ days, selected, today, onSelect }: {
  days: DayTotal[];
  selected: string | null;
  today: string;
  onSelect: (date: string) => void;
}) {
  if (days.length === 0) return null;
  const [y, m, d] = days[0].date.split('-').map(Number);
  const lead = new Date(y, m - 1, d).getDay();
  return (
    <div className="cal card">
      <div className="cal-grid cal-head" aria-hidden="true">
        {WEEKDAYS.map((w, i) => <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {days.map((day, i) => {
          const dd = Number(day.date.slice(8, 10));
          const wd = (lead + i) % 7;
          const net = day.expense - day.refund;
          const label = `${Number(day.date.slice(5, 7))}월 ${dd}일, 지출 ${net}원, 수입 ${day.income}원, ${day.count}건`;
          return (
            <button
              key={day.date}
              type="button"
              className={`cal-day${selected === day.date ? ' cal-selected' : ''}${day.date === today ? ' cal-today' : ''}`}
              aria-label={label}
              aria-pressed={selected === day.date}
              onClick={() => onSelect(day.date)}
            >
              <span className={`cal-num ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}`}>{dd}</span>
              {net > 0 && <span className="cal-amt neg">-{short(net)}</span>}
              {day.income > 0 && <span className="cal-amt pos">+{short(day.income)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
