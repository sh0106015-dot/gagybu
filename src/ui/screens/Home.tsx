import { Link } from 'react-router-dom';
import { summarizeDay, summarizeMonth } from '../../core/budget';
import { formatWon } from '../../core/money';
import { useLive, useLookups } from '../hooks';
import { currentMonth, sortTxDesc, timeLabel, today } from '../format';
import { BudgetBar } from '../components/BudgetBar';
import { Icon, type IconName } from '../components/Icon';
import { TxRow } from '../components/TxRow';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function Home() {
  const month = currentMonth();
  const date = today();
  const lookups = useLookups();
  const data = useLive(async (repo) => {
    const [txs, refunds, budget, candidates, auto] = await Promise.all([
      repo.listTransactions(), repo.listRefunds(), repo.getBudget(month), repo.listCandidates(), repo.getAutoSettings(),
    ]);
    return { txs, refunds, budget, pending: candidates.filter((c) => c.status === 'pending').length, auto };
  }, [month]);
  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget);
  const d = summarizeDay(date, data.txs, data.refunds);
  const refunded = new Map<string, number>();
  data.refunds.forEach((r) => refunded.set(r.originalTxId, (refunded.get(r.originalTxId) ?? 0) + r.amount));
  const recent = [...data.txs].sort(sortTxDesc).slice(0, 5);
  const now = new Date();

  const a = data.auto;
  const autoText = !a.enabled
    ? '자동 기록 꺼짐'
    : a.permission !== 'granted'
      ? '알림 접근 권한이 필요해요'
      : `자동 기록 켜짐${a.lastProcessedAt ? ` · 마지막 처리 ${timeLabel(a.lastProcessedAt)}` : ' · 아직 처리한 알림 없음'}`;
  const autoState = !a.enabled ? 'off' : a.permission !== 'granted' ? 'warn' : 'on';

  const menu: { to: string; label: string; icon: IconName; badge?: number }[] = [
    { to: '/tx/new', label: '쓰기', icon: 'pencil' },
    { to: '/history', label: '내역', icon: 'list' },
    { to: '/stats', label: '통계', icon: 'chart' },
    { to: '/inbox', label: '확인함', icon: 'inbox', badge: data.pending },
    { to: '/settings/budget', label: '예산', icon: 'wallet' },
    { to: '/settings', label: '설정', icon: 'gear' },
  ];

  return (
    <div className="page">
      <header className="page-header"><h1>가계부</h1></header>

      <section className="summary" aria-label="이번 달 요약">
        <ul className="summary-table">
          <li><span className="label">이번 달 순지출</span><strong className="neg">{formatWon(s.netSpend)}</strong></li>
          <li><span className="label">이번 달 수입</span><strong className="pos">{formatWon(s.income)}</strong></li>
          <li><span className="label">환불</span><strong className="refund">{formatWon(s.refund)}</strong></li>
          <li>
            <span className="label">{s.remaining !== undefined && s.remaining < 0 ? '예산 초과' : '남은 예산'}</span>
            <strong>{s.remaining === undefined ? '미설정' : formatWon(Math.abs(s.remaining))}</strong>
          </li>
        </ul>
        <div className="date-block" aria-label="오늘 날짜">
          <span className="month">{now.getFullYear()}년 {now.getMonth() + 1}월</span>
          <span className="day">{now.getDate()}</span>
          <span className={`weekday ${now.getDay() === 0 ? 'sun' : now.getDay() === 6 ? 'sat' : ''}`}>({WEEKDAYS[now.getDay()]})</span>
        </div>
      </section>

      <section className="card duo-wrap" aria-label="오늘">
        <div className="duo">
          <div><span className="label">오늘의 지출</span><strong className="neg">{formatWon(d.netSpend)}</strong></div>
          <div><span className="label">오늘의 수입</span><strong className="pos">{formatWon(d.income)}</strong></div>
        </div>
      </section>

      <section className="card">
        <BudgetBar summary={s} />
      </section>

      <nav className="menu-grid" aria-label="바로가기">
        {menu.map((m) => (
          <Link key={m.to} to={m.to} className="tile">
            <span className="tile-icon"><Icon name={m.icon} /></span>
            <span>{m.label}</span>
            {m.badge ? <span className="tile-badge" aria-label={`확인 필요 ${m.badge}건`}>{m.badge}</span> : null}
          </Link>
        ))}
      </nav>

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
          <p className="empty">아직 거래가 없어요. ‘쓰기’로 첫 거래를 기록해 보세요.</p>
        ) : (
          <ul className="tx-list">
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} refunded={refunded.get(t.id)} catName={lookups.catName} pmName={lookups.pmName} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
