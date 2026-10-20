/**
 * Unit 6: compression. What a compressor does, threshold and ratio, the gain reduction
 * meter, makeup gain, evening out an uneven part, attack and release on a drum, and too
 * much of it. On Night Drive (pop), with uneven takes of the bass and the lead; the last
 * quiz on Porch Light (acoustic).
 */
import type { Mix } from '../../dsp/params';
import { C, abRounds, explain, explore, hear, lesson, listen, mix, namedRounds, pick, task, unit } from '../build';

const S = 'pop';
const TRACKS = ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'pad', 'lead'];
/** Night Drive with a bass player whose notes come out uneven (up to 12 dB apart). */
const UNEVEN_BASS = TRACKS.map(id => (id === 'bass' ? { id: 'bass', from: 'bass', fault: { uneven: 12 } } : id));
/** And with an uneven lead. */
const UNEVEN_LEAD = TRACKS.map(id => (id === 'lead' ? { id: 'lead', from: 'lead', fault: { uneven: 10 } } : id));

const comp = (ch: string, threshold: number, ratio: number, makeup: number, more: Mix = {}): Mix => ({ [`${ch}:compOn`]: 1, [`${ch}:threshold`]: threshold, [`${ch}:ratio`]: ratio, [`${ch}:makeup`]: makeup, ...Object.fromEntries(Object.entries(more).map(([k, v]) => [`${ch}:${k}`, v])) });

/** A and B, one compressed (and turned back up to about the same level): which one? */
const compressedRounds = (count: number, ch: string) =>
  abRounds(count, (rng: () => number) => {
    const [threshold, ratio, makeup] = pick(rng, [
      [-28, 8, 8],
      [-26, 6, 7],
      [-30, 10, 9],
    ] as const);
    return { plain: { [`${ch}:solo`]: 1 }, changed: { [`${ch}:solo`]: 1, ...comp(ch, threshold, ratio, makeup, { attack: 3 }) }, explain: 'The compressed one keeps a steadier level: the loud notes no longer jump out.' };
  });

/** The snare, compressed with a fast or a slow attack: which? */
const SNARE_COMP = comp('snare', -30, 8, 8, { release: 120 });
const attackRounds = (count: number) =>
  namedRounds(count, [
    { answer: 'fast', mix: { 'snare:solo': 1, ...SNARE_COMP, 'snare:attack': 0.3 }, explain: 'A fast attack clamps down on each hit at once: the crack is blunted.' },
    { answer: 'slow', mix: { 'snare:solo': 1, ...SNARE_COMP, 'snare:attack': 30 }, explain: 'A slow attack lets the first crack of each hit through before it turns down.' },
  ]);

