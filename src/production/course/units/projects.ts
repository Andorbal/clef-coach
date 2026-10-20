/**
 * Unit 10: mix projects. Each session from its rough mix towards its reference, the way an
 * engineer works: balance and panning first, then clean-up and shaping (high-pass, EQ,
 * compression), then space, then the master. Each stage starts from the reference's
 * version of the stages before, so one slip doesn't carry through the whole mix, and each
 * is judged only on what it's about: many controls at once would let small near misses
 * add up into a fail.
 */
import type { Mix } from '../../dsp/params';
import { getSession } from '../../dsp/sessions';
import { C, explain, explore, hear, lesson, mix, task, unit } from '../build';
import type { ExploreStep, MixStep, Task } from '../types';

const SHAPE = /:(hpOn|hpFreq|eqOn|lowFreq|lowGain|midFreq|midGain|midQ|presFreq|presGain|presQ|highFreq|highGain|compOn|threshold|ratio|attack|release|makeup)$/;

/** A session's reference mix, split into the stages of a mix. */
function stages(session: string) {
  const ref = getSession(session).reference;
  const part = (keep: (k: string) => boolean): Mix => Object.fromEntries(Object.entries(ref).filter(([k]) => keep(k)));
  const channel = (k: string) => !k.startsWith('master:') && !k.startsWith('fx:');
  return {
    balance: part(k => channel(k) && /:(fader|pan)$/.test(k)),
    shape: part(k => channel(k) && SHAPE.test(k)),
    space: part(k => k.startsWith('fx:') || /:(reverb|delay)$/.test(k)),
    master: part(k => k.startsWith('master:')),
    all: ref,
  };
}

const ALL_CONTROLS = ['*:fader', '*:pan', '*:hp', '*:eq', '*:comp', '*:reverb', '*:delay', 'fx:reverb', 'fx:delay', 'master:comp', 'master:limiter'];

/**
 * The four stages, each a quiz, each starting where the reference's previous stages leave
 * off. `shapeTasks` makes the clean-up stage a set of tasks instead: on a session whose
 * reference only touches its tone lightly (Porch Light), the judge can't hear the
 * difference between before and after (the rough mix already scored 0.81), and a quiz
 * that passes untouched teaches nothing.
 */
function stageSteps(session: string, words: { balance: string; shape: string; space: string; master: string }, shapeTasks?: Task[]): (MixStep | ExploreStep)[] {
  const s = stages(session);
  return [
    mix('Balance and panning', words.balance, { controls: ['*:fader', '*:pan'], target: s.balance, aspects: ['balance', 'pan'] }),
    shapeTasks
      ? explore('Clean up and shape', `The balance is now the reference’s. ${words.shape}`, shapeTasks, { start: s.balance, controls: ['*:hp', '*:eq', '*:comp'] })
      : mix('Clean up and shape', `The balance is now the reference’s. ${words.shape}`, { start: s.balance, controls: ['*:hp', '*:eq', '*:comp'], target: s.shape, aspects: ['tone', 'dynamics'] }),
    mix('Space', `Balance and tone are set. ${words.space}`, { start: { ...s.balance, ...s.shape }, controls: ['*:reverb', '*:delay', 'fx:reverb', 'fx:delay'], target: s.space, aspects: ['space'] }),
    mix('Master it', `The mix is done. ${words.master}`, { start: { ...s.balance, ...s.shape, ...s.space }, controls: ['master:comp', 'master:limiter'], target: s.master, aspects: ['master'] }),
  ];
}

const plan = (title: string, session: string, body: string) => explain(title, body, { hear: [hear('Rough mix'), hear('Reference', stages(session).all)] });

