import { useRef, useState, type FormEvent } from 'react';
import { validateTxInput, type TxInput } from '../../core/actions';
import { parseWon } from '../../core/money';
import type { PaymentKind, PaymentMethod, TxType } from '../../core/model';
import { PAYMENT_KIND_LABEL, TX_TYPE_LABEL } from '../../core/model';
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
  const [fixed, setFixed] = useState(initial.fixed ?? false);
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
      fixed: type === 'expense' && fixed,
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
      <fieldset className="tabs-big">
        <legend className="visually-hidden">유형</legend>
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <label key={t}>
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => changeType(t)} />
            {TX_TYPE_LABEL[t]}
          </label>
        ))}
      </fieldset>

      <ul className="form-list">
        <li>
          <label className="form-row">
            <span>금액 (원)</span>
            <input
              className="amount-input"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
                setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
              }}
              placeholder="0"
              required
            />
          </label>
        </li>
        <li><label className="form-row"><span>날짜</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label></li>
        <li><label className="form-row"><span>시각 (선택)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label></li>
        {type !== 'transfer' && (
          <li><label className="form-row"><span>가맹점·내용</span><input value={merchant} placeholder="선택" onChange={(e) => setMerchant(e.target.value)} /></label></li>
        )}
        {type !== 'transfer' && (
          <li>
            <label className="form-row">
              <span>카테고리</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">선택하세요 ›</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (보관됨)' : ''}</option>)}
              </select>
            </label>
          </li>
        )}
        <li>
          <label className="form-row">
            <span>{type === 'transfer' ? '출발 수단' : '결제수단'}</span>
            <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} required>
              <option value="">선택하세요 ›</option>
              <MethodOptions methods={methods} />
            </select>
          </label>
        </li>
        {type === 'transfer' && (
          <li>
            <label className="form-row">
              <span>도착 수단</span>
              <select value={toPaymentMethodId} onChange={(e) => setToPaymentMethodId(e.target.value)} required>
                <option value="">선택하세요 ›</option>
                <MethodOptions methods={methods} />
              </select>
            </label>
          </li>
        )}
        {type === 'expense' && (
          <li>
            <label className="check-row">
              <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
              <span>고정지출 <span className="small muted">(월세·통신비·보험·구독처럼 매달 나가는 돈)</span></span>
            </label>
          </li>
        )}
        <li><label className="form-row"><span>메모</span><textarea rows={2} value={memo} placeholder="선택" onChange={(e) => setMemo(e.target.value)} /></label></li>
      </ul>

      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-big" disabled={saving}>{saving ? '저장 중…' : submitLabel}</button>
    </form>
  );
}

/** 결제수단을 신용카드·체크카드·간편결제·현금·계좌 순으로 묶어 보여준다. */
function MethodOptions({ methods }: { methods: PaymentMethod[] }) {
  return (
    <>
      {(Object.keys(PAYMENT_KIND_LABEL) as PaymentKind[]).map((kind) => {
        const items = methods.filter((m) => m.kind === kind);
        if (items.length === 0) return null;
        return (
          <optgroup key={kind} label={PAYMENT_KIND_LABEL[kind]}>
            {items.map((m) => <option key={m.id} value={m.id}>{m.name}{m.archived ? ' (보관됨)' : ''}</option>)}
          </optgroup>
        );
      })}
    </>
  );
}
