/**
 * Unit 3: panning and width. The pan knob and the pan law, what stays in the middle, the
 * rock session's double-tracked guitars spread hard left and right, and the mono check.
 */
import type { Mix } from '../../dsp/params';
import { C, abRounds, explain, explore, hear, lesson, listen, mix, namedRounds, task, unit } from '../build';

/** The balances these lessons start from (the same as the balance unit's). */
const POP: Record<string, number> = { kick: -6, snare: -8, hats: -16, bass: -7, keys: -14, guitar: -14, pad: -20, lead: -5 };
const ACOUSTIC: Record<string, number> = { shaker: -18, bass: -7, guitar: -9, piano: -15, cello: -14, violin: -7 };
const ELECTRONIC: Record<string, number> = { kick: -5, clap: -9, hats: -15, sub: -8, pluck: -14, pad: -19, lead: -10 };
const ROCK: Record<string, number> = { kick: -6, snare: -8, hats: -16, bass: -9, gtrL: -13, gtrR: -13, lead: -9 };

const NAMES: Record<string, string> = { guitar: 'guitar', keys: 'piano', lead: 'lead', piano: 'piano', cello: 'cello', shaker: 'shaker', pluck: 'pluck', hats: 'hi-hats', pad: 'pad' };

const faders = (b: Record<string, number>): Mix => Object.fromEntries(Object.entries(b).map(([id, v]) => [`${id}:fader`, v]));

