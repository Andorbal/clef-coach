/**
 * Unit 8: the mix bus. Where every track meets, headroom for mastering, bus compression as
 * glue, the mono check, and comparing with a reference at the same loudness.
 */
import type { Mix } from '../../dsp/params';
import { getSession } from '../../dsp/sessions';
import { C, abRounds, explain, explore, hear, lesson, listen, mix, pick, task, unit } from '../build';

/** Every channel's fader set to one level (a hot session: all of them pushed up). */
const allFaders = (channels: string[], db: number): Mix => Object.fromEntries(channels.map(c => [`${c}:fader`, db]));

const POP = ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'pad', 'lead'];
const ELECTRONIC = ['kick', 'clap', 'hats', 'sub', 'pluck', 'pad', 'lead'];

/** The parts of a session's reference mix that set its balance and panning. */
function referenceBalance(session: string): Mix {
  const ref = getSession(session).reference;
  return Object.fromEntries(Object.entries(ref).filter(([k]) => /:(fader|pan)$/.test(k) && !k.startsWith('master:')));
}

/** A or B: which one is folded to mono? */
const monoRounds = (count: number) => abRounds(count, () => ({ plain: {}, changed: { 'master:mono': 1 }, explain: 'In mono the guitars come from the middle with everything else, and get a little quieter against the centre.' }));

