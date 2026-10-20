/**
 * Unit 9: mastering and loudness. The limiter (gain into it, and its ceiling), loudness in
 * LUFS and the targets streaming and broadcast use, and why a master pushed too hard sounds
 * smaller, not bigger.
 *
 * The loudness answers were measured on each session (the course test checks them): the
 * limiter's gain needed for −14 LUFS differs from song to song.
 */
import { C, abRounds, explain, explore, hear, lesson, listen, mix, task, unit } from '../build';

const LIMIT = { 'master:limitOn': 1, 'master:ceiling': -1 };

/**
 * A or B: which master is limited harder? The squashed one is turned down after the
 * limiter to the same loudness, so the ear hears its shape, not its level.
 */
const squashRounds = (count: number, gentle: number, hard: number, matchDb: number) =>
  abRounds(count, () => ({ plain: { ...LIMIT, 'master:drive': gentle }, changed: { ...LIMIT, 'master:drive': hard, 'master:fader': matchDb }, explain: 'The harder-limited one has flatter, softer drum hits: its peaks have been shaved off.' }));

export const MASTER_UNIT = unit('pr-master', 'Mastering and Loudness', 'The final polish', 'The limiter, loudness in LUFS, the targets for streaming and broadcast, and why louder isn’t better.', [
  lesson(
    'pr9-1',
    'The Limiter',
    'learn',
    'Push a mix into a limiter and keep its peaks under a ceiling',
    { session: 'pop', controls: ['master:limiter'], fresh: ['master:limiter'] },
    [
      explain(
        'A ceiling the peaks can’t pass',
        'The last thing on the master is usually a **limiter**: a very fast, very firm compressor. Nothing gets past its **ceiling**.\n\nThe **gain** knob pushes the mix into it. The loudest peaks are turned down in a fraction of a millisecond (it looks a moment ahead, so it’s ready for them), which lets the rest of the mix come up. That’s how a master gets loud without clipping.\n\nA ceiling of −1 dB is usual: a little room below full scale, because a peak can overshoot once the file is converted for streaming.',
        { hear: [hear('No limiter'), hear('Limited', { ...LIMIT, 'master:drive': 7 })] },
      ),
      explore('Push it', 'Play the loop and watch the master meter and the limiter’s gain reduction.', [
        task('Switch the **limiter** on', C.on('master:limitOn')),
        task('Turn its **gain** up past 6 dB: the mix gets louder', C.all(C.on('master:limitOn'), C.above('master:drive', 6))),
        task('Play it, and watch the peaks stop at the **ceiling**', C.all(C.on('master:limitOn'), C.above('master:drive', 6), C.peakBelow(-0.9))),
      ]),
      listen('Which is limited harder?', 'Both versions are just as loud. One reached that loudness by limiting much harder, then was turned down.', 'Which one is limited harder?', ['A', 'B'], squashRounds(4, 3, 14, -9)),
      mix('Match the master', 'Switch between Target and Yours: how hard is the target pushed into the limiter?', { target: { 'master:limitOn': 1, 'master:drive': 8 } }),
    ],
  ),
  lesson(
    'pr9-2',
    'Loudness and LUFS',
    'learn',
    'Read a loudness meter and master to −14 LUFS',
    { session: 'pop', controls: ['master:limiter'] },
    [
      explain(
        'How loud is loud?',
        'Peaks don’t tell you how loud a song *sounds*: a short spike can hit full scale in a quiet song. A **loudness meter** measures what ears hear, weighting the frequencies we’re most sensitive to and averaging over time. Its unit is **LUFS** (loudness units relative to full scale); the number by Play is the loudness of the last 3 seconds.\n\nStreaming services turn every song to about the same loudness, so listeners don’t reach for the volume between tracks:\n\n- Spotify, YouTube and Tidal: about **−14 LUFS**\n- Apple Music: about **−16 LUFS**\n- Broadcast TV and radio in Europe (EBU R128): **−23 LUFS**\n\nA master louder than the target is simply turned down.',
        { visual: 'loudness' },
      ),
      explore('Read the meter', 'Play the loop and watch the loudness by the Play button.', [
        task('Press **Play** and read the loudness: the rough mix is around −21 LUFS', C.playing),
        task('Switch the limiter on and use its **gain** to bring the loudness to between −15 and −13 LUFS', C.all(C.on('master:limitOn'), C.loudness(-15, -13))),
        task('…with the peaks at −1 dB or below', C.all(C.on('master:limitOn'), C.loudness(-15, -13), C.peakBelow(-0.9))),
      ]),
      mix('Master for streaming', 'Master this mix for Spotify and YouTube: about −14 LUFS, with no peak above −1 dB. Check measures the whole loop.', { goals: [{ kind: 'loudness', target: -14 }, { kind: 'peak', max: -1 }], answer: { 'master:limitOn': 1, 'master:drive': 7 } }),
    ],
  ),
  lesson(
    'pr9-3',
    'Targets for Every Place',
    'quiz',
    'Master one song for streaming and for broadcast',
    { session: 'acoustic', controls: ['master:limiter', 'master:fader'] },
    [
      explain(
        'Different places, different numbers',
        'The same song can need different masters. Apple Music plays at about −16 LUFS; a European radio programme at −23.\n\nGetting quieter is easy: turn the master fader down. Getting louder means the limiter, so the peaks stay under the ceiling. Quiet, acoustic music also often sounds best mastered a little below the loudest pop: its dynamics are part of it.',
      ),
      mix('Master for Apple Music', 'Bring Porch Light to about −16 LUFS, peaks at −1 dB or below.', { goals: [{ kind: 'loudness', target: -16 }, { kind: 'peak', max: -1 }], answer: { 'master:limitOn': 1, 'master:drive': 7.6 } }),
      mix('Master for broadcast', 'Now the same song for radio: −23 LUFS, peaks at −1 dB or below. This master starts out loud.', { start: { 'master:limitOn': 1, 'master:drive': 8 }, goals: [{ kind: 'loudness', target: -23 }, { kind: 'peak', max: -1 }], answer: { 'master:drive': 0.5 } }),
    ],
  ),
  lesson(
    'pr9-4',
    'The Loudness War',
    'learn',
    'Hear what pushing a master too hard costs',
    { session: 'electronic', controls: ['master:limiter', 'master:fader'] },
    [
      explain(
        'Louder isn’t better',
        'For years, records were mastered louder and louder, each trying to jump out of the radio: the **loudness war**. The harder a limiter is pushed, the more it shaves off every peak. The drums lose their punch, everything flattens out, and long listening gets tiring.\n\nNow that streaming turns every song to the same loudness, a squashed master doesn’t even come out louder: it just sounds smaller than one with its dynamics left in.',
        { hear: [hear('Gentle master', { ...LIMIT, 'master:drive': 5 }), hear('Squashed, at the same loudness', { ...LIMIT, 'master:drive': 14, 'master:fader': -6 })] },
      ),
      listen('Which has more punch?', 'Both are equally loud. Listen to the kick and the clap.', 'Which one is limited harder?', ['A', 'B'], squashRounds(4, 5, 14, -6)),
      mix('Back off the limiter', 'This master was pushed far too hard. Back it off to about −14 LUFS, peaks at −1 dB or below.', { start: { ...LIMIT, 'master:drive': 16 }, goals: [{ kind: 'loudness', target: -14 }, { kind: 'peak', max: -1 }], answer: { 'master:drive': 6.5 } }),
    ],
  ),
  lesson(
    'pr9-c',
    'Checkpoint: Mastering',
    'checkpoint',
    'Hear a squashed master, hit a loudness target and match a master',
    { session: 'rock', controls: ['master:limiter', 'master:fader'] },
    [
      listen('Which is limited harder?', '', 'Which one is limited harder?', ['A', 'B'], squashRounds(3, 2, 12, -7)),
      mix('Master for streaming', 'This master is pushed far too hard. Bring it to about −14 LUFS, peaks at −1 dB or below.', { start: { ...LIMIT, 'master:drive': 12 }, goals: [{ kind: 'loudness', target: -14 }, { kind: 'peak', max: -1 }], answer: { 'master:drive': 1.8 } }),
      mix('Match the master', 'Switch between Target and Yours, and match how hard the target is limited.', { target: { 'master:limitOn': 1, 'master:drive': 4 } }),
    ],
  ),
]);