export const PROJECTS_UNIT = unit('pr-projects', 'Mix Projects', 'Whole mixes', 'Four sessions from the rough mix to finished: balance and panning, clean-up and shaping, space, and the master, one stage at a time.', [
  lesson(
    'pr10-1',
    'Night Drive',
    'project',
    'Mix a pop song from rough to finished',
    { session: 'pop', controls: ALL_CONTROLS },
    [
      plan(
        'From rough to finished',
        'pop',
        'A whole mix, in the order most engineers work:\n\n- **Balance and panning**: the levels, and where everything sits\n- **Clean up and shape**: high-pass what doesn’t need its lows, EQ, compression\n- **Space**: reverb and delay\n- **The master**: bus compression and the limiter\n\nEach stage is a quiz against the reference: hear the rough mix and the reference first.',
      ),
      ...stageSteps('pop', {
        balance: 'The kick, bass and lead carry the song, with the snare just behind. The piano and guitar sit lower, on opposite sides (piano left, guitar right); the pad is a quiet bed, the hi-hats low and a little right.',
        shape: 'High-pass the snare, hats, piano, guitar, pad and lead. Give the kick some low end and click, scoop the piano’s low mids, add presence to the lead, and compress the bass and lead to hold them steady.',
        space: 'Send the lead, pad, piano, guitar and snare to the reverb (the pad the most), and give the lead a quiet 1/8 dotted delay. Keep the kick and bass dry.',
        master: 'A gentle bus compressor at 2:1, then the limiter pushed a few decibels with its ceiling at −1 dB.',
      }),
    ],
  ),
  lesson(
    'pr10-2',
    'Porch Light',
    'project',
    'Mix an acoustic song from rough to finished',
    { session: 'acoustic', controls: ALL_CONTROLS },
    [
      plan('An acoustic mix', 'acoustic', 'Acoustic mixes are mostly about balance and space: the instruments already sound like themselves. The violin carries the tune; everything else frames it.'),
      ...stageSteps('acoustic', {
        balance: 'The violin leads, the bass and guitar support it, and the piano and cello sit further back. The shaker is quiet and to the right; the guitar a little left, the piano and cello a little right.',
        shape: 'High-pass the shaker, guitar and violin, take some boxiness out of the guitar around 250 Hz, and compress the bass.',
        space: 'A medium room with a little pre-delay. The violin, piano and cello get the most reverb; the guitar a touch; the bass stays dry.',
        master: 'Just the limiter, pushed gently: this song is better with its dynamics.',
      }, [
        task('High-pass the **shaker** at 300 Hz or higher: it has nothing down there', C.all(C.on('shaker:hpOn'), C.above('shaker:hpFreq', 300))),
        task('High-pass the **guitar** at about 110 Hz, and cut its **mid** band a few dB around 250 Hz', C.all(C.on('guitar:hpOn'), C.above('guitar:hpFreq', 90), C.below('guitar:midGain', -1.5), C.between('guitar:midFreq', 180, 350))),
        task('High-pass the **violin** at about 200 Hz', C.all(C.on('violin:hpOn'), C.above('violin:hpFreq', 150))),
        task('Switch on the **bass**’s compressor and bring its threshold below −12 dB', C.all(C.on('bass:compOn'), C.below('bass:threshold', -12))),
      ]),
    ],
  ),
  lesson(
    'pr10-3',
    'Fuzz Garden',
    'project',
    'Mix a rock song from rough to finished',
    { session: 'rock', controls: ALL_CONTROLS },
    [
      plan('A rock mix', 'rock', 'Two takes of the same guitar part, panned hard left and right, make the wall of sound most rock mixes are built on. The drums punch through the middle; the lead sits on top.'),
      ...stageSteps('rock', {
        balance: 'Kick and snare up front, the bass just under them, the two guitars hard left and right, the lead on top, and the hi-hats low and a little left.',
        shape: 'Give the kick low end and click, compress the snare and bass, high-pass the hats, guitars and lead, and take a little out of the guitars around 400 Hz.',
        space: 'A small room for the snare and lead, and a short 1/16 dotted delay on the lead.',
        master: 'Bus compression at 2:1 with a slow attack, then the limiter pushed a little harder than for the pop song.',
      }),
    ],
  ),
  lesson(
    'pr10-c',
    'Final Mix: Neon Rain',
    'checkpoint',
    'Mix an electronic track from rough to finished, on your own',
    { session: 'electronic', controls: ALL_CONTROLS },
    [
      plan('The final mix', 'electronic', 'Everything you’ve learned, on a track made of synths and a drum machine. Electronic mixes lean on the kick and sub bass, and on big, wet spaces for everything above them.'),
      ...stageSteps('electronic', {
        balance: 'Kick first, then the sub bass and clap. The lead sits under them; the pluck lower and a little left, the hi-hats low and a little right, the pad a quiet bed.',
        shape: 'High-pass everything above the bass (hats, pluck, pad, lead) and compress the sub bass.',
        space: 'A big room with some pre-delay: lots on the pad, some on the clap and lead. 1/8 dotted echoes on the pluck, the lead and, quietly, the hats. Kick and sub stay dry.',
        master: 'Bus compression at 2:1, then the limiter pushed the hardest of the four songs.',
      }),
    ],
  ),
]);
