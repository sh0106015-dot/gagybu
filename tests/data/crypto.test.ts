import { describe, it, expect } from 'vitest';
import { generateDeviceKey, encryptText, decryptText, hashPin, verifyPin } from '../../src/data/crypto';

describe('crypto', () => {
  it('round-trips with random IV', async () => {
    const key = await generateDeviceKey();
    const a = await encryptText(key, '가나카드 12,000원 스타벅스');
    const b = await encryptText(key, '가나카드 12,000원 스타벅스');
    expect(a).not.toBe(b);
    expect(a).not.toContain('스타벅스');
    expect(await decryptText(key, a)).toBe('가나카드 12,000원 스타벅스');
  });
  it('fails with another key', async () => {
    const payload = await encryptText(await generateDeviceKey(), 'x');
    await expect(decryptText(await generateDeviceKey(), payload)).rejects.toThrow();
  });
  it('hashes and verifies PIN', async () => {
    const { hash, salt } = await hashPin('1234');
    expect(hash).not.toContain('1234');
    expect(await verifyPin('1234', hash, salt)).toBe(true);
    expect(await verifyPin('1235', hash, salt)).toBe(false);
  });
});
