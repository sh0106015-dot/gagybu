import { useState } from 'react';
import { wipeAllData } from '../../data/app';
import { useServices } from '../AppContext';
import { PageHeader } from '../components/PageHeader';

export function Wipe() {
  const services = useServices();
  const [confirm, setConfirm] = useState('');
  return (
    <div className="page">
      <PageHeader title="전체 데이터 삭제" back />
      <div className="form">
        <p>거래·영수증 사진·메모·예산·카테고리·결제수단·확인함 후보·알림 처리 기록·설정·잠금 PIN을 모두 지우고 처음 상태로 돌아가요. 되돌릴 수 없어요.</p>
        <label className="field"><span>계속하려면 "삭제"를 입력하세요</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button type="button" className="btn btn-danger" disabled={confirm.trim() !== '삭제'} onClick={() => wipeAllData(services)}>
          모두 삭제
        </button>
      </div>
    </div>
  );
}