export const BUS_UNIT = unit('pr-bus', 'The Mix Bus', 'Glue and headroom', 'The bus every track meets on: headroom for mastering, bus compression as glue, the mono check, and comparing with a reference.', [
  lesson(
    'pr8-1',
    'Where It All Meets',
    'learn',
    'Watch the tracks add up on the mix bus, and leave room for mastering',
    { session: 'pop', start: allFaders(POP, 4), controls: ['*:fader', 'master:fader'], fresh: ['master:fader'] },
    [
      explain(
        'The mix bus',
        'Every channel ends up in the same place: the **mix bus**, where all the tracks are added together into one stereo mix. The **master** fader sets its level.\n\nTracks add up. Eight parts that each sit comfortably below full scale can easily sum to more than it, and then the master **clips**: the peaks are cut off and crackle.\n\nAll the faders here have been pushed up. Press **Play** and watch the master meter and its Clip light.',
        { visual: 'signal-flow' },
      ),
      explore('Too hot', 'Watch the master meter on the right as the loop plays.', [
        task('Press **Play**: the master’s **Clip** light comes on', C.clipped),
        task('Pull the **master** fader down until the peaks stay below −6 dBFS', C.peakBelow(-6)),
      ]),
      explain(
        'Leave some headroom',
        'Whoever masters the song needs room to work: a mix whose peaks already touch full scale has nowhere left to go. So engineers leave **headroom**, the gap between the loudest peak and 0 dBFS. Around 6 dB is a common rule of thumb.\n\nYou can pull every fader down by the same amount (the balance stays the same), or pull the master fader down. Either works here.',
      ),
      mix('Six decibels of headroom', 'Bring the mix down so its peaks stay at least 6 dB below full scale. Keep the balance as it is.', { goals: [{ kind: 'headroom', min: 6 }], answer: { 'master:fader': -10 } }),
    ],
  ),
  lesson(
    'pr8-2',
    'Glue',
    'learn',
    'Bus compression: a gentle squeeze that makes the parts move together',
    { session: 'rock', controls: ['master:comp'], fresh: ['master:comp'] },
    [
      explain(
        'Bus compression',
        'A compressor across the whole mix works differently from one on a single track. Set gently, it turns the loudest moments down by a decibel or two, and the parts start to move together as one band: engineers call it **glue**.\n\nTypical settings:\n- **Ratio** about 2:1\n- **Attack** 30 ms or slower, so the start of each drum hit gets through and the mix keeps its punch\n- **Release** 100–300 ms\n- **Threshold** low enough that the gain reduction reads 1–2 dB on the loudest beats\n\nThe gain reduction shows beside the compressor’s title.',
        { visual: 'compressor', hear: [hear('No bus compression'), hear('Glued', { 'master:compOn': 1, 'master:threshold': -16, 'master:ratio': 2, 'master:attack': 30, 'master:release': 200, 'master:makeup': 1 })] },
      ),
      explore('Squeeze the mix', 'Play the loop and push the bus compressor further than you would on a real mix, to hear what each knob does.', [
        task('Switch the bus **compressor** on', C.on('master:compOn')),
        task('Lower the **threshold** below −12 dB, watching the gain reduction', C.all(C.on('master:compOn'), C.below('master:threshold', -12))),
        task('Raise the **ratio** to 4:1: it holds the mix down harder', C.all(C.on('master:compOn'), C.above('master:ratio', 3.9))),
        task('Try a fast **attack**, under 5 ms: the drums lose their snap. (For glue, set it back to 30 ms or so.)', C.all(C.on('master:compOn'), C.below('master:attack', 5))),
      ]),
      listen(
        'Squeezed or not?',
        'One version runs through a bus compressor working hard, turned back up to the same loudness. Listen to the drums and how the guitars swell between hits.',
        'In which one is the bus compressor working?',
        ['A', 'B'],
        abRounds(4, () => ({ plain: {}, changed: { 'master:compOn': 1, 'master:threshold': -24, 'master:ratio': 4, 'master:attack': 10, 'master:makeup': 3 }, explain: 'The compressed one is denser: the drums push the rest down a little on every hit.' })),
      ),
      mix('Match the squeeze', 'The target squeezes harder than you’d usually glue a mix, so it’s easy to hear. Match how much it holds the mix down.', { target: { 'master:compOn': 1, 'master:threshold': -20, 'master:ratio': 4 } }),
    ],
  ),
  lesson(
    'pr8-3',
    'The Mono Check',
    'learn',
    'Fold the mix to mono and hear what changes',
    { session: 'rock', start: { 'gtrL:pan': -1, 'gtrR:pan': 1, 'hats:pan': -0.3 }, controls: ['*:pan', 'master:mono'], fresh: ['master:mono'] },
    [
      explain(
        'Check in mono',
        'Plenty of people hear music in mono: one phone speaker, a kitchen radio, a smart speaker, a club. The **Mono** button on the master folds left and right together, so you can hear what they will.\n\nIn mono, parts panned wide come out of the middle with everything else, a little quieter against the centre ones (about 3 dB for a part panned hard to one side). Check that nothing important disappears.\n\nIn real recordings there’s more to catch: two mics on one instrument can cancel each other out in mono, and the mono check is how engineers hear it.',
      ),
      explore('Fold it', 'The two guitars are panned hard left and right. Play the loop.', [
        task('Turn **Mono** on', C.on('master:mono')),
        task('With Mono still on, pan **Guitar 1** to the centre: hear it come up against the rest', C.all(C.on('master:mono'), C.between('gtrL:pan', -0.1, 0.1))),
      ]),
      listen('Stereo or mono?', 'Listen for the width of the guitars.', 'Which one is in mono?', ['A', 'B'], monoRounds(4)),
    ],
  ),
  lesson(
    'pr8-4',
    'Use a Reference',
    'quiz',
    'Compare with a finished mix, at the same loudness',
    { session: 'pop', controls: ['*:fader', '*:pan'] },
    [
      explain(
        'Compare with the best',
        'After a few minutes, ears get used to anything. So engineers keep a **reference**: a finished song in the same style that they like, and switch to it often to hear their own mix fresh.\n\nOne trap: **louder sounds better**. A version just 1 or 2 dB louder seems fuller and more exciting, even when nothing else has changed. So compare at the same loudness, or you’ll keep turning things up and calling it better.',
        { hear: [hear('Rough mix'), hear('Rough mix, 2 dB louder', allFaders(POP, -4)), hear('Reference', getSession('pop').reference)] },
      ),
      listen(
        'Louder, or different?',
        'Each time, B is either the same mix turned up, or a different balance.',
        'What changed from A to B?',
        [
          { value: 'level', label: 'Only the volume' },
          { value: 'mix', label: 'The balance' },
        ],
        (rng: () => number) =>
          Array.from({ length: 5 }, () => {
            if (rng() < 0.5) {
              const up = pick(rng, [2, 3]);
              return { mixes: [{}, allFaders(POP, -6 + up)], answer: 'level', explain: `Every fader went up ${up} dB: the same mix, louder.` };
            }
            const [id, d, name] = pick(rng, [
              ['lead', 4, 'lead'],
              ['bass', -5, 'bass'],
              ['hats', 5, 'hi-hats'],
              ['guitar', 5, 'guitar'],
            ] as const);
            return { mixes: [{}, { [`${id}:fader`]: -6 + d }], answer: 'mix', explain: `Only the ${name} moved, ${Math.abs(d)} dB ${d > 0 ? 'up' : 'down'}.` };
          }),
      ),
      mix('Match the reference', 'Switch between Target and Yours, and set the faders and panning to match the reference’s balance.', { target: referenceBalance('pop'), aspects: ['balance', 'pan'] }),
    ],
  ),
  lesson(
    'pr8-c',
    'Checkpoint: The Mix Bus',
    'checkpoint',
    'Leave headroom, hear mono and match a bus compressor',
    { session: 'electronic', start: allFaders(ELECTRONIC, 4), controls: ['*:fader', 'master:fader', 'master:comp', 'master:mono'] },
    [
      listen('Stereo or mono?', '', 'Which one is in mono?', ['A', 'B'], abRounds(3, () => ({ plain: { 'pluck:pan': -0.8, 'hats:pan': 0.6 }, changed: { 'pluck:pan': -0.8, 'hats:pan': 0.6, 'master:mono': 1 } }))),
      mix('Headroom', 'The faders are all pushed up and the master is clipping. Leave at least 6 dB of headroom.', { goals: [{ kind: 'headroom', min: 6 }], answer: { 'master:fader': -11 } }),
      mix('Match the squeeze', 'The faders are back where they started. Now match the target’s bus compression.', { start: allFaders(ELECTRONIC, -6), target: { 'master:compOn': 1, 'master:threshold': -20, 'master:ratio': 4 } }),
    ],
  ),
]);
