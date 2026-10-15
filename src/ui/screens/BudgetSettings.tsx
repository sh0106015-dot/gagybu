import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftMonth } from '../../core/dates';
import { formatWon, parseWon } from '../../core/money';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { currentMonth, monthLabel } from '../format';
import { PageHeader } from '../components/PageHeader';

export function BudgetSettings() {
  const month = currentMonth();
  const { repo } = useServices();
  const navigate = useNavigate();
  const data = useLive(async (r) => ({ cur: await r.getBudget(month), prev: await r.getBudget(shiftMonth(month, -1)) }), [month]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.cur) setText(data.cur.total.toLocaleString('ko-KR'));
  }, [data?.cur]);

  if (!data) return <p className="loading">불러오는 중…</p>;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const total = parseWon(text);
    if (total === null || total < 1) {
      setError('예산을 1원 이상 입력하세요');
      return;
    }
    await repo.commit({ budgets: [{ month, total }] });
    navigate(-1);
  };

  return (
    <div className="page">
      <PageHeader title="월 예산" back />
      <form className="form" onSubmit={save} noValidate>
        <label className="field">
          <span>{monthLabel(month)} 전체 예산 (원)</span>
          <input
            inputMode="numeric"
            value={text}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '');
              setText(d ? Number(d).toLocaleString('ko-KR') : '');
            }}
          />
        </label>
        {data.prev && !data.cur && (
          <button type="button" className="btn" onClick={() => setText(data.prev!.total.toLocaleString('ko-KR'))}>
            지난달과 같게 ({formatWon(data.prev.total)})
          </button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">저장</button>
      </form>
      <p className="small muted">예산은 달마다 따로 저장돼요. 카테고리별 예산은 다음 버전에서 제공할 예정이에요.</p>
    </div>
  );
}
