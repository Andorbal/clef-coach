import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSampleBudgetMB, deviceCapability } from './platform';

const nav = (n: Record<string, unknown>) => vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux', maxTouchPoints: 0, ...n });

describe('device capability', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('trusts a big machine', () => {
    nav({ deviceMemory: 8, hardwareConcurrency: 16 });
    const c = deviceCapability();
    expect(c).toMatchObject({ memoryGB: 8, cores: 16, known: true, low: false, mobile: false });
    expect(defaultSampleBudgetMB(c)).toBe(2048);
  });

  it('warns about a small one', () => {
    nav({ deviceMemory: 2, hardwareConcurrency: 4 });
    const c = deviceCapability();
    expect(c.low).toBe(true);
    expect(defaultSampleBudgetMB(c)).toBe(192);
  });

  it('cannot tell when the browser says nothing (desktop Safari, Firefox)', () => {
    nav({});
    const c = deviceCapability();
    expect(c).toMatchObject({ known: false, low: false });
    expect(defaultSampleBudgetMB(c)).toBe(1024);
  });

  it('is careful with a phone or tablet that won’t say', () => {
    nav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', hardwareConcurrency: 6 });
    const c = deviceCapability();
    expect(c).toMatchObject({ mobile: true, low: true });
    expect(defaultSampleBudgetMB(c)).toBe(384);
  });
});
