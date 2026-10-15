import { useState } from 'react';
import { parseWon } from '../../core/money';
import { useServices } from '../AppContext';
import { currentMonth } from '../format';
import { enableAutoRecord } from '../sources';

export function Onboarding() {
  const { repo } = useServices();
  const [step, setStep] = useState<'intro' | 'auto' | 'budget'>('intro');
  const [budget, setBudget] = useState('');

  const finish = async (withBudget: boolean) => {
    const total = parseWon(budget);
    const app = await repo.getAppSettings();
    await repo.commit({
      appSettings: { ...app, onboarded: true },
      budgets: withBudget && total ? [{ month: currentMonth(), total }] : [],
    });
  };

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      {step === 'intro' && (
        <section className="form">
          <h1>결제 알림이 오면 가계부가 알아서 적어요</h1>
          <p>문자·카카오톡·간편결제 앱의 결제 알림을 읽어 자동으로 기록하고, 이번 달 남은 예산을 알려드려요.</p>
          <p className="small muted">가입 없이 이 기기에만 저장돼요. 자동 기록 없이 직접 입력만 해도 쓸 수 있어요.</p>
          <button type="button" className="btn btn-primary" onClick={() => setStep('auto')}>자동 기록 설정하기</button>
          <button type="button" className="btn" onClick={() => setStep('budget')}>건너뛰기</button>
        </section>
      )}
      {step === 'auto' && (
        <section className="form">
          <h1>자동 기록 설정</h1>
          <p>허용한 출처(문자·카카오톡·간편결제 앱)의 결제 알림만 분석하고, 나머지 알림은 즉시 버려요. 분석과 저장은 이 기기 안에서만 이뤄져요.</p>
          <p className="small muted">웹 버전에서는 권한이 모의로 허용되고, 실제 알림 대신 붙여넣기·시뮬레이터로 입력해요.</p>
          <button type="button" className="btn btn-primary" onClick={async () => { await enableAutoRecord(repo); setStep('budget'); }}>
            허용하고 계속
          </button>
          <button type="button" className="btn" onClick={() => setStep('budget')}>나중에 하기</button>
        </section>
      )}
      {step === 'budget' && (
        <section className="form">
          <h1>이번 달 예산</h1>
          <label className="field">
            <span>한 달 생활비 예산 (원)</span>
            <input
              inputMode="numeric"
              value={budget}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setBudget(d ? Number(d).toLocaleString('ko-KR') : ''); }}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={!parseWon(budget)} onClick={() => finish(true)}>시작하기</button>
          <button type="button" className="btn" onClick={() => finish(false)}>건너뛰기</button>
        </section>
      )}
    </div>
  );
}
