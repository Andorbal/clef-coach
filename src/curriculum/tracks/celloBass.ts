import { lesson, name, unit } from '../builders';
import type { TrackDef } from '../types';

/** Cello (being written). */
export const celloBass: TrackDef = {
  id: 'cello-bass',
  instrument: 'cello',
  title: 'Cello',
  subtitle: 'Cello',
  description: '',
  clef: 'bass',
  accent: '#e8a87c',
  glyph: '',
  heatmap: [],
  units: [
    unit('vc0', 'Placeholder', '', [
      lesson('vc0-1', 'Placeholder', 'learn', '', [name('bass', 'D3', 1)]),
      lesson('vc0-c', 'Placeholder', 'checkpoint', '', [name('bass', 'D3', 1)]),
    ]),
  ],
};
