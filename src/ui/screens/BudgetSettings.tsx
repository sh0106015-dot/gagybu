import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { summarizeMonth } from '../../core/budget';
import { shiftMonth } from '../../core/dates';
import { suggestBudget } from '../../core/insights';
import { formatWon, parseWon } from '../../core/money';
import { periodLabel } from '../../core/period';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { currentPeriod } from '../format';
import { PageHeader } from '../components/PageHeader';

const toText = (n: number) => (n ? n.toLocaleString('ko-KR') : '');
const onlyDigits = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 13);
  return d ? Number(d).toLocaleString('ko-KR') : '';
};

export function BudgetSettings() {
  const { repo } = useServices();
  const navigate = useNavigate();
  const data = useLive(async (r) => {
    const app = await r.getAppSettings();
    const startDay = app.monthStartDay ?? 1;
    const month = currentPeriod(startDay);
    const [cur, prev, txs, refunds] = await Promise.all([
      r.getBudget(month), r.getBudget(shiftMonth(month, -1)), r.listTransactions(), r.listRefunds(),
    ]);
    const past = [1, 2, 3].map((i) => summarizeMonth(shiftMonth(month, -i), txs, refunds, undefined, startDay));
    return {
      app, startDay, month, cur, prev,
      lastIncome: past[0].income,
      avgFixed: Math.round(past.reduce((s, p) => s + p.fixedExpense, 0) / 3),
    };
  });
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [income, setIncome] = useState('');
  const [saving, setSaving] = useState('');
  const [fixed, setFixed] = useState('');

  useEffect(() => {
    if (!data) return;
    if (data.cur) setText(toText(data.cur.total));
    setIncome((v) => v || toText(data.lastIncome));
    setFixed((v) => v || toText(data.avgFixed));
  }, [data?.cur, data?.lastIncome, data?.avgFixed]);

  if (!data) return <p className="loading">불러오는 중…</p>;
  const { month, startDay } = data;
  const plan = suggestBudget({ income: parseWon(income) ?? 0, saving: parseWon(saving) ?? 0, fixed: parseWon(fixed) ?? 0 });

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

  const changeStartDay = async (day: number) => {
    await repo.commit({ appSettings: { ...data.app, monthStartDay: day } });
    setText('');
  };

  return (
    <div className="page">
      <PageHeader title="월 예산" back />

      <section className="card form">
        <label className="field">
          <span>한 달 시작일 (월급날에 맞추면 편해요)</span>
          <select value={startDay} onChange={(e) => changeStartDay(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d === 1 ? '매달 1일 (달력 기준)' : `매달 ${d}일`}</option>
            ))}
          </select>
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          이번 달 기간: <strong>{periodLabel(month, startDay)}</strong>. 바꾸면 홈·내역·통계·예산이 모두 이 기간으로 계산돼요.
        </p>
      </section>

      <form className="card form" onSubmit={save} noValidate>
        <label className="field">
          <span>{periodLabel(month, startDay)} 전체 예산 (원)</span>
          <input inputMode="numeric" value={text} onChange={(e) => setText(onlyDigits(e.target.value))} />
        </label>
        {data.prev && !data.cur && (
          <button type="button" className="btn" onClick={() => setText(toText(data.prev!.total))}>
            지난달과 같게 ({formatWon(data.prev.total)})
          </button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-big">저장</button>
      </form>

      <section className="card form">
        <h2>저축 먼저 예산 계산기</h2>
        <p className="small muted" style={{ margin: 0 }}>수입에서 저축할 돈을 먼저 떼고, 남은 돈으로 한 달을 살아요.</p>
        <ul className="form-list">
          <li><label className="form-row"><span>월 수입</span><input inputMode="numeric" value={income} onChange={(e) => setIncome(onlyDigits(e.target.value))} placeholder="0" /></label></li>
          <li><label className="form-row"><span>저축 목표</span><input inputMode="numeric" value={saving} onChange={(e) => setSaving(onlyDigits(e.target.value))} placeholder="0" /></label></li>
          <li><label className="form-row"><span>고정지출</span><input inputMode="numeric" value={fixed} onChange={(e) => setFixed(onlyDigits(e.target.value))} placeholder="0" /></label></li>
        </ul>
        <p className="small muted" style={{ margin: 0 }}>수입은 지난달 기록, 고정지출은 최근 3개월 평균으로 미리 채웠어요.</p>
        <div className="trio" style={{ padding: '6px 0' }}>
          <div><span className="label">한 달 예산</span><strong>{formatWon(plan.budget)}</strong></div>
          <div><span className="label">고정지출</span><strong className="neg">{formatWon(parseWon(fixed) ?? 0)}</strong></div>
          <div><span className="label">생활비</span><strong className="refund">{formatWon(plan.living)}</strong></div>
        </div>
        <button type="button" className="btn" disabled={plan.budget < 1} onClick={() => { setText(toText(plan.budget)); setError(null); }}>
          이 금액을 예산 칸에 넣기
        </button>
      </section>

      <p className="small muted">예산은 기간마다 따로 저장돼요. 카테고리별 예산은 다음 버전에서 제공할 예정이에요.</p>
    </div>
  );
}
