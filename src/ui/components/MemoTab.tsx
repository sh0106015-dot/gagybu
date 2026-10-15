import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatWon } from '../../core/money';
import type { Note, Transaction } from '../../core/model';
import { NOTE_MAX, deleteNote, saveNote } from '../../core/notes';
import { periodKey, periodRange } from '../../core/period';
import { useServices } from '../AppContext';
import { useLive } from '../hooks';
import { dayLabel, today } from '../format';
import { EmptyArt } from '../art/Scenes';
import { useUndo } from './Undo';

type Item = { kind: 'note'; note: Note } | { kind: 'tx'; tx: Transaction };

/**
 * 메모 탭: 거래와 상관없는 메모를 쓰고 고치고 지운다. 거래에 붙은 메모도 함께 보여준다.
 * 새 메모는 아래 + 버튼(composeOpen), 고치기는 목록의 "수정"으로 작성 창을 연다.
 */
export function MemoTab({ month, startDay, txs, query, catName, composeOpen, onCloseCompose }: {
  month: string;
  startDay: number;
  txs: Transaction[];
  query: string;
  catName: (id: string) => string;
  composeOpen: boolean;
  onCloseCompose: () => void;
}) {
  const { deps } = useServices();
  const showUndo = useUndo();
  const notes = useLive((r) => r.listNotes());
  const [editing, setEditing] = useState<Note | null>(null);
  if (!notes) return <p className="loading">불러오는 중…</p>;

  const { from, to } = periodRange(month, startDay);
  const defaultDate = today() >= from && today() <= to ? today() : from;
  const q = query.replace(/\s+/g, '').toLowerCase();
  const match = (s?: string) => !q || (s ?? '').replace(/\s+/g, '').toLowerCase().includes(q);
  const items: Item[] = [
    ...notes.filter((n) => periodKey(n.date, startDay) === month && match(n.text)).map((note) => ({ kind: 'note' as const, note })),
    ...txs.filter((t) => t.memo).map((tx) => ({ kind: 'tx' as const, tx })),
  ].sort((a, b) => {
    const ad = a.kind === 'note' ? a.note.date : a.tx.date;
    const bd = b.kind === 'note' ? b.note.date : b.tx.date;
    const at = a.kind === 'note' ? a.note.updatedAt : a.tx.createdAt;
    const bt = b.kind === 'note' ? b.note.updatedAt : b.tx.createdAt;
    return bd.localeCompare(ad) || bt - at;
  });

  const close = () => {
    setEditing(null);
    onCloseCompose();
  };
  const remove = async (n: Note) => {
    await deleteNote(n.id, deps);
    showUndo('메모를 삭제했어요', async () => { await deps.repo.commit({ notes: [n] }); });
  };

  return (
    <>
      {items.length === 0 ? (
        <EmptyArt pose="write">이 달의 메모가 없어요. 아래 + 버튼으로 첫 메모를 남겨 보세요.</EmptyArt>
      ) : (
        <ul className="list" style={{ marginTop: 10 }}>
          {items.map((it) =>
            it.kind === 'note' ? (
              <li key={`n-${it.note.id}`}>
                <div className="memo-item">
                  <span>
                    <span className="small muted">{dayLabel(it.note.date)} · 메모</span>
                    <span className="memo-text">{it.note.text}</span>
                  </span>
                  <span className="memo-actions">
                    <button type="button" className="btn btn-sm" aria-haspopup="dialog" onClick={() => setEditing(it.note)}>수정</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(it.note)}>삭제</button>
                  </span>
                </div>
              </li>
            ) : (
              <li key={`t-${it.tx.id}`}>
                <Link to={`/tx/${it.tx.id}`} className="item memo-item">
                  <span>
                    <span className="small muted">{dayLabel(it.tx.date)} · {it.tx.merchant ?? catName(it.tx.categoryId)}</span>
                    <span className="memo-text">{it.tx.memo}</span>
                  </span>
                  <strong className={it.tx.type === 'income' ? 'pos' : it.tx.type === 'expense' ? 'neg' : 'refund'}>{formatWon(it.tx.amount)}</strong>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}

      {(composeOpen || editing) && (
        <MemoSheet key={editing?.id ?? 'new'} note={editing} defaultDate={defaultDate} onClose={close} />
      )}
    </>
  );
}

/** 아래에서 올라오는 메모 작성 창. 바깥을 누르거나 Esc로 닫는다. */
function MemoSheet({ note, defaultDate, onClose }: { note: Note | null; defaultDate: string; onClose: () => void }) {
  const { deps } = useServices();
  const [date, setDate] = useState(note?.date ?? defaultDate);
  const [text, setText] = useState(note?.text ?? '');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    try {
      await saveNote({ id: note?.id, date, text }, deps);
      onClose();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '저장하지 못했어요');
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memo-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <span className="sheet-grip" aria-hidden="true" />
        <div className="memo-compose-head">
          <h2 id="memo-sheet-title">{note ? '메모 고치기' : '새 메모'}</h2>
          <label className="memo-date">
            <span className="visually-hidden">날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="visually-hidden">메모 내용</span>
          <textarea
            rows={6}
            autoFocus
            maxLength={NOTE_MAX}
            value={text}
            placeholder="예: 관리비가 이번 달부터 올랐어요 / 다음 달 경조사비 20만 원 예정"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="small muted" style={{ margin: 0, textAlign: 'right' }}>{text.trim().length} / {NOTE_MAX}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={!text.trim()}>{note ? '수정 저장' : '메모 저장'}</button>
        </div>
      </form>
    </div>
  );
}
