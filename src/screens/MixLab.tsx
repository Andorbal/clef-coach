/**
 * The Mix Lab: the whole console, every section showing, with any of the four sessions
 * to mix freely. "Reference" plays a finished mix of the session on the same loop, to
 * compare against, as engineers do with a record they like. Each session's mix is
 * remembered on this device.
 */
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Segmented } from '../components/ui';
import { usePracticeFocus } from '../components/usePracticeFocus';
import { expandControls } from '../production/course/controls';
import { type Mix, makeMix } from '../production/dsp/params';
import { SESSIONS, getSession } from '../production/dsp/sessions';
import { Console } from '../production/ui/Console';
import { useConsole } from '../production/ui/useConsole';
import '../synthlab/ui/synthlab.css';
import '../production/ui/production.css';
import './lesson.css';

const KEY = 'clefcoach.mixlab.v1';
const ALL = ['*:trim', '*:hp', '*:eq', '*:comp', '*:reverb', '*:delay', '*:pan', '*:mute', '*:solo', '*:fader', 'fx:reverb', 'fx:delay', 'master:comp', 'master:limiter', 'master:mono', 'master:fader'];

function loadSaved(): { session: string; mixes: Record<string, Mix> } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && typeof v.session === 'string' && SESSIONS.some(s => s.id === v.session)) return { session: v.session, mixes: v.mixes ?? {} };
    }
  } catch {
    /* storage blocked or damaged: start fresh */
  }
  return { session: SESSIONS[0].id, mixes: {} };
}

export default function MixLab() {
  const [saved] = useState(loadSaved);
  const [sessionId, setSessionId] = useState(saved.session);
  return <LabRun key={sessionId} sessionId={sessionId} saved={saved} onSession={setSessionId} />;
}

function LabRun({ sessionId, saved, onSession }: { sessionId: string; saved: { session: string; mixes: Record<string, Mix> }; onSession: (id: string) => void }) {
  const navigate = useNavigate();
  usePracticeFocus();
  const session = getSession(sessionId);
  const api = useConsole({ session: sessionId, start: saved.mixes[sessionId] ?? {} });
  const visible = useMemo(() => expandControls(ALL, api.channels), [api.channels]);
  const reference = useMemo(() => makeMix(api.channels, session.rough, session.reference), [api.channels, session]);
  const [confirmReset, setConfirmReset] = useState(false);

  // remember each session's mix (a convenience on this device only)
  useEffect(() => {
    const t = setTimeout(() => {
      saved.mixes[sessionId] = api.mix;
      saved.session = sessionId;
      try {
        localStorage.setItem(KEY, JSON.stringify(saved));
      } catch {
        /* storage full or blocked */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [api.mix, sessionId, saved]);

  const ab = (
    <div className="pr-ab" role="group" aria-label="Hear">
      <button className={api.audition === 'Reference' ? 'on' : ''} aria-pressed={api.audition === 'Reference'} onClick={() => {
        api.hearMix('Reference', reference);
        if (!api.playing) void api.play();
      }}>
        Reference
      </button>
      <button className={api.audition === null ? 'on' : ''} aria-pressed={api.audition === null} onClick={() => api.hearMix(null)}>
        Yours
      </button>
    </div>
  );

  return (
    <div className="lesson-shell pr-lab" style={{ ['--accent' as string]: '#4dd0c8' }}>
      <header className="lesson-top pr-lab-top">
        <button className="btn btn-icon btn-ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/production'))} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="pr-lab-title">
          <strong className="display">Mix Lab</strong>
          <span className="faint">{session.blurb}</span>
        </div>
        <Segmented<string> size="sm" value={sessionId} onChange={onSession} options={SESSIONS.map(s => ({ value: s.id, label: s.title }))} />
        <button className="btn btn-sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={16} /> Start again
        </button>
      </header>
      <main className="pr-lab-main">{api.error ? <div className="course-feedback bad">{api.error}</div> : <Console api={api} visible={visible} transport={ab} autoOpen={false} />}</main>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Start this mix again?">
        <p className="dim">The console goes back to the rough mix, as the session came from the recording.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmReset(false)}>
            Keep my mix
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              api.reset(makeMix(api.channels, session.rough));
              setConfirmReset(false);
            }}
          >
            Start again
          </button>
        </div>
      </Modal>
    </div>
  );
}
