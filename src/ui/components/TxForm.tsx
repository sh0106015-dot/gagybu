import { useRef, useState, type FormEvent } from 'react';
import { validateTxInput, type TxInput } from '../../core/actions';
import { parseWon } from '../../core/money';
import type { TxType } from '../../core/model';
import { TX_TYPE_LABEL } from '../../core/model';
import { useLookups } from '../hooks';
import { today } from '../format';

export function TxForm({ initial, submitLabel, onSubmit }: {
  initial: Partial<TxInput>;
  submitLabel: string;
  onSubmit: (i: TxInput) => Promise<void>;
}) {
  const lookups = useLookups();
  const [type, setType] = useState<TxType>(initial.type ?? 'expense');
  const [amount, setAmount] = useState(initial.amount ? initial.amount.toLocaleString('ko-KR') : '');
  const [date, setDate] = useState(initial.date ?? today());
  const [time, setTime] = useState(initial.time ?? '');
  const [merchant, setMerchant] = useState(initial.merchant ?? '');
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '');
  const [paymentMethodId, setPaymentMethodId] = useState(initial.paymentMethodId ?? '');
  const [toPaymentMethodId, setToPaymentMethodId] = useState(initial.toPaymentMethodId ?? '');
  const [memo, setMemo] = useState(initial.memo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  if (!lookups) return <p className="loading">불러오는 중…</p>;
  const catKind = type === 'income' ? 'income' : 'expense';
  const cats = lookups.categories.filter((c) => c.kind === catKind && (!c.archived || c.id === categoryId));
  const methods = lookups.methods.filter((m) => !m.archived || m.id === paymentMethodId || m.id === toPaymentMethodId);

  const changeType = (t: TxType) => {
    setType(t);
    const current = lookups.categories.find((c) => c.id === categoryId);
    if (current && current.kind !== (t === 'income' ? 'income' : 'expense')) setCategoryId('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const input: TxInput = {
      type, amount: parseWon(amount) ?? 0, date, time: time || undefined, merchant,
      categoryId: type === 'transfer' ? '' : categoryId, paymentMethodId,
      toPaymentMethodId: type === 'transfer' ? toPaymentMethodId : undefined, memo,
    };
    const err = validateTxInput(input);
    if (err) {
      setError(err);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '저장하지 못했어요');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="segmented" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="visually-hidden">유형</legend>
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <label key={t}>
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => changeType(t)} />
            {TX_TYPE_LABEL[t]}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>금액 (원)</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
          }}
          placeholder="0"
          required
        />
      </label>

      <div className="row">
        <label className="field"><span>날짜</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="field"><span>시각 (선택)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>

      {type !== 'transfer' && (
        <label className="field"><span>가맹점·내용 (선택)</span><input value={merchant} onChange={(e) => setMerchant(e.target.value)} /></label>
      )}

      {type !== 'transfer' && (
        <label className="field">
          <span>카테고리</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">선택하세요</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (보관됨)' : ''}</option>)}
          </select>
        </label>
      )}

      <label className="field">
        <span>{type === 'transfer' ? '출발 수단' : '결제수단'}</span>
        <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} required>
          <option value="">선택하세요</option>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name}{m.archived ? ' (보관됨)' : ''}</option>)}
        </select>
      </label>

      {type === 'transfer' && (
        <label className="field">
          <span>도착 수단</span>
          <select value={toPaymentMethodId} onChange={(e) => setToPaymentMethodId(e.target.value)} required>
            <option value="">선택하세요</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      )}

      <label className="field"><span>메모 (선택)</span><textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></label>

      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '저장 중…' : submitLabel}</button>
    </form>
  );
}
