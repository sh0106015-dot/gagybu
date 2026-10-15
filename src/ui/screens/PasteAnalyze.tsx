import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ingestSafely } from '../../core/pipeline/ingest';
import { useServices } from '../AppContext';
import { PageHeader } from '../components/PageHeader';

export function PasteAnalyze() {
  const { deps } = useServices();
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await ingestSafely(
        { sourceApp: 'paste', text, receivedAt: deps.now(), notificationKey: `paste-${deps.newId()}` },
        deps,
        { paste: true },
      );
      setText('');
      // 붙여넣기는 확인함·무시·대기 보관 중 하나로만 끝난다.
      setResult(r.outcome === 'queued' ? 'queued' : r.outcome === 'ignored_non_tx' ? 'non_tx' : 'candidate');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="붙여넣기 분석" back />
      <p className="small muted">결제 문자나 카톡 알림 내용을 붙여넣으면 거래 후보를 만들어 확인함에 넣어요. 붙여넣은 내용만 분석하고 클립보드를 따로 읽지 않아요.</p>
      <div className="form">
        <label className="field">
          <span>알림 내용</span>
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스" />
        </label>
        <button type="button" className="btn btn-primary" disabled={!text.trim() || busy} onClick={analyze}>분석하기</button>
      </div>
      {result === 'candidate' && <p role="status">확인함에 추가했어요. <Link to="/inbox">확인함으로 가기</Link></p>}
      {result === 'non_tx' && <p role="status">결제·취소 알림이 아니라서 기록하지 않았어요.</p>}
      {result === 'queued' && <p role="status">지금은 저장하지 못해 보관해 두었어요. 앱을 다시 열면 처리돼요.</p>}
    </div>
  );
}
