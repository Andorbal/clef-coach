import type { ActivityDef } from '../curriculum/types';
import type { ActivityProps } from './context';
import { Flashcards } from './activities/Flashcards';
import { FretFind, FretQuiz, FretShape } from './activities/Fret';
import { Meet } from './activities/Meet';
import { PieceActivity, ReadActivity, ScaleActivity } from './activities/Reading';
import { RhythmTap, TipActivity } from './activities/Simple';

/** Route an activity definition to its component. */
export function Activity(props: ActivityProps<ActivityDef>) {
  const { def } = props;
  switch (def.type) {
    case 'meet':
      return <Meet {...props} def={def} />;
    case 'name':
    case 'play':
    case 'interval':
    case 'keysig':
      return <Flashcards {...props} def={def} />;
    case 'read':
      return <ReadActivity {...props} def={def} />;
    case 'piece':
      return <PieceActivity {...props} def={def} />;
    case 'scale':
      return <ScaleActivity {...props} def={def} />;
    case 'rhythm':
      return <RhythmTap {...props} def={def} />;
    case 'tip':
      return <TipActivity {...props} def={def} />;
    case 'fret-find':
      return <FretFind {...props} def={def} />;
    case 'fret-name':
    case 'fret-play':
    case 'fret-octave':
      return <FretQuiz {...props} def={def} />;
    case 'fret-shape':
      return <FretShape {...props} def={def} />;
    default:
      return null;
  }
}

export { activityLabel } from './labels';
