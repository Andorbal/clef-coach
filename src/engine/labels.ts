import type { ActivityDef } from '../curriculum/types';

export function activityLabel(def: ActivityDef): string {
  switch (def.type) {
    case 'meet': return 'New note';
    case 'name': return def.sequence ? 'Note rush' : 'Name it';
    case 'play': return 'Find it';
    case 'read': return def.gen.accomp ? 'Hands together' : 'Sight-read';
    case 'piece': return 'Piece';
    case 'scale': return 'Scale';
    case 'interval': return 'Intervals';
    case 'keysig': return 'Key signatures';
    case 'rhythm': return 'Rhythm';
    case 'tip': return 'Insight';
    case 'fret-find': return 'Find them all';
    case 'fret-name': return 'Name the fret';
    case 'fret-play': return 'Find the fret';
    case 'fret-octave': return 'Octaves';
    case 'fret-shape': return 'Pattern';
  }
}
