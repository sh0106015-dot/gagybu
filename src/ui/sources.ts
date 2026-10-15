import type { AllowedSource, SaveMode, SourceApp } from '../core/model';
import type { Repo } from '../core/repo';

export const AUTO_APPS: SourceApp[] = ['sms', 'kakaotalk', 'payapp'];

export type SourcesForm = Record<string, { on: boolean; senders: string }>;

export function sourcesToForm(allowed: AllowedSource[]): SourcesForm {
  const form: SourcesForm = {};
  for (const app of AUTO_APPS) {
    const rows = allowed.filter((s) => s.app === app);
    form[app] = { on: rows.length > 0, senders: rows.flatMap((r) => (r.sender ? [r.sender] : [])).join(', ') };
  }
  return form;
}

export function formToSources(form: SourcesForm): AllowedSource[] {
  return AUTO_APPS.flatMap((app) => {
    const f = form[app];
    if (!f?.on) return [];
    const senders = f.senders.split(',').map((s) => s.trim()).filter(Boolean);
    return senders.length ? senders.map((sender) => ({ app, sender })) : [{ app }];
  });
}

export async function enableAutoRecord(repo: Repo, saveMode: SaveMode = 'auto'): Promise<void> {
  const s = await repo.getAutoSettings();
  await repo.commit({
    autoSettings: {
      ...s,
      enabled: true,
      permission: 'granted',
      saveMode,
      allowedSources: s.allowedSources.length ? s.allowedSources : AUTO_APPS.map((app) => ({ app })),
    },
  });
}
