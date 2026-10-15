import { useEffect, useState } from 'react';
import type { AutoRecordSettings as Settings, PermissionState, SaveMode } from '../../core/model';
import { SOURCE_APP_LABEL } from '../../core/model';
import { FORMAT_RULES } from '../../core/parser';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { timeLabel } from '../format';
import { AUTO_APPS, formToSources, sourcesToForm, type SourcesForm } from '../sources';
import { PageHeader } from '../components/PageHeader';

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: '허용됨',
  denied: '거절됨 — 휴대폰 설정에서 허용해야 해요',
  revoked: '해제됨 — 휴대폰 설정에서 다시 허용해야 해요',
  unknown: '아직 요청하지 않았어요',
};

export function AutoRecordSettings() {
  const { repo } = useServices();
  const s = useLive((r) => r.getAutoSettings());
  const [form, setForm] = useState<SourcesForm | null>(null);
  useEffect(() => {
    if (s && !form) setForm(sourcesToForm(s.allowedSources));
  }, [s, form]);
  if (!s || !form) return <p className="loading">불러오는 중…</p>;

  const save = (patch: Partial<Settings>) => repo.commit({ autoSettings: { ...s, ...patch } });
  const setPermission = (permission: PermissionState) => save({ permission });
  const updateForm = (next: SourcesForm) => {
    setForm(next);
    void save({ allowedSources: formToSources(next) });
  };
  const status = !s.enabled ? '꺼짐' : s.permission !== 'granted' ? '권한 문제로 멈춤' : '켜짐';

  return (
    <div className="page">
      <PageHeader title="자동 기록" back />

      <section className="card small">
        <p><strong>무엇을 하나요?</strong> 문자·카카오톡·간편결제 앱의 결제 알림에서 금액·가맹점·결제수단·시각을 읽어 가계부에 기록해요.</p>
        <p>알림 접근을 허용하면 다른 알림도 앱에 전달될 수 있어요. 허용한 출처의 결제 알림만 분석하고 나머지는 즉시 버려요. 분석과 저장은 모두 이 기기 안에서만 이뤄져요.</p>
        <p className="muted">웹 버전은 다른 앱의 알림을 받을 수 없어요. 아래 권한은 안드로이드 동작을 흉내 내는 테스트용이고, 실제 입력은 붙여넣기·시뮬레이터로 해요.</p>
      </section>

      <section className="card form">
        <p>상태: <strong>{status}</strong></p>
        <p>알림 접근 권한(모의): <strong>{PERMISSION_LABEL[s.permission]}</strong></p>
        <div className="row">
          <button type="button" className="btn" onClick={() => setPermission('granted')}>권한 허용</button>
          <button type="button" className="btn" onClick={() => setPermission('revoked')}>권한 해제</button>
        </div>
        <label className="row" style={{ alignItems: 'center' }}>
          <input
            type="checkbox"
            style={{ flex: 'none', width: 22, height: 22 }}
            checked={s.enabled}
            disabled={s.permission !== 'granted'}
            onChange={(e) => save({ enabled: e.target.checked })}
          />
          <span>자동 기록 사용{s.permission !== 'granted' ? ' (먼저 권한을 허용하세요)' : ''}</span>
        </label>
        <p className="small muted">
          마지막 처리: {s.lastProcessedAt ? timeLabel(s.lastProcessedAt) : '없음'}. 결제가 없으면 알림도 오지 않으므로, 처리 기록이 없다고 해서 오류는 아니에요.
        </p>
      </section>

      <section className="card form">
        <h2>기록할 출처</h2>
        {AUTO_APPS.map((app) => (
          <div key={app} className="form" style={{ gap: 6 }}>
            <label className="row" style={{ alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ flex: 'none', width: 22, height: 22 }}
                checked={form[app].on}
                onChange={(e) => updateForm({ ...form, [app]: { ...form[app], on: e.target.checked } })}
              />
              <span>{SOURCE_APP_LABEL[app]}</span>
            </label>
            {form[app].on && (
              <label className="field">
                <span>발신자 제한 (선택, 쉼표로 구분 · 비우면 전체)</span>
                <input
                  value={form[app].senders}
                  onChange={(e) => setForm({ ...form, [app]: { ...form[app], senders: e.target.value } })}
                  onBlur={() => updateForm(form)}
                />
              </label>
            )}
          </div>
        ))}
        <p className="small muted">출처를 꺼도 이미 기록된 거래는 그대로 남아요.</p>
      </section>

      <section className="card form">
        <h2>저장 방식</h2>
        {(['auto', 'review_all'] as SaveMode[]).map((m) => (
          <label key={m} className="row" style={{ alignItems: 'center' }}>
            <input type="radio" name="saveMode" style={{ flex: 'none' }} checked={s.saveMode === m} onChange={() => save({ saveMode: m })} />
            <span>{m === 'auto' ? '확실한 내역은 자동 저장 (불확실하면 확인함)' : '모든 내역 확인 후 저장'}</span>
          </label>
        ))}
        <p className="small muted">변경 내용은 이후에 받는 알림부터 적용돼요.</p>
      </section>

      <section className="card">
        <h2>지원하는 알림 형식</h2>
        <p className="small muted">개발용 가상 형식이에요. 실제 카드사 형식은 안드로이드 버전에서 검증 후 추가돼요. 할부·외화·형식 밖 알림은 항상 확인함으로 가요.</p>
        <ul className="list small">
          {FORMAT_RULES.map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong> · {r.apps.map((a) => SOURCE_APP_LABEL[a]).join(', ')}
              <pre className="excerpt">{r.example}</pre>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
