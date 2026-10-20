/**
 * Unit 1: what a mix is. Tracks, solo and mute, the fader and the decibel, and a first
 * balance, on Night Drive (pop). Assumes nothing: not even what a fader is.
 */
import { C, abRounds, explain, explore, hear, lesson, listen, mix, namedRounds, pick, task, unit } from '../build';

const S = 'pop';
const TRACKS = ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'pad', 'lead'];
const NAMES: Record<string, string> = { kick: 'Kick', snare: 'Snare', hats: 'Hi-hats', bass: 'Bass', keys: 'Piano', guitar: 'Guitar', pad: 'Pad', lead: 'Lead' };

/** Which track is muted? */
const mutedRounds = (count: number, from = TRACKS) => namedRounds(count, from.map(id => ({ answer: id, mix: { [`${id}:mute`]: 1 }, explain: `The ${NAMES[id].toLowerCase()} was missing.` })));

/** Which one has the lead (or another part) louder? */
const louderRounds = (count: number, ids: string[], amounts: number[]) =>
  abRounds(count, (rng: () => number) => {
    const id = pick(rng, ids);
    const up = pick(rng, amounts);
    return { plain: {}, changed: { [`${id}:fader`]: -6 + up }, explain: `One of them had the ${NAMES[id].toLowerCase()} ${up} dB up.` };
  });

