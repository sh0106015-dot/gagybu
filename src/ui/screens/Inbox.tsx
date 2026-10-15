import { Link } from 'react-router-dom';
import { formatWon } from '../../core/money';
import { REASON_LABEL, SOURCE_APP_LABEL } from '../../core/model';
import { useLive } from '../hooks';
import { dayLabel } from '../format';
import { PageHeader } from '../components/PageHeader';
import { EmptyArt } from '../art/Scenes';

export function Inbox() {
  const list = useLive(async (repo) =>
    (await repo.listCandidates()).filter((c) => c.status === 'pending').sort((a, b) => b.createdAt - a.createdAt),
  );
  if (!list) return <p className="loading">불러오는 중…</p>;

  return (
    <div className="page">
      <PageHeader title="확인함" back />
      <p className="small muted">확인 전 내역은 예산과 통계에 포함되지 않아요. 30일이 지나면 자동으로 지워져요.</p>
      {list.length === 0 ? (
        <EmptyArt pose="party">확인할 내역이 없어요. 모두 정리했어요!</EmptyArt>
      ) : (
        <ul className="list">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/inbox/${c.id}`} className="item">
                <div>
                  <div>
                    {c.fields.kind === 'cancel' ? '취소·환불' : '결제'} · {c.fields.merchant ?? '가맹점 미확인'}
                  </div>
                  <div className="small muted">
                    {dayLabel(c.fields.date)} · {SOURCE_APP_LABEL[c.sourceApp]}
                  </div>
                  <div className="chips" style={{ marginTop: 4 }}>
                    {c.reasons.map((r) => <span key={r} className="chip chip-warn">{REASON_LABEL[r]}</span>)}
                  </div>
                </div>
                <strong>{c.fields.amount !== undefined ? formatWon(c.fields.amount) : '금액 미확인'}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
