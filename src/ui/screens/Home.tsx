import { Link } from 'react-router-dom';
import { summarizeMonth } from '../../core/budget';
import { formatWon } from '../../core/money';
import { useLive, useLookups } from '../hooks';
import { currentMonth, monthLabel, sortTxDesc, timeLabel } from '../format';
import { BudgetBar } from '../components/BudgetBar';
import { TxRow } from '../components/TxRow';

export function Home() {
  const month = currentMonth();
  const lookups = useLookups();
  const data = useLive(async (repo) => {
    const [txs, refunds, budget, candidates, auto] = await Promise.all([
      repo.listTransactions(), repo.listRefunds(), repo.getBudget(month), repo.listCandidates(), repo.getAutoSettings(),
    ]);
    return { txs, refunds, budget, pending: candidates.filter((c) => c.status === 'pending').length, auto };
  }, [month]);
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget);
  const refunded = new Map<string, number>();
  data.refunds.forEach((r) => refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount));
  const recent = [...data.txs].sort(sortTxDesc).slice(0, 5);
  const a = data.auto;
  const autoText = !a.enabled
    ? '자동 기록 꺼짐'
    : a.permission !== 'granted'
      ? '알림 접근 권한이 필요해요'
      : `자동 기록 켜짐${a.lastProcessedAt ? ` · 마지막 처리 ${timeLabel(a.lastProcessedAt)}` : ' · 아직 처리한 알림 없음'}`;
  const autoState = !a.enabled ? 'off' : a.permission !== 'granted' ? 'warn' : 'on';

  return (
    <div className="page">
      <header className="page-header"><h1>{monthLabel(month)}</h1></header>

      <section className="card">
        <p className="muted small">이번 달 순지출</p>
        <p className="big">{formatWon(s.netSpend)}</p>
        <BudgetBar summary={s} />
      </section>

      {data.pending > 0 && (
        <Link to="/inbox" className="card banner">
          <span>확인이 필요한 내역</span>
          <strong>{data.pending}건 ›</strong>
        </Link>
      )}

      <Link to="/settings/auto" className={`card status status-${autoState}`}>
        <span className="dot" aria-hidden="true" />
        <span>{autoText}</span>
      </Link>

      <section>
        <div className="section-head">
          <h2>최근 거래</h2>
          <Link to="/history">전체 보기</Link>
        </div>
        {recent.length === 0 ? (
          <p className="empty">아직 거래가 없어요. + 버튼으로 첫 거래를 기록해 보세요.</p>
        ) : (
          <ul className="tx-list">
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} refunded={refunded.get(t.id)} catName={lookups.catName} pmName={lookups.pmName} />
            ))}
          </ul>
        )}
      </section>

      <Link to="/tx/new" className="fab" aria-label="거래 추가">+</Link>
    </div>
  );
}
