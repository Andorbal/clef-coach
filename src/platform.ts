/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with a touch screen). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** What the browser says about the device, for sizing sample memory and warning about slow devices. */
export interface DeviceCapability {
  /** navigator.deviceMemory in GB (Chromium only, which reports at most 8). */
  memoryGB?: number;
  /** Logical processor cores. */
  cores?: number;
  /** A phone or tablet. */
  mobile: boolean;
  /** The browser told us the memory or the core count. */
  known: boolean;
  /** Likely to struggle with big sample banks: little memory, few cores, or a phone. */
  low: boolean;
}

export function deviceCapability(): DeviceCapability {
  if (typeof navigator === 'undefined') return { mobile: false, known: false, low: false };
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  const memoryGB = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 ? nav.deviceMemory : undefined;
  const cores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : undefined;
  const mobile = isIOS() || !!nav.userAgentData?.mobile || /Android|Mobi/i.test(nav.userAgent);
  const known = memoryGB !== undefined || cores !== undefined;
  // a phone or tablet whose browser won't say (Safari) is treated with care: its tabs get little memory
  const low = (memoryGB !== undefined && memoryGB <= 4) || (cores !== undefined && cores <= 2) || (mobile && memoryGB === undefined);
  return { memoryGB, cores, mobile, known, low };
}

/** Megabytes of decoded samples to keep by default, from what the device says about itself. */
export function defaultSampleBudgetMB(cap: DeviceCapability = deviceCapability()): number {
  if (cap.memoryGB !== undefined && cap.memoryGB <= 2) return 192;
  if (cap.low) return 384;
  if (cap.memoryGB !== undefined && cap.memoryGB >= 8) return 2048;
  return 1024;
}
