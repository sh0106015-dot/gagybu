import { useState } from 'react';
import { toCsv } from '../../core/csv';
import { useServices } from '../AppContext';
import { currentMonth, today } from '../format';
import { PageHeader } from '../components/PageHeader';

export function ExportCsv() {
  const { repo } = useServices();
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(today());
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    if (from > to) return setMsg('시작일이 종료일보다 늦어요');
    const [txs, refunds, cats, methods] = await Promise.all([
      repo.listTransactions(), repo.listRefunds(), repo.listCategories(), repo.listPaymentMethods(),
    ]);
    const inRange = txs.filter((t) => t.date >= from && t.date <= to);
    const blob = new Blob([toCsv(inRange, refunds, cats, methods)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `가계부_${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`${inRange.length}건을 내보냈어요.`);
  };

  return (
    <div className="page">
      <PageHeader title="CSV 내보내기" back />
      <div className="form">
        <div className="row">
          <label className="field"><span>시작일</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>종료일</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={run}>내보내기</button>
        {msg && <p role="status">{msg}</p>}
        <p className="small muted">파일에는 금액·가맹점·메모가 들어 있어요. 공유할 때 주의하세요.</p>
      </div>
    </div>
  );
}
