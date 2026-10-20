/**
 * Unit 7: reverb and delay. Sends and returns, the room's size, pre-delay and tone, depth
 * (near and far), keeping the low end dry, and echoes in time with the song.
 */
import { C, abRounds, explain, explore, hear, lesson, listen, mix, namedRounds, pick, task, unit } from '../build';

const NAMES: Record<string, string> = { lead: 'lead', snare: 'snare', keys: 'piano', guitar: 'guitar', clap: 'clap', pluck: 'pluck', violin: 'violin', piano: 'piano' };

/** Which one has more reverb? The same part sent hard or barely. */
const wetterRounds = (count: number, ids: string[]) =>
  abRounds(count, (rng: () => number) => {
    const id = pick(rng, ids);
    return { plain: { [`${id}:reverb`]: -26 }, changed: { [`${id}:reverb`]: -8 }, explain: `The wetter one sent the ${NAMES[id]} into the reverb about 18 dB harder.` };
  });

/** Which room is bigger? Both send to the reverb; only its size changes. */
const roomRounds = (count: number, sends: Record<string, number>) =>
  abRounds(count, () => ({ plain: { ...sends, 'fx:reverbSize': 0.2 }, changed: { ...sends, 'fx:reverbSize': 0.85 }, explain: 'The bigger room has the longer tail: listen to the end of each note.' }));

const BEAT_OPTIONS = [
  { value: '1', label: '1/4 (a beat)' },
  { value: '0.5', label: '1/8 (half a beat)' },
  { value: '0.25', label: '1/16 (a quarter beat)' },
];