export const MIX_UNIT = unit('pr-mix', 'What a Mix Is', 'Start here', 'Tracks, solo and mute, the fader and the decibel: hearing what’s in a song, and a first balance.', [
  lesson(
    'pr1-1',
    'Tracks and Stems',
    'learn',
    'Hear each part of a song on its own, with solo and mute',
    { session: S, controls: ['*:mute', '*:solo'], fresh: ['*:mute', '*:solo'] },
    [
      explain(
        'A song is many tracks',
        'A song made in a studio isn’t recorded as one sound. Each instrument goes onto its own **track**: the kick drum on one, the bass on another, the singer on another.\n\n**Mixing** is deciding how loud each track is, where it sits from left to right, and how it sounds, so that together they make one piece of music.\n\nPress **Play**. This is *Night Drive*: eight tracks of a pop song, just as they came from the recording. Nothing has been mixed yet.',
      ),
      explore('Meet the band', 'Every strip on the console is one track. Two buttons on each change what you hear: **S** (solo) plays only the soloed tracks; **M** (mute) silences one.', [
        task('Press **Play**', C.playing),
        task('**Solo** the bass: now you hear only it', C.on('bass:solo')),
        task('Solo the lead as well: solos add up', C.all(C.on('bass:solo'), C.on('lead:solo'))),
        task('Turn both solos off, then **mute** the kick, snare and hi-hats: the song without its drums', C.all(C.off('bass:solo'), C.off('lead:solo'), C.on('kick:mute'), C.on('snare:mute'), C.on('hats:mute'))),
      ]),
      explain(
        'Solo is for listening',
        'Solo and mute change what *you* hear while you work. Engineers solo a track to find a problem in it, then judge the fix with everything else playing.\n\nThat matters more than it sounds: a guitar that seems thin on its own can be exactly right in the mix, and one that sounds huge alone can swamp everything else.',
      ),
      listen('What’s missing?', 'One track is muted in each round. Listen for the gap.', 'Which track is muted?', TRACKS.map(id => ({ value: id, label: NAMES[id] })), mutedRounds(5)),
    ],
  ),
  lesson(
    'pr1-2',
    'Faders and Decibels',
    'learn',
    'Use the fader, and hear what a few decibels mean',
    { session: S, controls: ['*:fader'], fresh: ['*:fader'] },
    [
      explain(
        'The fader',
        'Each strip’s **fader** sets how loud its track is in the mix. Slide it up for louder, down for quieter, all the way down for silence.\n\nFaders are marked in **decibels** (dB), the unit for changes in level. **0 dB** means “as it came in”: no louder, no quieter. Negative numbers turn it down.\n\nDecibels go by ratio, not steps: every 6 dB doubles the signal. Your ear hears it more gently than that, as the picture shows.',
        { visual: 'decibels' },
      ),
      explore('Move some faders', 'Drag a fader, or tap it and use the arrow keys. A double-tap puts it back to 0 dB.', [
        task('Pull the **hi-hats** down to −20 dB or lower', C.below('hats:fader', -19.9)),
        task('Push the **lead** up to −2 dB or higher', C.above('lead:fader', -2.1)),
        task('Pull the **pad** all the way down, to −∞', C.below('pad:fader', -59)),
      ]),
      listen('Which is louder?', 'You’ll hear two versions, A and B. In one, a part is turned up. Switch between them as often as you like.', 'In which one is that part louder?', ['A', 'B'], louderRounds(5, ['lead', 'bass', 'kick', 'guitar'], [6, 4, 3])),
      listen(
        'How much louder?',
        'Now the whole mix changes. B is louder than A: by how much?',
        'How much louder is B?',
        [
          { value: '1', label: '1 dB' },
          { value: '3', label: '3 dB' },
          { value: '6', label: '6 dB' },
          { value: '10', label: '10 dB' },
        ],
        (rng: () => number) =>
          Array.from({ length: 4 }, () => {
            const db = pick(rng, [1, 3, 6, 10]);
            const quiet = Object.fromEntries(TRACKS.map(id => [`${id}:fader`, -12]));
            const loud = Object.fromEntries(TRACKS.map(id => [`${id}:fader`, -12 + db]));
            return { mixes: [quiet, loud], answer: String(db), explain: db === 1 ? '1 dB is about the smallest change most people notice.' : db === 10 ? '10 dB sounds roughly twice as loud.' : '' };
          }),
      ),
    ],
  ),
  lesson(
    'pr1-3',
    'A First Balance',
    'quiz',
    'Set the levels of a mix to match a target',
    { session: S, controls: ['*:fader'] },
    [
      explain(
        'Balance comes first',
        'Getting the levels right, the **balance**, is the biggest part of any mix. Listeners might not notice a clever EQ, but they always notice a singer they can’t hear or a hi-hat that pokes them in the ear.\n\nIn a quiz, **Target** plays the mix to make and **Yours** plays your console. Switch between them while the loop plays, move faders, then press **Check**. It doesn’t have to be exact: close enough to hear as the same balance passes.',
        { hear: [hear('Rough mix'), hear('A balanced mix', { 'kick:fader': -4, 'snare:fader': -7, 'hats:fader': -16, 'bass:fader': -5, 'keys:fader': -13, 'guitar:fader': -13, 'pad:fader': -18, 'lead:fader': -3 })] },
      ),
      mix('Bass up, hats down', 'The bass is too shy and the hi-hats too loud. Fix just those two.', { target: { 'bass:fader': -1, 'hats:fader': -15 } }),
      mix('The lead on top', 'The lead plays the tune, so it should sit clearly above everything else, with the pad a quiet bed underneath.', { target: { 'lead:fader': -1, 'pad:fader': -17 } }),
    ],
  ),
  lesson(
    'pr1-c',
    'Checkpoint: Hearing a Mix',
    'checkpoint',
    'Spot a missing track, a louder part, and match a balance',
    { session: S, controls: ['*:fader'] },
    [
      listen('What’s missing?', '', 'Which track is muted?', TRACKS.map(id => ({ value: id, label: NAMES[id] })), mutedRounds(4)),
      listen('Which is louder?', '', 'In which one is that part louder?', ['A', 'B'], louderRounds(4, ['lead', 'bass', 'snare', 'keys'], [4, 3])),
      mix('Match the balance', 'Kick up, guitar back, lead forward: listen to the target and get there.', { target: { 'kick:fader': -2, 'guitar:fader': -13, 'lead:fader': -2 } }),
    ],
  ),
]);
