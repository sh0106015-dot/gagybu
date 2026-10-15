import { useMemo, useState } from 'react';
import type { SourceApp } from '../../core/model';
import { SOURCE_APP_LABEL } from '../../core/model';
import { ingestSafely } from '../../core/pipeline/ingest';
import { sampleCardMethods } from '../../data/seed';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { buildPresets, OUTCOME_LABEL } from '../presets';
import { AUTO_APPS } from '../sources';
import { PageHeader } from '../components/PageHeader';

export function Simulator() {
  const { deps, repo } = useServices();
  const auto = useLive((r) => r.getAutoSettings());
  const presets = useMemo(() => buildPresets(new Date()), []);
  const [sourceApp, setSourceApp] = useState<SourceApp>('sms');
  const [sender, setSender] = useState('');
  const [key, setKey] = useState(() => deps.newId());
  const [text, setText] = useState(presets[0].text);
  const [log, setLog] = useState<{ at: string; line: string }[]>([]);

  const [sending, setSending] = useState(false);

  const send = async (reuseKey: boolean) => {
    const notificationKey = reuseKey ? key : deps.newId();
    setKey(notificationKey);
    setSending(true);
    try {
      const r = await ingestSafely({ sourceApp, sender: sender.trim() || undefined, text, receivedAt: Date.now(), notificationKey }, deps);
      const line = `${SOURCE_APP_LABEL[sourceApp]} · ${OUTCOME_LABEL[r.outcome] ?? r.outcome}`;
      setLog((l) => [{ at: new Date().toLocaleTimeString('ko-KR'), line }, ...l].slice(0, 20));
    } finally {
      setSending(false);
    }
  };

  const addSamples = async () => {
    const added = sampleCardMethods(await repo.listPaymentMethods());
    await repo.commit({ paymentMethods: added });
    setLog((l) => [{ at: new Date().toLocaleTimeString('ko-KR'), line: added.length ? `샘플 결제수단 ${added.length}개 추가` : '샘플 결제수단이 이미 있어요' }, ...l]);
  };

  const off = auto && (!auto.enabled || auto.permission !== 'granted');

  return (
    <div className="page">
      <PageHeader title="알림 시뮬레이터" back />
      <p className="small muted">
        안드로이드에서 알림을 받는 상황을 흉내 내 전체 처리 과정(수집 대상 확인 → 분석 → 중복 검사 → 자동 저장/확인함)을 시험해요. 실제 거래로 저장되니 시험 후 내역에서 지우세요.
      </p>
      {off && <p className="error">자동 기록이 꺼져 있거나 권한이 없어 보낸 알림이 폐기돼요. 설정 → 자동 기록에서 켜세요.</p>}
      <button type="button" className="btn" onClick={addSamples}>샘플 결제수단(가나카드·다라카드·마바페이) 추가</button>

      <h2 style={{ margin: '16px 0 8px' }}>프리셋</h2>
      <div className="chips">
        {presets.map((p) => (
          <button key={p.id} type="button" className="btn" onClick={() => { setSourceApp(p.sourceApp); setText(p.text); }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="form" style={{ marginTop: 16 }}>
        <div className="row">
          <label className="field"><span>출처 앱</span>
            <select value={sourceApp} onChange={(e) => setSourceApp(e.target.value as SourceApp)}>
              {AUTO_APPS.map((a) => <option key={a} value={a}>{SOURCE_APP_LABEL[a]}</option>)}
            </select>
          </label>
          <label className="field"><span>발신자 (선택)</span><input value={sender} onChange={(e) => setSender(e.target.value)} /></label>
        </div>
        <label className="field"><span>알림 내용</span><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={sending} onClick={() => send(false)}>새 알림으로 보내기</button>
          <button type="button" className="btn" disabled={sending} onClick={() => send(true)}>같은 알림 다시 보내기</button>
        </div>
        <p className="small muted">"같은 알림 다시 보내기"는 직전 알림 키를 재사용해 재전달·내용 갱신 상황을 흉내 내요.</p>
      </div>

      <h2 style={{ margin: '16px 0 8px' }}>결과</h2>
      {log.length === 0 ? <p className="muted">아직 보낸 알림이 없어요.</p> : (
        <ul className="list small" aria-live="polite">
          {log.map((l, i) => <li key={i}>{l.at} · {l.line}</li>)}
        </ul>
      )}
    </div>
  );
}
