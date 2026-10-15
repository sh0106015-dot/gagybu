import { describe, it, expect } from 'vitest';
import { CSP } from '../../csp';

const directives = Object.fromEntries(CSP.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [k, ...v] = d.split(/\s+/);
  return [k, v];
}));

describe('content security policy', () => {
  it('only lets the app talk to itself', () => {
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['connect-src']).toEqual(["'self'"]);
    expect(directives['script-src']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['form-action']).toEqual(["'self'"]);
  });
  it('never allows wildcards or inline/eval scripts', () => {
    expect(CSP).not.toMatch(/\*|unsafe-eval|https?:/);
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
  });
  it('keeps receipt photos and QR images working', () => {
    expect(directives['img-src']).toEqual(["'self'", 'data:', 'blob:']);
  });
});
