import { Link } from 'react-router-dom';
import { summarizeDay, summarizeMonth } from '../../core/budget';
import { shiftMonth } from '../../core/dates';
import { noSpendDays } from '../../core/insights';
import { formatWon } from '../../core/money';
import { daysIntoPeriod, periodLabel } from '../../core/period';
import { useLive, useLookups, useStartDay } from '../hooks';
import { currentPeriod, sortTxDesc, timeLabel, today } from '../format';
import { BudgetBar } from '../components/BudgetBar';
import { Icon, type IconName } from '../components/Icon';
import { TxRow } from '../components/TxRow';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const RECAP_DAYS = 7;

export function Home() {
  const startDay = useStartDay();
  const date = today();
  const month = startDay ? currentPeriod(startDay) : '';
  const prevMonth = month ? shiftMonth(month, -1) : '';
  const lookups = useLookups();
  const data = useLive(async (repo) => {
    if (!month) return undefined;
    const [txs, refunds, budget, prevBudget, candidates, auto] = await Promise.all([
      repo.listTransactions(), repo.listRefunds(), repo.getBudget(month), repo.getBudget(prevMonth),
      repo.listCandidates(), repo.getAutoSettings(),
    ]);
    return { txs, refunds, budget, prevBudget, pending: candidates.filter((c) => c.status === 'pending').length, auto };
  }, [month, prevMonth]);
  if (!data || !lookups || !startDay) return <p className="loading">불러오는 중…</p>;

  const s = summarizeMonth(month, data.txs, data.refunds, data.budget, startDay);
  const d = summarizeDay(date, data.txs, data.refunds);
  const ns = noSpendDays(month, data.txs, startDay, date);
  const showRecap = daysIntoPeriod(date, startDay) <= RECAP_DAYS;
  const prev = summarizeMonth(prevMonth, data.txs, data.refunds, data.prevBudget, startDay);
  const prevTop = prev.byCategory.find((c) => c.amount > 0);
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

      {showRecap && prev.expense + prev.income > 0 && (
        <section className="card recap" aria-label="지난달 결산">
          <p className="card-title">📋 지난달 결산 · {periodLabel(prevMonth, startDay)}</p>
          <div className="budget-row"><span>순지출</span><strong className="neg">{formatWon(prev.netSpend)}</strong></div>
          {prev.remaining !== undefined && (
            <div className="budget-row">
              <span>예산 대비</span>
              <strong className={prev.remaining < 0 ? 'neg' : 'refund'}>
                {prev.remaining < 0 ? `${formatWon(-prev.remaining)} 초과` : `${formatWon(prev.remaining)} 남김`}
              </strong>
            </div>
          )}
          {prevTop && (
            <div className="budget-row"><span>가장 많이 쓴 곳</span><strong>{lookups.catName(prevTop.categoryId)} {formatWon(prevTop.amount)}</strong></div>
          )}
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            <Link to="/settings/budget">이번 달 예산 정하기</Link> · <Link to="/stats">자세히 보기</Link>
          </p>
        </section>
      )}

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
      {startDay !== 1 && <p className="small muted" style={{ margin: '6px 4px 0' }}>이번 달 기간: {periodLabel(month, startDay)}</p>}

      <section className="card duo-wrap" aria-label="오늘">
        <div className="duo">
          <div><span className="label">오늘의 지출</span><strong className="neg">{formatWon(d.netSpend)}</strong></div>
          <div><span className="label">오늘의 수입</span><strong className="pos">{formatWon(d.income)}</strong></div>
        </div>
      </section>

      <Link to="/stats" className="card nospend">
        <span className="nospend-badge" aria-hidden="true">🌱</span>
        <span>
          <strong>무지출 {ns.count}일</strong>
          <span className="small muted"> / 지난 {ns.elapsed}일 중</span>
          <span className="small muted" style={{ display: 'block' }}>고정지출은 빼고 세요. 달력은 통계에서 볼 수 있어요.</span>
        </span>
      </Link>

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