export const COMP_UNIT = unit('pr-comp', 'Compression', 'Evening out', 'What a compressor does, threshold and ratio, makeup gain, attack and release, and how to tell when it’s too much.', [
  lesson(
    'pr6-1',
    'What a Compressor Does',
    'learn',
    'Turn the loud parts of a track down automatically',
    { session: S, channels: UNEVEN_BASS, controls: ['bass:comp', 'bass:solo'], fresh: ['bass:comp'] },
    [
      explain(
        'An automatic hand on the fader',
        'Some notes of this bass came out much louder than others. In the mix the loud ones jump out and the quiet ones get lost.\n\nA **compressor** fixes that automatically. Whenever the track goes above a level you set, the **threshold**, it turns it down. Quiet notes go through untouched; loud ones are brought down towards them.\n\nThe result is a steadier level that sits in one place in the mix. Listen to the bass alone, then compressed.',
        { visual: 'compressor', hear: [hear('Uneven bass', { 'bass:solo': 1 }), hear('Compressed', { 'bass:solo': 1, ...comp('bass', -26, 6, 7, { attack: 5 }) })] },
      ),
      explore('Switch it on', 'Watch the **gain reduction** meter on the compressor: it shows how many decibels it is turning down, moment by moment.', [
        task('Press **Play** and **solo** the bass: listen to some notes jump out', C.all(C.playing, C.on('bass:solo'))),
        task('Turn the **Compressor** on', C.on('bass:compOn')),
        task('Lower the **Threshold** until the gain reduction meter shows 3 dB or more', C.all(C.on('bass:compOn'), C.reducing('bass', 3))),
        task('Raise the **Ratio** to 4:1 or more and hear the loud notes come down further', C.all(C.on('bass:compOn'), C.above('bass:ratio', 3.9))),
      ]),
      explain(
        'Threshold and ratio',
        'The **threshold** is the level where the compressor starts working: lower it and more of the track gets turned down.\n\nThe **ratio** is how hard it turns down whatever goes over. At **4:1**, a note 4 dB over the threshold comes out only 1 dB over. At 2:1 it’s gentle; at 10:1 and up the level barely gets past the threshold at all (that’s close to a **limiter**).\n\nA few dB of gain reduction on the loudest notes is a light touch; 10 dB or more is heavy.',
        { visual: 'compressor' },
      ),
      listen('Which is compressed?', 'One of these is the bass as it was played, the other compressed and turned back up.', 'Which one is compressed?', ['A', 'B'], compressedRounds(5, 'bass')),
    ],
  ),
  lesson(
    'pr6-2',
    'Makeup Gain',
    'learn',
    'Bring a compressed track back up, and compare fairly',
    { session: S, channels: UNEVEN_BASS, controls: ['bass:comp', 'bass:solo'], fresh: ['bass:makeup'] },
    [
      explain(
        'Turning it back up',
        'A compressor only ever turns down, so a compressed track comes out quieter. **Makeup gain** turns the whole track back up afterwards.\n\nNow the loud notes are about where they were, and the quiet ones are louder than before: the gap between them has shrunk. That’s why compression can make a part sound fuller and closer.',
        { hear: [hear('Compressed, no makeup', { 'bass:solo': 1, ...comp('bass', -26, 6, 0, { attack: 5 }) }), hear('With makeup gain', { 'bass:solo': 1, ...comp('bass', -26, 6, 7, { attack: 5 }) })] },
      ),
      explore('Make it up', 'Compress the bass, then bring its level back.', [
        task('Turn on the bass’s **Compressor** and set the **Threshold** below −20 dB', C.all(C.on('bass:compOn'), C.below('bass:threshold', -20))),
        task('Set the **Ratio** to 4:1 or more', C.all(C.on('bass:compOn'), C.above('bass:ratio', 3.9))),
        task('Raise the **Makeup** gain to 5 dB or more', C.all(C.on('bass:compOn'), C.above('bass:makeup', 4.9))),
      ]),
      explain(
        'Louder fools your ears',
        'Turn anything up a little and it sounds better: fuller, clearer, more exciting. That trick catches everyone out with compressors.\n\nSo when you compare a track with and without compression, set the makeup gain so both play at about the same level. Then you’re judging what the compressor did, not the extra volume.',
      ),
      mix('Even out the bass', 'Compress the uneven bass until its level is as steady as the target’s, with makeup gain bringing it back to the same place in the mix.', { target: comp('bass', -26, 6, 7) }),
    ],
  ),
  lesson(
    'pr6-3',
    'Attack and Release',
    'learn',
    'Choose how fast the compressor grabs and lets go',
    { session: S, controls: ['snare:comp', 'snare:solo'], fresh: ['snare:attack', 'snare:release'] },
    [
      explain(
        'How fast it reacts',
        'The **attack** is how quickly the compressor turns down once the sound goes over the threshold; the **release** is how quickly it lets go afterwards.\n\nOn a drum this changes everything. A **slow attack** (20–40 ms) lets the first crack of each hit through before it clamps down: punchy. A **fast attack** (under a millisecond) catches the crack too: smoother, softer, further back.\n\nListen to the snare both ways.',
        { hear: [hear('No compression', { 'snare:solo': 1 }), hear('Fast attack', { 'snare:solo': 1, ...SNARE_COMP, 'snare:attack': 0.3 }), hear('Slow attack', { 'snare:solo': 1, ...SNARE_COMP, 'snare:attack': 30 })] },
      ),
      explore('Shape the snare', 'Set up a heavy compressor on the snare, then turn the attack and the release.', [
        task('Turn on the snare’s **Compressor**, **Threshold** below −24 dB, **Ratio** 6:1 or more', C.all(C.on('snare:compOn'), C.below('snare:threshold', -24), C.above('snare:ratio', 5.9))),
        task('Set a fast **Attack**, under 1 ms: the crack goes soft', C.all(C.on('snare:compOn'), C.below('snare:attack', 1))),
        task('Now a slow one, 30 ms or more: the crack comes back', C.all(C.on('snare:compOn'), C.above('snare:attack', 30))),
        task('Try a long **Release**, over 400 ms: it stays turned down into the next hit', C.all(C.on('snare:compOn'), C.above('snare:release', 400))),
      ]),
      explain(
        'And the release',
        'A **release** that’s too short lets go between every hit and can make the sound flutter or distort. One that’s too long stays turned down into the next hit, so everything after the first gets squashed.\n\nA good start on most parts: let the gain reduction meter fall back to about zero just before the next beat.',
      ),
      listen('Fast or slow attack?', 'The snare is compressed hard in every round. Is the attack fast or slow?', 'Is the attack fast or slow?', [{ value: 'fast', label: 'Fast attack' }, { value: 'slow', label: 'Slow attack' }], attackRounds(6)),
      // judged on dynamics only: a slower attack also lets more level through, but the lesson is the crack, not the snare's place in the balance.
      // 30 ms rather than 40: the snare's measured range jumps between 43 and 46 ms (its sparse hits sit near the judge's gate), so a near miss of 40 could fall off it
      mix('Keep the crack', 'This snare is compressed with a fast attack and has gone soft. Change the attack until each hit cracks like the target’s.', { start: { ...SNARE_COMP, 'snare:attack': 0.3 }, target: { 'snare:attack': 30 }, aspects: ['dynamics'], channels: ['snare'] }),
    ],
  ),
  lesson(
    'pr6-4',
    'Too Much of a Good Thing',
    'learn',
    'Hear when a track is over-compressed, and ease off',
    { session: S, channels: UNEVEN_LEAD, controls: ['lead:comp', 'lead:solo'] },
    [
      explain(
        'Squashed',
        'Compress too hard and a part loses its life. The loudest moments can’t get any louder, the quiet details are pushed up to meet them, and everything sits at one flat level. With a fast release you can hear the level **pump**: breathing up and down with the music.\n\nA very low threshold, a very high ratio and lots of makeup gain is the recipe. Listen.',
        { hear: [hear('Uncompressed', { 'lead:solo': 1 }), hear('Gently compressed', { 'lead:solo': 1, ...comp('lead', -18, 3, 4) }), hear('Squashed', { 'lead:solo': 1, ...comp('lead', -45, 20, 20, { attack: 0.1, release: 20 }) })] },
      ),
      explore('Squash it', 'Hear the damage for yourself, so you know it when you meet it.', [
        task('Turn the lead’s **Compressor** on with the **Threshold** at −40 dB or lower', C.all(C.on('lead:compOn'), C.below('lead:threshold', -40))),
        task('Push the **Ratio** to 10:1 or more and watch the gain reduction', C.all(C.on('lead:compOn'), C.above('lead:ratio', 9.9))),
        task('Shorten the **Release** below 30 ms and listen for the pumping', C.all(C.on('lead:compOn'), C.below('lead:release', 30))),
      ]),
      listen(
        'Gentle or squashed?',
        'Each round is the lead compressed one way or the other.',
        'How is it compressed?',
        [
          { value: 'gentle', label: 'Gently' },
          { value: 'squashed', label: 'Squashed' },
        ],
        namedRounds(6, [
          { answer: 'gentle', mix: { 'lead:solo': 1, ...comp('lead', -18, 3, 4) }, explain: 'Gently: the notes still rise and fall.' },
          { answer: 'squashed', mix: { 'lead:solo': 1, ...comp('lead', -45, 20, 20, { attack: 0.1, release: 20 }) }, explain: 'Squashed: every moment at the same flat level.' },
        ]),
      ),
      mix('Ease off', 'Someone has squashed the lead. Bring back its life: match the target’s gentler compression.', { start: comp('lead', -45, 20, 20, { attack: 0.1, release: 20 }), target: comp('lead', -18, 3, 4, { attack: 10, release: 120 }) }),
    ],
  ),
  lesson(
    'pr6-5',
    'Compressing a Lead',
    'quiz',
    'Even out a lead line by ear',
    { session: 'acoustic', channels: ['shaker', 'bass', 'guitar', 'piano', 'cello', { id: 'violin', from: 'violin', fault: { uneven: 12 } }], controls: ['violin:comp', 'violin:solo'] },
    [
      explain(
        'The tune, steady',
        'The violin plays the tune of *Porch Light*, but some of its notes came out much louder than others. The tune is what listeners follow, so every note of it should be heard.\n\nUse what you know: a threshold low enough to catch the loud notes, a ratio to bring them in, and makeup gain to put the violin back where it was.',
        { hear: [hear('Uneven violin'), hear('Compressed', comp('violin', -26, 6, 7))] },
      ),
      mix('Even out the violin', 'Compress the violin until it’s as steady as the target and sits at the same level.', { target: comp('violin', -26, 6, 7) }),
    ],
  ),
  lesson(
    'pr6-c',
    'Checkpoint: Compression',
    'checkpoint',
    'Hear compression, even out a part and keep a drum’s punch',
    { session: S, channels: UNEVEN_BASS, controls: ['bass:comp', 'snare:comp', 'bass:solo', 'snare:solo'] },
    [
      listen('Which is compressed?', '', 'Which one is compressed?', ['A', 'B'], compressedRounds(4, 'bass')),
      mix('Even out the bass', 'Make the bass as steady as the target.', { controls: ['bass:comp', 'bass:solo'], target: comp('bass', -28, 8, 8) }),
      mix('Keep the crack', 'The snare’s compressor has blunted every hit. Let the crack back through.', { controls: ['snare:comp', 'snare:solo'], start: { ...SNARE_COMP, 'snare:attack': 0.3 }, target: { 'snare:attack': 30 }, aspects: ['dynamics'], channels: ['snare'] }),
    ],
  ),
]);
