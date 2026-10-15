import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  candidateToInput, confirmCandidate, ignoreCandidate, linkCandidateRefund, mergeCandidate,
} from '../../core/actions';
import { txAt } from '../../core/dates';
import { formatWon, parseWon } from '../../core/money';
import type { Candidate, Refund, Transaction } from '../../core/model';
import { REASON_LABEL, REFUND_LOOKBACK_MS, SOURCE_APP_LABEL } from '../../core/model';
import { refundableAmount } from '../../core/refund';
import { useServices } from '../AppContext';
import { useLive, useLookups } from '../hooks';
import { dayLabel, sortTxDesc } from '../format';
import { PageHeader } from '../components/PageHeader';
import { TxForm } from '../components/TxForm';
import { TxRow } from '../components/TxRow';

export function CandidateDetail() {
  const { id = '' } = useParams();
  const services = useServices();
  const navigate = useNavigate();
  const lookups = useLookups();
  const [excerpt, setExcerpt] = useState<string | null>(null);
  const [mode, setMode] = useState<'choose' | 'form'>('choose');
  const data = useLive(async (repo) => ({
    c: await repo.getCandidate(id),
    txs: await repo.listTransactions(),
    refunds: await repo.listRefunds(),
  }), [id]);

  if (!data || !lookups) return <p className="loading">불러오는 중…</p>;
  const { c } = data;
  if (!c || c.status !== 'pending') {
    return (
      <div className="page">
        <PageHeader title="확인함" back />
        <p className="empty">이미 처리했거나 만료된 내역이에요.</p>
      </div>
    );
  }

  const done = () => navigate('/inbox', { replace: true });
  const showExcerpt = async () => {
    try {
      setExcerpt(c.encryptedExcerpt ? await services.decrypt(c.encryptedExcerpt) : '보관된 내용이 없어요.');
    } catch {
      setExcerpt('내용을 열 수 없어요.');
    }
  };
  const dup = c.duplicateOfTxId ? data.txs.find((t) => t.id === c.duplicateOfTxId) : undefined;

  return (
    <div className="page">
      <PageHeader title={c.fields.kind === 'cancel' ? '취소·환불 확인' : '결제 확인'} back />

      <section className="card small">
        <div className="chips">{c.reasons.map((r) => <span key={r} className="chip chip-warn">{REASON_LABEL[r]}</span>)}</div>
        <p>
          {SOURCE_APP_LABEL[c.sourceApp]} · {dayLabel(c.fields.date)} {c.fields.time ?? ''}
          {c.fields.dateFromReceipt ? ' (받은 시각 기준)' : ''}
        </p>
        <p>
          인식한 값: {c.fields.amount !== undefined ? formatWon(c.fields.amount) : '금액 없음'} · {c.fields.merchant ?? '가맹점 없음'} ·{' '}
          {c.fields.paymentMethodId ? lookups.pmName(c.fields.paymentMethodId) : `결제수단 미연결${c.fields.cardName ? ` (${c.fields.cardName}${c.fields.cardLast4 ? ` ${c.fields.cardLast4}` : ''})` : ''}`}
          {c.fields.installment ? ' · 할부' : ''}{c.fields.foreign ? ' · 외화' : ''}
        </p>
        {excerpt === null ? (
          <button type="button" className="btn" onClick={showExcerpt}>알림 내용 보기</button>
        ) : (
          <pre className="excerpt">{excerpt}</pre>
        )}
      </section>

      {c.fields.kind === 'approval' ? (
        <>
          {dup && mode === 'choose' && (
            <section className="card">
              <h2>이미 기록된 거래</h2>
              <ul className="tx-list" style={{ margin: '8px 0' }}>
                <TxRow tx={dup} catName={lookups.catName} pmName={lookups.pmName} />
              </ul>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={async () => { await mergeCandidate(c.id, services.deps); done(); }}>
                  같은 거래예요
                </button>
                <button type="button" className="btn" onClick={() => setMode('form')}>다른 거래로 저장</button>
              </div>
            </section>
          )}
          {(!dup || mode === 'form') && (
            <TxForm
              initial={candidateToInput(c)}
              submitLabel="확인하고 저장"
              onSubmit={async (i) => { await confirmCandidate(c.id, i, services.deps); done(); }}
            />
          )}
        </>
      ) : (
        <RefundLink c={c} txs={data.txs} refunds={data.refunds} onDone={done} />
      )}

      <button
        type="button"
        className="btn btn-danger"
        style={{ width: '100%', marginTop: 16 }}
        onClick={async () => { await ignoreCandidate(c.id, services.deps); done(); }}
      >
        무시하기
      </button>
    </div>
  );
}

function RefundLink({ c, txs, refunds, onDone }: {
  c: Candidate; txs: Transaction[]; refunds: Refund[]; onDone: () => void;
}) {
  const services = useServices();
  const lookups = useLookups();
  const at = txAt(c.fields.date, c.fields.time);
  const options = (c.refundCandidateTxIds?.length
    ? txs.filter((t) => c.refundCandidateTxIds!.includes(t.id))
    : txs.filter((t) => t.type === 'expense' && at - txAt(t.date, t.time) <= REFUND_LOOKBACK_MS && txAt(t.date, t.time) <= at + 120_000)
  ).sort(sortTxDesc).slice(0, 50);
  const [selected, setSelected] = useState(options.length === 1 ? options[0].id : '');
  const [amount, setAmount] = useState(c.fields.amount ? c.fields.amount.toLocaleString('ko-KR') : '');
  const [date, setDate] = useState(c.fields.date);
  const [error, setError] = useState<string | null>(null);
  if (!lookups) return null;

  const submit = async () => {
    const amt = parseWon(amount);
    if (!selected) return setError('원거래를 선택하세요');
    if (amt === null || amt < 1) return setError('환불 금액을 확인하세요');
    try {
      await linkCandidateRefund(c.id, selected, amt, date, services.deps);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결하지 못했어요');
    }
  };

  return (
    <section className="card form">
      <h2>원거래 선택</h2>
      {options.length === 0 ? (
        <p className="muted">최근 90일 안에 연결할 지출이 없어요. 무시하거나 거래를 먼저 기록해 주세요.</p>
      ) : (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visually-hidden">원거래</legend>
          {options.map((t) => (
            <label key={t.id} className="row" style={{ alignItems: 'center', padding: '6px 0' }}>
              <input type="radio" name="orig" style={{ flex: 'none' }} checked={selected === t.id} onChange={() => setSelected(t.id)} />
              <span>
                {dayLabel(t.date)} {t.time ?? ''} · {t.merchant ?? lookups.catName(t.categoryId)} · {lookups.pmName(t.paymentMethodId)}
                <br />
                <span className="small muted">결제 {formatWon(t.amount)} · 환불 가능 {formatWon(refundableAmount(t, refunds))}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="row">
        <label className="field"><span>환불 금액 (원)</span>
          <input inputMode="numeric" value={amount} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setAmount(d ? Number(d).toLocaleString('ko-KR') : ''); }} />
        </label>
        <label className="field"><span>환불 날짜</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={submit} disabled={options.length === 0}>환불 연결</button>
    </section>
  );
}
