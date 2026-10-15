import { useState } from 'react';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';

const MAX_SIDE = 1280;
const QUALITY = 0.7;
const MAX_PHOTOS = 5;

/** 사진을 긴 변 1280px JPEG로 줄여 저장 공간을 아낀다. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}

export function ReceiptPhotos({ txId }: { txId: string }) {
  const { repo, deps } = useServices();
  const photos = useLive((r) => r.listPhotos(txId), [txId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (!photos) return null;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const picked = [...files].slice(0, room);
      const added = [];
      for (const f of picked) added.push({ id: deps.newId(), txId, dataUrl: await shrink(f), createdAt: deps.now() });
      await repo.commit({ photos: added });
      if (files.length > room) setError(`사진은 거래당 ${MAX_PHOTOS}장까지 붙일 수 있어요.`);
    } catch {
      setError('사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>영수증 사진</h2>
      {photos.length === 0 && <p className="small muted" style={{ margin: '4px 0 8px' }}>사진은 이 기기에만 저장돼요.</p>}
      <div className="photos">
        {photos.map((p, i) => (
          <div key={p.id} className="photo">
            <button type="button" className="photo-open" onClick={() => setOpen(p.dataUrl)} aria-label={`사진 ${i + 1} 크게 보기`}>
              <img src={p.dataUrl} alt={`영수증 사진 ${i + 1}`} />
            </button>
            <button type="button" className="photo-del" aria-label={`사진 ${i + 1} 삭제`} onClick={() => repo.commit({ deletePhotoIds: [p.id] })}>×</button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className={`photo-add${busy ? ' is-busy' : ''}`}>
            <input type="file" accept="image/*" capture="environment" multiple disabled={busy} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
            <span aria-hidden="true">＋</span>
            <span className="small">{busy ? '저장 중…' : '사진 추가'}</span>
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {open && (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="영수증 사진" onClick={() => setOpen(null)}>
          <img src={open} alt="영수증 사진 크게 보기" />
          <button type="button" className="btn" onClick={() => setOpen(null)}>닫기</button>
        </div>
      )}
    </section>
  );
}
