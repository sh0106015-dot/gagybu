import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MAX_PASTE_MESSAGES, splitMessages } from '../../core/parser/split';
import { ingestSafely } from '../../core/pipeline/ingest';
import { useServices } from '../AppContext';
import { PageHeader } from '../components/PageHeader';

interface Summary {
  candidate: number;
  nonTx: number;
  queued: number;
}

export function PasteAnalyze() {
  const { deps } = useServices();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const messages = splitMessages(text);

  const analyze = async () => {
    if (messages.length === 0 || busy) return;
    setBusy(true);
    const sum: Summary = { candidate: 0, nonTx: 0, queued: 0 };
    try {
      for (const message of messages) {
        const r = await ingestSafely(
          { sourceApp: 'paste', text: message, receivedAt: deps.now(), notificationKey: `paste-${deps.newId()}` },
          deps,
          { paste: true },
        );
        // 붙여넣기는 확인함·무시·대기 보관 중 하나로만 끝난다.
        if (r.outcome === 'queued') sum.queued++;
        else if (r.outcome === 'ignored_non_tx') sum.nonTx++;
        else sum.candidate++;
      }
      setText('');
      setResult(sum);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="붙여넣기 분석" back />
      <p className="small muted">
        결제 문자나 카톡 알림을 붙여넣으면 거래 후보를 만들어 확인함에 넣어요. 여러 문자를 한꺼번에 붙여넣어도 돼요
        (빈 줄이나 [Web발신]으로 나눠요, 최대 {MAX_PASTE_MESSAGES}건). 붙여넣은 내용만 분석하고 클립보드를 따로 읽지 않아요.
      </p>
      <div className="form">
        <label className="field">
          <span>알림 내용</span>
          <textarea
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'예:\n가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스\n\n다라카드 승인 5678 8,500원 10/15 08:12 GS25역삼점'}
          />
        </label>
        <p className="small muted" style={{ margin: 0 }} aria-live="polite">
          {messages.length > 0 ? `${messages.length}건으로 나눠 분석해요.` : '붙여넣은 내용이 없어요.'}
        </p>
        <button type="button" className="btn btn-primary btn-big" disabled={messages.length === 0 || busy} onClick={analyze}>
          {busy ? '분석 중…' : `분석하기${messages.length > 1 ? ` (${messages.length}건)` : ''}`}
        </button>
      </div>
      {result && (
        <section className="card" role="status">
          {result.candidate > 0 && <p>확인함에 {result.candidate}건 추가했어요. <Link to="/inbox">확인함으로 가기</Link></p>}
          {result.nonTx > 0 && <p className="muted">결제·취소 알림이 아닌 {result.nonTx}건은 기록하지 않았어요.</p>}
          {result.queued > 0 && <p className="error">{result.queued}건은 지금 저장하지 못해 보관해 두었어요. 앱을 다시 열면 처리돼요.</p>}
        </section>
      )}
    </div>
  );
}
