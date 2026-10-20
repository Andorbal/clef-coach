import { lesson, name, unit } from '../builders';
import type { TrackDef } from '../types';

/** Double bass (being written). */
export const doubleBassLines: TrackDef = {
  id: 'doublebass-lines',
  instrument: 'doublebass',
  title: 'Double bass',
  subtitle: 'Double bass',
  description: '',
  clef: 'bass8vb',
  accent: '#e8a87c',
  glyph: '',
  heatmap: [],
  units: [
    unit('db0', 'Placeholder', '', [
      lesson('db0-1', 'Placeholder', 'learn', '', [name('bass8vb', 'D2', 1)]),
      lesson('db0-c', 'Placeholder', 'checkpoint', '', [name('bass8vb', 'D2', 1)]),
    ]),
  ],
};
