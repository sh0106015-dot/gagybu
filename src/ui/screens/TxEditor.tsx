import { useNavigate, useParams } from 'react-router-dom';
import { deleteTransaction, restoreTransaction, saveManualTransaction, updateTransaction } from '../../core/actions';
import { formatWon } from '../../core/money';
import { RECORD_METHOD_LABEL, SOURCE_APP_LABEL } from '../../core/model';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { dayLabel, timeLabel } from '../format';
import { PageHeader } from '../components/PageHeader';
import { TxForm } from '../components/TxForm';
import { useUndo } from '../components/Undo';

export function TxEditor() {
  const { id } = useParams();
  const { deps } = useServices();
  const navigate = useNavigate();
  const showUndo = useUndo();
  const data = useLive(async (repo) => {
    if (!id) return { tx: undefined, sources: [], refunds: [] };
    const [tx, records, refunds] = await Promise.all([repo.getTransaction(id), repo.listRecords(), repo.listRefunds()]);
    return {
      tx,
      sources: records.filter((r) => r.linkedTxId === id),
      refunds: refunds.filter((r) => r.originalTxId === id),
    };
  }, [id]);

  if (!id) {
    return (
      <div className="page">
        <PageHeader title="거래 추가" back />
        <TxForm initial={{}} submitLabel="저장" onSubmit={async (i) => { await saveManualTransaction(i, deps); navigate(-1); }} />
      </div>
    );
  }
  if (!data) return <p className="loading">불러오는 중…</p>;
  const { tx, sources, refunds } = data;
  if (!tx) {
    return (
      <div className="page">
        <PageHeader title="거래" back />
        <p className="empty">삭제되었거나 없는 거래예요.</p>
      </div>
    );
  }

  const onDelete = async () => {
    const snap = await deleteTransaction(tx.id, deps);
    navigate(-1);
    showUndo('거래를 삭제했어요', () => restoreTransaction(snap, deps));
  };
  const refundTotal = refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page">
      <PageHeader title="거래 상세" back right={<button type="button" className="btn btn-danger" onClick={onDelete}>삭제</button>} />

      <section className="card small">
        <p>기록 방식: <strong>{RECORD_METHOD_LABEL[tx.recordMethod]}</strong>{tx.userEdited ? ' · 직접 수정함' : ''}</p>
        {tx.dateFromReceipt && <p className="muted">알림에 거래 시각이 없어 받은 시각으로 기록했어요.</p>}
        {sources.length > 0 && (
          <p>출처: {sources.map((s) => `${SOURCE_APP_LABEL[s.sourceApp]} (${timeLabel(s.receivedAt)})`).join(', ')}</p>
        )}
        {refunds.length > 0 && (
          <>
            <p>환불 합계 <strong className="pos">{formatWon(refundTotal)}</strong> · 순지출 {formatWon(tx.amount - refundTotal)}</p>
            <ul>
              {refunds.map((r) => <li key={r.id}>{dayLabel(r.date)} {formatWon(r.amount)}</li>)}
            </ul>
          </>
        )}
      </section>

      <TxForm
        key={tx.updatedAt}
        initial={tx}
        submitLabel="수정 저장"
        onSubmit={async (i) => { await updateTransaction(tx.id, i, deps); navigate(-1); }}
      />
    </div>
  );
}