const WHERE = [
  { value: 'left', label: 'Left' },
  { value: 'centre', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

/** Where is it? Each part at the left, the centre or the right, soloed or in the mix. */
function whereRounds(count: number, parts: string[], solo: boolean) {
  const choices = parts.flatMap(id =>
    (['left', 'centre', 'right'] as const).map(answer => ({
      answer,
      mix: { ...(solo ? { [`${id}:solo`]: 1 } : {}), [`${id}:pan`]: answer === 'left' ? -0.75 : answer === 'right' ? 0.75 : 0 },
      explain: `The ${NAMES[id]} was ${answer === 'centre' ? 'in the centre' : `panned ${answer}`}.`,
    })),
  );
  return namedRounds(count, choices);
}

const WIDE: Mix = { 'gtrL:pan': -1, 'gtrR:pan': 1 };

export const PAN_UNIT = unit('pr-pan', 'Panning and Width', 'The stereo picture', 'Placing parts from left to right, keeping the low end and the lead in the middle, double-tracked guitars, and the mono check.', [
  lesson(
    'pr3-1',
    'The Pan Knob',
    'learn',
    'Place a part between the speakers, and hear where it sits',
    { session: 'pop', start: faders(POP), controls: ['*:pan'], fresh: ['*:pan'] },
    [
      explain(
        'Left, centre and right',
        'Two speakers, or the two sides of your headphones, make a stereo picture: a sound can come from the left, the right, or anywhere between. The **pan** knob places a track in it.\n\nA sound played equally by both speakers seems to come from the middle, a “phantom centre” between them. Turn the knob and it moves across.\n\nThe console shows pan as L or R and how far: **L100** is hard left, **C** the centre. Headphones make this lesson easier.',
        { visual: 'stereo' },
      ),
      explore('Move things around', 'Turn the pan knobs on the strips while the loop plays.', [
        task('Press **Play** and pan the **guitar** to the right, past R50', C.all(C.playing, C.above('guitar:pan', 0.49))),
        task('Pan the **piano** to the left, past L50', C.below('keys:pan', -0.49)),
        task('Move the **hi-hats** just a little to the right, between R10 and R40', C.between('hats:pan', 0.1, 0.4)),
      ]),
      explain(
        'The pan law',
        'As a sound moves across, it should keep the same loudness. This console, like most DAWs, uses an **equal-power** pan law: in the centre each speaker plays the sound about 3 dB down, and together they add up to the same loudness as one speaker playing it at full.\n\nSome DAWs let you choose another law, such as −4.5 or −6 dB in the centre. Whichever it is, it’s why a part can be panned without its balance changing much.',
        { hear: [hear('Guitar hard left', { 'guitar:pan': -1 }), hear('Guitar in the centre'), hear('Guitar hard right', { 'guitar:pan': 1 })] },
      ),
      listen('Where is it?', 'One part plays on its own, somewhere in the stereo picture.', 'Where is it?', WHERE, whereRounds(6, ['guitar', 'keys', 'lead'], true)),
    ],
  ),
  lesson(
    'pr3-2',
    'Keep the Middle Strong',
    'learn',
    'Keep the low end and the lead in the centre and give the rest their own places',
    { session: 'acoustic', start: faders(ACOUSTIC), controls: ['*:pan'] },
    [
      explain(
        'What goes in the middle',
        'Most mixes keep a few things in the centre:\n\n- **The bass and the kick.** The low end carries most of a mix’s energy, and sharing it between both speakers keeps the mix solid and even.\n- **The lead.** What the listener follows stays in front of them, wherever they sit.\n\nEverything else can move out towards the sides, where it stops crowding the middle. Panning is a balance tool too: two parts that clash in the centre can each have a place of their own.',
      ),
      explain(
        'Spreading the band',
        'Some engineers pan only hard left, centre or hard right, nothing in between (**LCR** panning): bold and clear. Most mixes use the in-between places as well, like seats across a stage.\n\nCompare the band all in the middle with the band spread out: the violin, in the centre in both, is easier to hear when the others make room.',
        { hear: [hear('All in the centre'), hear('Spread out', { 'guitar:pan': -0.5, 'piano:pan': 0.4, 'cello:pan': 0.25, 'shaker:pan': 0.6 })] },
      ),
      listen('Where is it in the mix?', 'Now the whole band plays. Find one part among the others.', 'Where is it?', WHERE, whereRounds(6, ['guitar', 'piano', 'cello'], false)),
      mix('Make room', 'The guitar and the piano are both in the middle, on top of the violin. Move them out of its way: the target has one on each side.', { target: { 'guitar:pan': -0.4, 'piano:pan': 0.5 } }),
      mix('Spread the band', 'Now place four parts, keeping the bass and the violin in the middle.', { target: { 'shaker:pan': 0.6, 'cello:pan': -0.4, 'guitar:pan': -0.5, 'piano:pan': 0.4 } }),
    ],
  ),
  lesson(
    'pr3-3',
    'Double-Tracked Guitars',
    'learn',
    'Spread two takes of the same part hard left and right for one wide guitar',
    { session: 'rock', start: faders(ROCK), controls: ['*:pan'] },
    [
      explain(
        'Two takes, one wide guitar',
        'Rock guitars are often recorded twice: the same part, played two times. Pan one take hard left and the other hard right and, because no two performances are exactly alike (the timing and the tone wander a little), your ears hear one big guitar spread across the speakers.\n\nCopy one take to both sides and you get nothing of the kind: identical sounds in both speakers simply appear in the middle. *Fuzz Garden* has two real takes, **Guitar 1** and **Guitar 2**.',
        { hear: [hear('Both in the centre'), hear('Hard left and right', WIDE)] },
      ),
      explore('Spread them', 'Pan the two guitar takes to opposite sides.', [
        task('Press **Play** and pan **Guitar 1** hard left (L100)', C.all(C.playing, C.below('gtrL:pan', -0.97))),
        task('Pan **Guitar 2** hard right (R100)', C.above('gtrR:pan', 0.97)),
        task('Move the **hi-hats** a little off centre, as the kit would sit in front of you', C.any(C.below('hats:pan', -0.15), C.above('hats:pan', 0.15))),
      ]),
      listen('Wide or narrow?', 'In one of these the guitars are spread wide; in the other they’re in the middle.', 'In which one are the guitars spread wide?', ['A', 'B'], abRounds(4, () => ({ plain: {}, changed: WIDE, explain: 'Wide guitars leave the middle to the kick, snare, bass and lead.' }))),
      mix('Match the picture', 'Spread the guitars, and put the hi-hats where the target has them. Drummers and audiences see the kit from opposite sides, so either side can be right: this target picks the left.', { target: { ...WIDE, 'hats:pan': -0.4 } }),
    ],
  ),
  lesson(
    'pr3-4',
    'Check in Mono',
    'learn',
    'Hear a mix folded to mono, and what happens to parts panned to the sides',
    { session: 'rock', start: faders(ROCK), controls: ['master:mono', '*:pan'], fresh: ['master:mono'] },
    [
      explain(
        'Not everyone hears stereo',
        'Lots of people hear music in mono: a phone’s speaker, a Bluetooth box, the ceiling speakers in a shop. A mix should still work when its two sides are added together.\n\nThe **Mono** switch on the master folds the mix to mono while you listen. It’s a check, not part of the mix: it changes what you hear, nothing else.',
      ),
      explore('Fold it down', 'The guitars start in the middle. Use **Mono** on the master strip and the pan knobs.', [
        task('Press **Play** and switch **Mono** on', C.all(C.playing, C.on('master:mono'))),
        task('Still in mono, pan the guitars hard left and right: they get a little quieter, but they don’t move', C.all(C.on('master:mono'), C.below('gtrL:pan', -0.97), C.above('gtrR:pan', 0.97))),
        task('Switch **Mono** off: now they spread out', C.all(C.off('master:mono'), C.below('gtrL:pan', -0.97), C.above('gtrR:pan', 0.97))),
      ]),
      explain(
        'Why things drop in mono',
        'Mono adds the left and right together. A part in the centre is in both sides, so it stays as it was. A part panned hard to one side is in only one, so with this console’s −3 dB pan law it comes out about 3 dB quieter against the parts in the centre.\n\nSo wide parts always sit a little lower in mono. Check that the lead and the beat still come through, and that nothing you need disappears.',
        { hear: [hear('Stereo', WIDE), hear('Mono', { ...WIDE, 'master:mono': 1 })] },
      ),
      listen('Stereo or mono?', 'One of these is the mix in stereo, the other folded to mono.', 'Which one is in mono?', ['A', 'B'], abRounds(4, () => ({ plain: WIDE, changed: { ...WIDE, 'master:mono': 1 }, explain: 'In mono the guitars stop being wide and sit a little lower.' }))),
    ],
  ),
  lesson(
    'pr3-c',
    'Checkpoint: Panning and Width',
    'checkpoint',
    'Find parts in the stereo picture and place a band',
    { session: 'electronic', start: faders(ELECTRONIC), controls: ['*:pan'] },
    [
      listen('Where is it?', 'Find each part in *Neon Rain*.', 'Where is it?', WHERE, whereRounds(5, ['pluck', 'hats', 'pad'], false)),
      mix('Place the band', 'Give the pluck and the hi-hats places of their own, where the target has them.', { target: { 'pluck:pan': -0.5, 'hats:pan': 0.4 } }),
      mix('Centre the backbone', 'Someone has panned the kick, the sub bass and the lead off to the sides. Put them back where they belong.', { start: { 'sub:pan': 0.7, 'kick:pan': -0.6, 'lead:pan': 0.5 }, target: { 'sub:pan': 0, 'kick:pan': 0, 'lead:pan': 0 } }),
    ],
  ),
]);
