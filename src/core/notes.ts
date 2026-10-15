import type { Deps } from './deps';
import type { Note } from './model';

export const NOTE_MAX = 2000;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 메모를 새로 쓰거나(id 없음) 고친다. 내용은 앞뒤 공백을 지우고 저장한다. */
export async function saveNote(i: { id?: string; date: string; text: string }, deps: Deps): Promise<Note> {
  const text = i.text.trim();
  if (!text) throw new Error('메모 내용을 입력하세요');
  if (text.length > NOTE_MAX) throw new Error(`메모는 ${NOTE_MAX}자까지 쓸 수 있어요`);
  if (!DATE_RE.test(i.date)) throw new Error('날짜를 확인하세요');
  const now = deps.now();
  const prev = i.id ? (await deps.repo.listNotes()).find((n) => n.id === i.id) : undefined;
  const note: Note = { id: prev?.id ?? deps.newId(), date: i.date, text, createdAt: prev?.createdAt ?? now, updatedAt: now };
  await deps.repo.commit({ notes: [note] });
  return note;
}

export async function deleteNote(id: string, deps: Deps): Promise<void> {
  await deps.repo.commit({ deleteNoteIds: [id] });
}
