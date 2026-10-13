import { useEffect, useMemo, useState } from 'react';
import { scoreFromText } from '../music/parse';
import { autoFinger } from '../music/autofinger';
import { buildSteps } from '../music/score';
import { NotationView, type NoteState } from '../notation/NotationView';
import { parsePitch } from '../music/pitch';

export default function NotationPreview() {
  const ode = useMemo(() => autoFinger(scoreFromText({
    id: 'ode', instrument: 'piano', key: 'C', time: [4, 4],
    staves: [{ clef: 'treble', hand: 'R', voices: ['E4/q@3 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/q. D4/e D4/h | E4/q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/q. C4/e C4/h |'] }],
  })), []);
  const grand = useMemo(() => autoFinger(scoreFromText({
    id: 'grand', instrument: 'piano', key: 'G', time: [3, 4],
    staves: [
      { clef: 'treble', hand: 'R', voices: ['D5/q G4/e A4 B4 C5 | D5/q G4 G4 | E5/q C5/e D5 E5 F#5 | G5/q G4 G4 | [C5 E5]/h. | Bb4/e3 C5 D5 E5/q F#5 |'] },
      { clef: 'bass', hand: 'L', voices: ['[G2 B2 D3]/h A3/q | B3/h. | C4/h. | B3/h. | A3/h~ A3/q | D3/h. |'] },
    ],
  })), []);
  const guitar = useMemo(() => autoFinger(scoreFromText({
    id: 'gtr', instrument: 'guitar', key: 'Em', time: [4, 4],
    staves: [{ clef: 'treble8vb', voices: ['E2/q G2 A2 B2 | D3/e E3 G3 A3 B3/q E4 | G4/h F#4/q D#4 | E4/w |'] }],
  })), []);
  const bass = useMemo(() => autoFinger(scoreFromText({
    id: 'bass', instrument: 'piano', key: 'F', time: [4, 4],
    staves: [{ clef: 'bass', hand: 'L', voices: ['F3/q G3 A3 Bb3 | C4/h A3 | F2/q C3 E2 C2 | F2/w |'] }],
  })), []);
  const flash = useMemo(() => scoreFromText({
    id: 'flash', instrument: 'piano', key: 'C', time: [4, 4],
    staves: [{ clef: 'treble', voices: ['A5/w |'] }],
  }), []);

  const steps = useMemo(() => buildSteps(ode), [ode]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % steps.length), 900);
    return () => clearInterval(t);
  }, [steps]);
  const states = useMemo(() => {
    const s: Record<string, NoteState> = {};
    steps.forEach((st, k) => st.elIds.forEach(id => (s[id] = k < i ? (k === 3 ? 'bad' : 'done') : k === i ? 'active' : undefined as never)));
    return s;
  }, [steps, i]);

  return (
    <div className="page" style={{ display: 'grid', gap: 24 }}>
      <h1 className="display">Notation preview</h1>
      <div className="paper" style={{ height: 220 }}>
        <NotationView score={ode} states={states} focusId={steps[i]?.elIds[0]} fingering noteNames="all" ghosts={i % 4 === 1 ? [{ key: 'g' + i, staff: 0, pitch: parsePitch('A4'), tone: 'bad' }] : []} />
      </div>
      <div className="paper" style={{ height: 320 }}>
        <NotationView score={grand} fingering focusId={grand.staves[0].voices[0].notes[0].id} />
      </div>
      <div className="paper" style={{ height: 230 }}>
        <NotationView score={guitar} fingering strings />
      </div>
      <div className="paper" style={{ height: 220 }}>
        <NotationView score={bass} fingering noteNames="all" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="paper" style={{ height: 240 }}>
          <NotationView score={flash} layout="center" timeSignature={false} barlines={false} beatWidth={14} />
        </div>
        <div className="paper" style={{ height: 240 }}>
          <NotationView score={flash} layout="center" timeSignature={false} barlines={false} beatWidth={14} states={{ [flash.staves[0].voices[0].notes[0].id]: 'good' }} noteNames="all" />
        </div>
      </div>
    </div>
  );
}
