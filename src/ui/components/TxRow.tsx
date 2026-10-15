import { Link } from 'react-router-dom';
import type { Transaction } from '../../core/model';
import { formatWon } from '../../core/money';
import { signedAmount } from '../format';

export function TxRow({ tx, refunded, catName, pmName }: {
  tx: Transaction; refunded?: number; catName: (id: string) => string; pmName: (id?: string) => string;
}) {
  const title = tx.merchant ?? tx.memo ?? catName(tx.categoryId);
  const sub = tx.type === 'transfer'
    ? `${pmName(tx.paymentMethodId)} → ${pmName(tx.toPaymentMethodId)}`
    : `${catName(tx.categoryId)} · ${pmName(tx.paymentMethodId)}`;
  return (
    <li>
      <Link to={`/tx/${tx.id}`} className="tx-row">
        <div className="tx-main">
          <span className="tx-title">{title}</span>
          <span className="tx-sub">
            {tx.time ? `${tx.time} · ` : ''}{sub}
            {tx.recordMethod !== 'manual' && <span className="badge">자동</span>}
          </span>
        </div>
        <div className="tx-amount">
          <span className={tx.type === 'income' ? 'pos' : tx.type === 'expense' ? 'neg' : undefined}>{signedAmount(tx)}</span>
          {refunded ? <span className="small refund">환불 {formatWon(refunded)}</span> : null}
        </div>
      </Link>
    </li>
  );
}
