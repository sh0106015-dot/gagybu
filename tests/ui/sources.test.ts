import { describe, it, expect } from 'vitest';
import { sourcesToForm, formToSources, enableAutoRecord } from '../../src/ui/sources';
import { createMemoryRepo } from '../../src/data/memoryRepo';

describe('allowed sources form', () => {
  it('round-trips app toggles and sender lists', () => {
    const form = sourcesToForm([{ app: 'sms', sender: '1588' }, { app: 'sms', sender: '1599' }, { app: 'kakaotalk' }]);
    expect(form).toEqual({
      sms: { on: true, senders: '1588, 1599' },
      kakaotalk: { on: true, senders: '' },
      payapp: { on: false, senders: '' },
    });
    expect(formToSources(form)).toEqual([{ app: 'sms', sender: '1588' }, { app: 'sms', sender: '1599' }, { app: 'kakaotalk' }]);
  });
  it('enableAutoRecord grants mock permission with default sources', async () => {
    const repo = createMemoryRepo();
    await enableAutoRecord(repo, 'review_all');
    expect(await repo.getAutoSettings()).toMatchObject({
      enabled: true, permission: 'granted', saveMode: 'review_all',
      allowedSources: [{ app: 'sms' }, { app: 'kakaotalk' }, { app: 'payapp' }],
    });
  });
});
