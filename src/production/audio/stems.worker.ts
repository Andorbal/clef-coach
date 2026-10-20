/**
 * The studio worker: renders stems and judges mixes (audio/studioCore.ts) away from the
 * page, so the console stays smooth on an iPad while a session is being set up.
 */
import { StudioCore, type JudgeRequest } from './studioCore';
import type { StemRequest } from '../dsp/stems';
import type { Mix } from '../dsp/params';

export type StudioRequest =
  | { t: 'stems'; id: number; req: StemRequest }
  | { t: 'prepare'; id: number; job: JudgeRequest }
  | { t: 'score'; id: number; key: string; mix: Mix };

const core = new StudioCore();

self.onmessage = (e: MessageEvent<StudioRequest>) => {
  const m = e.data;
  try {
    if (m.t === 'stems') self.postMessage({ id: m.id, ok: true, value: core.stems(m.req) });
    else if (m.t === 'prepare') {
      core.prepare(m.job);
      self.postMessage({ id: m.id, ok: true, value: null });
    } else self.postMessage({ id: m.id, ok: true, value: core.score(m.key, m.mix) });
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err) });
  }
};
