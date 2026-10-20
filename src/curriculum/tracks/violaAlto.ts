import { lesson, name, unit } from '../builders';
import type { TrackDef } from '../types';

/** Viola (being written). */
export const violaAlto: TrackDef = {
  id: 'viola-alto',
  instrument: 'viola',
  title: 'Viola',
  subtitle: 'Viola',
  description: '',
  clef: 'alto',
  accent: '#e8a87c',
  glyph: '',
  heatmap: [],
  units: [
    unit('va0', 'Placeholder', '', [
      lesson('va0-1', 'Placeholder', 'learn', '', [name('alto', 'D4', 1)]),
      lesson('va0-c', 'Placeholder', 'checkpoint', '', [name('alto', 'D4', 1)]),
    ]),
  ],
};
