import { describe, it, expect } from 'vitest';
import { buildPresets } from '../../src/ui/presets';
import { parseNotification } from '../../src/core/parser';

describe('simulator presets', () => {
  const presets = buildPresets(new Date(2026, 9, 15, 9, 5));
  const get = (id: string) => presets.find((p) => p.id === id)!;

  it('uses the given date and time', () => {
    expect(get('sms-approve').text).toContain('10/15 09:05');
    expect(get('pay-approve').text).toContain('10월 15일 09:05');
  });
  it('each preset parses as intended', () => {
    const status = (id: string) => parseNotification(get(id).text, get(id).sourceApp).status;
    for (const id of ['sms-approve', 'kakao-approve', 'sms-cancel', 'kakao-cancel', 'sms-partial', 'pay-approve', 'sms-dara']) {
      expect(status(id), id).toBe('tx');
    }
    expect(status('sms-installment')).toBe('tx');
    expect(status('sms-unknown')).toBe('unsupported');
    for (const id of ['ad', 'otp', 'bill']) expect(status(id), id).toBe('non_tx');
  });
});
