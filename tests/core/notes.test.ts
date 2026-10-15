import { describe, it, expect } from 'vitest';
import { saveNote, deleteNote, NOTE_MAX } from '../../src/core/notes';
import { setup } from './fixtures';

describe('notes (메모)', () => {
  it('saves a trimmed note and updates it in place', async () => {
    const { repo, deps } = await setup();
    const n = await saveNote({ date: '2026-10-16', text: '  관리비 이번 달부터 인상  ' }, deps);
    expect(n).toMatchObject({ date: '2026-10-16', text: '관리비 이번 달부터 인상' });
    const u = await saveNote({ id: n.id, date: '2026-10-17', text: '관리비 인상 확인' }, deps);
    expect(u).toMatchObject({ id: n.id, date: '2026-10-17', text: '관리비 인상 확인', createdAt: n.createdAt });
    expect(await repo.listNotes()).toHaveLength(1);
  });
  it('rejects empty, too long, or invalid date', async () => {
    const { deps } = await setup();
    await expect(saveNote({ date: '2026-10-16', text: '   ' }, deps)).rejects.toThrow('메모 내용을 입력하세요');
    await expect(saveNote({ date: '2026-10-16', text: 'a'.repeat(NOTE_MAX + 1) }, deps)).rejects.toThrow(`${NOTE_MAX}자`);
    await expect(saveNote({ date: '', text: '메모' }, deps)).rejects.toThrow('날짜');
  });
  it('deletes a note', async () => {
    const { repo, deps } = await setup();
    const n = await saveNote({ date: '2026-10-16', text: '지울 메모' }, deps);
    await deleteNote(n.id, deps);
    expect(await repo.listNotes()).toEqual([]);
  });
});
