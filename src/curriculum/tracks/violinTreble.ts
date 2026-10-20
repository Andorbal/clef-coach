import { lesson, name, unit } from '../builders';
import type { TrackDef } from '../types';

/** Violin (being written). */
export const violinTreble: TrackDef = {
  id: 'violin-treble',
  instrument: 'violin',
  title: 'Violin',
  subtitle: 'Violin',
  description: '',
  clef: 'treble',
  accent: '#e8a87c',
  glyph: '',
  heatmap: [],
  units: [
    unit('vt0', 'Placeholder', '', [
      lesson('vt0-1', 'Placeholder', 'learn', '', [name('treble', 'D4', 1)]),
      lesson('vt0-c', 'Placeholder', 'checkpoint', '', [name('treble', 'D4', 1)]),
    ]),
  ],
};