export const SPACE_UNIT = unit('pr-space', 'Reverb and Delay', 'Space and depth', 'Sends and returns, the size and tone of a room, near and far, a dry low end, and echoes in time with the song.', [
  lesson(
    'pr7-1',
    'Sends and Returns',
    'learn',
    'Send tracks to a shared reverb and set how much comes back',
    { session: 'pop', controls: ['*:reverb', 'fx:reverbLevel'], fresh: ['*:reverb', 'fx:reverbLevel'] },
    [
      explain(
        'One room for everyone',
        'Reverb is the sound of a room: the reflections that keep ringing after a note. In a mix you don’t usually put a reverb on every track. There’s one reverb on an **effects return**, and each channel has a **send** knob that feeds it some of that track.\n\nThe sends here are **post-fader**: they take the signal after the channel’s fader, so turning a track down turns its reverb down with it.\n\nThe **return** sets how much of the reverb comes back into the mix, for every track at once.',
        { visual: 'signal-flow', hear: [hear('Dry'), hear('With reverb', { 'lead:reverb': -8, 'snare:reverb': -12, 'keys:reverb': -12 })] },
      ),
      explore('Send some', 'Each strip now has a **Reverb** send. Play the loop and turn a few up.', [
        task('Press **Play**', C.playing),
        task('Turn the **lead**’s reverb send up past −15 dB', C.above('lead:reverb', -15)),
        task('Send the **snare** too, past −20 dB', C.above('snare:reverb', -20)),
        task('Now pull the reverb **return** below −10 dB: all the reverb drops together', C.below('fx:reverbLevel', -10)),
      ]),
      listen('Which is wetter?', 'In each round one part is sent hard into the reverb in one version and only a little in the other.', 'Which one has more reverb?', ['A', 'B'], wetterRounds(5, ['lead', 'snare', 'keys', 'guitar'])),
      mix('Put the lead in a room', 'Give the lead a clear reverb and the snare a little less. Switch between Target and Yours while the loop plays.', { target: { 'lead:reverb': -8, 'snare:reverb': -14 } }),
    ],
  ),
  lesson(
    'pr7-2',
    'Size, Pre-delay and Tone',
    'learn',
    'Shape the room: how big, how soon, how bright',
    { session: 'pop', start: { 'lead:reverb': -8, 'snare:reverb': -12 }, controls: ['lead:reverb', 'snare:reverb', 'fx:reverb'], fresh: ['fx:reverbSize', 'fx:reverbPredelay', 'fx:reverbTone'] },
    [
      explain(
        'Shaping the room',
        'Three knobs on the reverb return shape the room itself:\n\n- **Size**: how big the room is, and so how long its tail rings. Small rooms are tight and close; halls go on and on.\n- **Pre-delay**: a short gap before the reverb starts. 50–100 ms lets a singer’s words come through clearly in front of a big reverb.\n- **Tone**: how bright the tail is. Real rooms soak up high frequencies, so a darker reverb sits further back and gets in the way less.',
        { visual: 'reverb', hear: [hear('Small room', { 'fx:reverbSize': 0.15 }), hear('Big hall', { 'fx:reverbSize': 0.9 })] },
      ),
      explore('Change the room', 'Play the loop and listen to the end of each lead note as you turn.', [
        task('Make the room a hall: **Size** above 80%', C.above('fx:reverbSize', 0.8)),
        task('Give it some **pre-delay**: more than 70 ms', C.above('fx:reverbPredelay', 70)),
        task('Darken the tail: **Tone** below 30%', C.below('fx:reverbTone', 0.3)),
      ]),
      listen('Which room is bigger?', 'The same tracks go into the reverb in both. Only the room changes.', 'Which one is the bigger room?', ['A', 'B'], roomRounds(4, {})),
      mix('Match the room', 'The target uses a bigger room with a later start. Find it by ear.', { target: { 'fx:reverbSize': 0.85, 'fx:reverbPredelay': 70 } }),
    ],
  ),
  lesson(
    'pr7-3',
    'Near and Far',
    'learn',
    'Place parts front to back with level and reverb',
    { session: 'acoustic', controls: ['*:fader', '*:reverb'] },
    [
      explain(
        'Front to back',
        'Panning places a part from left to right. **Level and reverb** place it from front to back.\n\nA sound close to you is loud, clear and fairly dry. One across the room is quieter and softer, with more of the room in it. So to push a part back, turn it down a little and send it to the reverb; to bring one forward, turn it up and keep it drier.\n\nThis gives a mix **depth**: the lead in front, the accompaniment behind it.',
        { hear: [hear('Flat'), hear('With depth', { 'violin:fader': -5, 'violin:reverb': -16, 'cello:fader': -12, 'cello:reverb': -6, 'piano:fader': -14, 'piano:reverb': -6 })] },
      ),
      explore('Push one back', 'Play the loop and move the piano to the back of the room.', [
        task('Turn the **piano** fader below −10 dB', C.below('piano:fader', -10)),
        task('…and send the piano to the reverb, past −10 dB', C.all(C.below('piano:fader', -10), C.above('piano:reverb', -10))),
        task('Bring the **violin** forward: fader above −5 dB', C.above('violin:fader', -5)),
      ]),
      mix('Set the stage', 'The violin plays the tune, close and fairly dry. The cello and piano sit behind it, quieter and wetter.', { target: { 'violin:fader': -4, 'violin:reverb': -16, 'cello:fader': -12, 'cello:reverb': -8, 'piano:fader': -14, 'piano:reverb': -6 } }),
    ],
  ),
  lesson(
    'pr7-4',
    'Keep the Low End Dry',
    'quiz',
    'Hear why the kick and bass usually skip the reverb',
    { session: 'pop', start: { 'kick:reverb': -6, 'bass:reverb': -6, 'lead:reverb': -10, 'snare:reverb': -12 }, controls: ['*:reverb'] },
    [
      explain(
        'Mud in the room',
        'Low notes ring for a long time in a reverb. Send the kick and bass into one and their tails pile up into a boomy wash that blurs the beat.\n\nSo most engineers keep the kick and bass dry, or very nearly, and let the snare, the lead and the instruments above them carry the sense of space.',
        { hear: [hear('Wet kick and bass'), hear('Dry low end', { 'kick:reverb': -60, 'bass:reverb': -60 })] },
      ),
      listen('Which one is drier?', 'One version keeps the kick and bass out of the reverb.', 'Which one has the dry kick and bass?', ['A', 'B'], abRounds(4, () => ({ plain: {}, changed: { 'kick:reverb': -60, 'bass:reverb': -60 }, explain: 'Listen under the snare’s reverb: the wet version has a low rumble hanging on after each kick.' }))),
      mix('Dry the low end', 'Turn the kick’s and the bass’s reverb sends right down. Leave the lead and snare as they are.', { target: { 'kick:reverb': -60, 'bass:reverb': -60 } }),
    ],
  ),
  lesson(
    'pr7-5',
    'Delay in Time',
    'learn',
    'Echoes that land on the beat: time, feedback and tone',
    { session: 'pop', controls: ['lead:delay', 'guitar:delay', 'fx:delay'], fresh: ['lead:delay', 'guitar:delay', 'fx:delay'] },
    [
      explain(
        'Echoes on the beat',
        'A **delay** plays a sound back a moment later, like an echo off a far wall. Set in beats, the echoes land in time with the song, whatever its tempo.\n\nThe **Time** knob reads in note lengths: **1/4** is one beat, **1/8** half a beat, and **1/8 dotted** three quarters of a beat, a favourite because its echoes fall between the notes. **Feedback** sets how many times it repeats; **Tone** makes each repeat darker. This delay is a ping-pong: the echoes bounce left and right.',
        { hear: [hear('No delay'), hear('1/8 dotted echoes', { 'lead:delay': -8, 'fx:delayBeats': 0.75 })] },
      ),
      explore('Make some echoes', 'Play the loop and send the lead into the delay.', [
        task('Turn the **lead**’s delay send past −12 dB', C.above('lead:delay', -12)),
        task('Set the **Time** to 1/8 dotted', C.between('fx:delayBeats', 0.74, 0.76)),
        task('Raise the **Feedback** above 60% for a long trail of repeats', C.above('fx:delayFeedback', 0.6)),
        task('Turn the **Tone** below 30%: each repeat gets darker and steps back', C.below('fx:delayTone', 0.3)),
      ]),
      listen(
        'How long is the echo?',
        'The lead goes into the delay in each round. Listen to the gap between a note and its echo.',
        'What’s the delay time?',
        BEAT_OPTIONS,
        namedRounds(
          4,
          BEAT_OPTIONS.map(o => ({ answer: o.value, mix: { 'lead:delay': -6, 'fx:delayBeats': Number(o.value), 'fx:delayFeedback': 0.3 } })),
        ),
      ),
      listen(
        'Few or many?',
        'Now the time stays the same and the feedback changes.',
        'How many times does it repeat?',
        [
          { value: 'few', label: 'Once or twice' },
          { value: 'many', label: 'Many times' },
        ],
        namedRounds(4, [
          { answer: 'few', mix: { 'lead:delay': -6, 'fx:delayFeedback': 0.1 } },
          { answer: 'many', mix: { 'lead:delay': -6, 'fx:delayFeedback': 0.75 } },
        ]),
      ),
      mix('Dotted echoes', 'The target sends the lead into a 1/8 dotted delay with a few repeats. Match it.', { target: { 'lead:delay': -10, 'fx:delayBeats': 0.75, 'fx:delayFeedback': 0.5 } }),
    ],
  ),
  lesson(
    'pr7-c',
    'Checkpoint: Reverb and Delay',
    'checkpoint',
    'Hear reverb, rooms and echoes, and give a mix its space',
    { session: 'electronic', controls: ['*:reverb', '*:delay', 'fx:reverb', 'fx:delay'] },
    [
      listen('Which is wetter?', '', 'Which one has more reverb?', ['A', 'B'], wetterRounds(4, ['lead', 'clap', 'pluck'])),
      listen('Which room is bigger?', '', 'Which one is the bigger room?', ['A', 'B'], roomRounds(3, { 'clap:reverb': -10, 'lead:reverb': -10 })),
      mix('Space for the lead', 'Put the clap and the lead in a big room, and give the lead 1/8 dotted echoes. Keep the kick and the sub bass dry.', { target: { 'lead:reverb': -10, 'clap:reverb': -12, 'fx:reverbSize': 0.75, 'lead:delay': -12, 'fx:delayBeats': 0.75 } }),
    ],
  ),
]);
