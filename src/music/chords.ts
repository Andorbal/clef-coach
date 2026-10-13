import { pitchClass, spellMidi, stepLabel } from './pitch';

const TEMPLATES: [string, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['°', [0, 3, 6]],
  ['+', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['ø7', [0, 3, 6, 10]],
  ['°7', [0, 3, 6, 9]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['m(maj7)', [0, 3, 7, 11]],
  ['7sus4', [0, 5, 7, 10]],
  ['add9', [0, 2, 4, 7]],
];

const INTERVALS = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];

const pcName = (pc: number, flats: boolean) => {
  const p = spellMidi(60 + pc, flats ? -1 : 1);
  return stepLabel(p.step, p.alter);
};

/** Name what's being held: an interval for two notes, a chord symbol for three or more. */
export function describeNotes(midis: number[]): string | null {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const pcs = [...new Set(sorted.map(pitchClass))];
  if (pcs.length === 1) return sorted.length > 1 ? 'Octave' : null;
  if (pcs.length === 2 && sorted.length >= 2) {
    const iv = (sorted[sorted.length - 1] - sorted[0]) % 12;
    const compound = sorted[sorted.length - 1] - sorted[0] > 12;
    return `${compound ? 'Compound ' : ''}${INTERVALS[iv === 0 ? 0 : iv]}`;
  }
  const bassPc = pitchClass(sorted[0]);
  for (const root of [bassPc, ...pcs.filter(p => p !== bassPc)]) {
    const rel = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const [sym, tpl] of TEMPLATES) {
      if (tpl.length === rel.length && tpl.every((x, i) => x === rel[i])) {
        const flats = [1, 3, 5, 8, 10].includes(root) && !['', '7', 'maj7', '6', 'add9'].includes(sym);
        const rootName = pcName(root, flats || [3, 8, 10].includes(root));
        const bass = root !== bassPc ? `/${pcName(bassPc, [3, 8, 10].includes(bassPc))}` : '';
        return `${rootName}${sym}${bass}`;
      }
    }
  }
  return null;
}
