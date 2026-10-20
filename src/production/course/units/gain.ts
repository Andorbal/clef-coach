/**
 * Unit 4: gain staging and recording. Decibels full scale and headroom, the trim and the
 * input meter, clipping, the noise floor, and what the mic and the room do to a take.
 *
 * The faulty takes are real recordings of a session's part with a fault baked in
 * (dsp/stems.ts): every take of a part is the same performance, and a clipped take is
 * turned back to the same loudness as a clean one, so only the damage is heard.
 */
import type { Mix } from '../../dsp/params';
import type { ChannelUse } from '../../dsp/stems';
import { C, abRounds, explain, explore, hear, lesson, listen, mix, namedRounds, pick, task, unit } from '../build';

/** Faders for these tracks, all at one level (takes not in a session's rough mix start at 0 dB). */
const level = (ids: string[], db: number): Mix => Object.fromEntries(ids.map(id => [`${id}:fader`, db]));
const muted = (ids: string[], on = 1): Mix => Object.fromEntries(ids.map(id => [`${id}:mute`, on]));
/** Hear one take on its own (unmuted, soloed). */
const soloTake = (id: string): Mix => ({ [`${id}:solo`]: 1, [`${id}:mute`]: 0 });

// ---------------------------------------------------------------------------
// The tracks
// ---------------------------------------------------------------------------

/** pr4-1: Night Drive with the guitar recorded hot and the bass and lead too quiet. */
const STAGE_POP: ChannelUse[] = [{ id: 'kick' }, { id: 'snare' }, { id: 'guitar', fault: { gain: 6 } }, { id: 'bass', fault: { gain: -18 } }, { id: 'lead', fault: { gain: -14 } }];

/** pr4-2: a clean take and a clipped take of four parts. */
const CLIP_PARTS = [
  { part: 'guitar', name: 'Guitar', clean: 'gtr1', hot: 'gtr2' },
  { part: 'snare', name: 'Snare', clean: 'sn2', hot: 'sn1' },
  { part: 'bass', name: 'Bass', clean: 'bs1', hot: 'bs2' },
  { part: 'lead', name: 'Lead', clean: 'ld2', hot: 'ld1' },
];
const CLIP_TAKES: ChannelUse[] = CLIP_PARTS.flatMap(p =>
  [p.clean, p.hot]
    .sort()
    .map(id => ({ id, from: p.part, name: `${p.name} take ${id.slice(-1)}`, short: `${p.name === 'Guitar' ? 'Gtr' : p.name} ${id.slice(-1)}`, fault: id === p.hot ? { clip: p.part === 'snare' ? 10 : 12 } : undefined })),
);
const CLIP_IDS = CLIP_TAKES.map(t => t.id);
const SECOND_TAKES = CLIP_IDS.filter(id => id.endsWith('2'));

/** pr4-3: the violin recorded at a good level, and recorded far too quietly (both with the same preamp hiss). */
const NOISE_TRACKS: ChannelUse[] = [
  { id: 'good', from: 'violin', name: 'Violin, good take', short: 'Good', fault: { hiss: -68 } },
  { id: 'quiet', from: 'violin', name: 'Violin, quiet take', short: 'Quiet', fault: { gain: -22, hiss: -68 } },
  { id: 'guitar' },
  { id: 'bass' },
];

/** pr4-4: Porch Light as it came in: the violin hot, the guitar and the piano far too quiet. */
const STAGE_ACOUSTIC: ChannelUse[] = [{ id: 'shaker' }, { id: 'bass' }, { id: 'guitar', fault: { gain: -16 } }, { id: 'piano', fault: { gain: -14 } }, { id: 'cello' }, { id: 'violin', fault: { gain: 6 } }];
const ACOUSTIC_STAGED: Mix = { 'violin:gain': -8, 'guitar:gain': 12, 'piano:gain': 12 };

/** pr4-5: six takes of the acoustic guitar, each with a different problem (or none). */
const MIC_TAKES: { id: string; answer: string; fault?: ChannelUse['fault']; explain: string }[] = [
  { id: 'tk1', answer: 'boomy', fault: { boom: 10 }, explain: 'Take 1 was recorded with the mic too close: the low end booms.' },
  { id: 'tk2', answer: 'roomy', fault: { room: 0.9 }, explain: 'Take 2 was recorded too far from the mic, in a hard room.' },
  { id: 'tk3', answer: 'clean', explain: 'Take 3 is the good one.' },
  { id: 'tk4', answer: 'rumble', fault: { rumble: -30 }, explain: 'Take 4 has a low rumble under it.' },
  { id: 'tk5', answer: 'hiss', fault: { hiss: -42 }, explain: 'Take 5 has a noisy preamp: hiss.' },
  { id: 'tk6', answer: 'clipped', fault: { clip: 14 }, explain: 'Take 6 was recorded too hot and clipped.' },
];
const MIC_TRACKS: ChannelUse[] = [...MIC_TAKES.map(t => ({ id: t.id, from: 'guitar', name: `Take ${t.id.slice(-1)}`, fault: t.fault })), { id: 'bass' }, { id: 'violin' }];
const TAKE_IDS = MIC_TAKES.map(t => t.id);
const BAD_TAKES = MIC_TAKES.filter(t => t.answer !== 'clean').map(t => t.id);
const WHATS_WRONG = [
  { value: 'clean', label: 'Nothing wrong' },
  { value: 'boomy', label: 'Too close (boomy)' },
  { value: 'roomy', label: 'Too far (roomy)' },
  { value: 'rumble', label: 'Rumble' },
  { value: 'hiss', label: 'Hiss' },
  { value: 'clipped', label: 'Clipped' },
];

/** The checkpoint: Night Drive with four takes of the lead, the kick recorded hot and the piano quiet. */
const LEAD_TAKES = [
  { id: 'ld1', answer: 'clipped', fault: { clip: 12 }, explain: 'Lead take 1 clipped.' },
  { id: 'ld2', answer: 'boomy', fault: { boom: 10 }, explain: 'Lead take 2 was sung too close to the mic.' },
  { id: 'ld3', answer: 'clean', fault: { gain: -16 }, explain: 'Lead take 3 was recorded quietly but cleanly: turned up, it’s the keeper.' },
  { id: 'ld4', answer: 'roomy', fault: { room: 0.9 }, explain: 'Lead take 4 was recorded too far away.' },
];
const CHECK_TRACKS: ChannelUse[] = [{ id: 'kick', fault: { gain: 7 } }, { id: 'snare' }, { id: 'bass' }, { id: 'keys', fault: { gain: -14 } }, ...LEAD_TAKES.map(t => ({ id: t.id, from: 'lead', name: `Lead take ${t.id.slice(-1)}`, short: `Lead ${t.id.slice(-1)}`, fault: t.fault }))];
const LEAD_IDS = LEAD_TAKES.map(t => t.id);

export const GAIN_UNIT = unit('pr-gain', 'Gain Staging and Recording', 'Clean takes', 'Decibels full scale and headroom, the trim and the input meter, clipping, the noise floor, and how the mic and the room shape a take.', [
  lesson(
    'pr4-1',
    'Decibels Full Scale',
    'learn',
    'Read an input meter in dBFS and set a track’s level with the trim',
    { session: 'pop', channels: STAGE_POP, controls: ['*:trim'], fresh: ['*:trim'] },
    [
      explain(
        'The top of the scale',
        'Digital audio measures level against the most it can store: **0 dBFS** (decibels relative to full scale). Every level is below it, so the numbers are negative: −12 dBFS is 12 dB under the top.\n\nThe space between your loudest peak and 0 dBFS is **headroom**. Push past 0 and the peaks are flattened off: **clipping**, a harsh distortion that can’t be undone.',
        { visual: 'gain-staging' },
      ),
      explain(
        'The trim and the input meter',
        'At the top of each strip is the **trim** (also called input gain). It sets the level coming into the channel, before the EQ, the compressor and the fader, and the small meter beside it shows the peaks going in.\n\nWhen you record, the same job is done at the microphone’s preamp, before anything reaches the recorder. Setting a good level at every stage, from the mic to the master, is called **gain staging**.',
      ),
      explore('Set two levels', 'Watch the input meters beside the trims as the loop plays. The guitar came in hot, the bass far too quiet.', [
        task('Press **Play**: the guitar’s input meter peaks near the top', C.playing),
        task('Turn the guitar’s **trim** down until its peaks sit between −18 and −6 dBFS', C.input('guitar', -18, -6)),
        task('Now turn the bass’s **trim** up until its peaks sit between −18 and −6 dBFS', C.input('bass', -18, -6)),
      ]),
      mix('Stage the session', 'Set every track’s trim so its peaks land between −18 and −6 dBFS. Check reads the input meters.', {
        goals: [{ kind: 'input', channels: ['kick', 'snare', 'guitar', 'bass', 'lead'], min: -18, max: -6 }],
        answer: { 'guitar:gain': -8, 'bass:gain': 12, 'lead:gain': 10 },
      }),
    ],
  ),
  lesson(
    'pr4-2',
    'Clipping',
    'learn',
    'Hear what clipping does to a take, and keep the clean ones',
    { session: 'pop', channels: CLIP_TAKES, start: { ...level(CLIP_IDS, -8), ...muted(SECOND_TAKES) }, controls: ['*:mute', '*:solo'] },
    [
      explain(
        'What clipping sounds like',
        'A recorder can’t store anything above 0 dBFS. When a take is recorded too hot, the tops of its loudest peaks are cut flat: **clipping**. A little sounds harsh and crunchy on the peaks; a lot sounds broken.\n\nTurning a clipped take down afterwards doesn’t fix it: the shape of the wave was lost when it was recorded. Every clipped take here has been turned back down to the same loudness as the clean one, so you hear the damage, not the level.',
        { hear: [hear('Guitar, clean', soloTake('gtr1')), hear('Guitar, clipped', soloTake('gtr2')), hear('Snare, clean', soloTake('sn2')), hear('Snare, clipped', soloTake('sn1'))] },
      ),
      listen(
        'Which one is clipped?',
        'Two takes of the same part: one clean, one clipped.',
        'Which take is clipped?',
        ['A', 'B'],
        abRounds(5, rng => {
          const p = pick(rng, CLIP_PARTS);
          return { plain: soloTake(p.clean), changed: soloTake(p.hot), explain: `Listen to the ${p.name.toLowerCase()}’s loudest moments: that’s where clipping bites.` };
        }),
      ),
      explain(
        'Leave headroom',
        'The fix comes before the recording: set the preamp so that even the loudest moment peaks well under 0 dBFS. Players often play louder once the red light is on, so leave room.\n\nRecording at 24 bits, the recorder’s own noise is far below the music, so there’s nothing to gain by recording hot. Peaks somewhere between −18 and −6 dBFS are plenty.',
      ),
      mix('Keep the clean takes', 'Every take is playing. Solo them to listen, then mute the four clipped takes and keep one clean take of each part.', {
        start: muted(SECOND_TAKES, 0),
        target: muted(CLIP_PARTS.map(p => p.hot)),
      }),
    ],
  ),
  lesson(
    'pr4-3',
    'The Noise Floor',
    'learn',
    'Hear why a take recorded too quietly can’t simply be turned up',
    { session: 'acoustic', channels: NOISE_TRACKS, start: { ...level(['good', 'quiet'], -7), 'quiet:mute': 1 }, controls: ['*:trim', '*:mute', '*:solo'] },
    [
      explain(
        'Every recording hisses a little',
        'Microphones, preamps and cables all add a faint noise: the **noise floor**. Record at a good level and the music sits far above it. Record too quietly and you have to turn the take up later, and the noise comes up with it.\n\nThe gap between the music and the noise was set when the take was recorded; no trim can widen it. Here are two takes of the violin through the same noisy preamp, one recorded well, one far too quietly and turned up 20 dB.',
        { hear: [hear('Good take', soloTake('good')), hear('Quiet take, turned up', { ...soloTake('quiet'), 'quiet:gain': 20 })] },
      ),
      listen(
        'Which one hisses?',
        'The same violin part, at the same loudness. Listen in the gaps between the notes.',
        'Which take has more hiss?',
        ['A', 'B'],
        abRounds(3, () => ({ plain: soloTake('good'), changed: { ...soloTake('quiet'), 'quiet:gain': 20 }, explain: 'The quiet take had to be turned up 20 dB, and its hiss came up with it.' })),
      ),
      explore('Bring up the noise', 'Use the quiet take’s strip.', [
        task('Unmute the **quiet** take and solo it', C.all(C.off('quiet:mute'), C.on('quiet:solo'))),
        task('Turn its **trim** up to +20 dB: the music comes back, and so does the hiss', C.above('quiet:gain', 19.5)),
      ]),
    ],
  ),
  lesson(
    'pr4-4',
    'Setting Levels',
    'quiz',
    'Gain-stage a session as it came in, then balance it',
    { session: 'acoustic', channels: STAGE_ACOUSTIC, controls: ['*:trim', '*:fader'] },
    [
      explain(
        'Gain staging carries on',
        'Gain staging carries on through the mix. A track that comes in too hot can overload whatever follows it; one that comes in too quiet leaves you cranking every control after it.\n\nSo set each track’s trim first, until its peaks land between about −18 and −6 dBFS, then make the balance with the faders. *Porch Light* came in with the violin hot and the guitar and the piano far too quiet.',
      ),
      mix('Stage the session', 'Set the trims so that every track peaks between −18 and −6 dBFS going in.', {
        goals: [{ kind: 'input', channels: ['shaker', 'bass', 'guitar', 'piano', 'cello', 'violin'], min: -18, max: -6 }],
        answer: ACOUSTIC_STAGED,
      }),
      mix('Then the balance', 'The levels going in are good now. Make the target’s balance with the faders.', {
        start: ACOUSTIC_STAGED,
        target: { 'shaker:fader': -18, 'bass:fader': -7, 'guitar:fader': -9, 'piano:fader': -15, 'cello:fader': -14, 'violin:fader': -7 },
      }),
    ],
  ),
  lesson(
    'pr4-5',
    'Mics and Rooms',
    'learn',
    'Hear how the mic and the room shape a take, and pick the keeper',
    { session: 'acoustic', channels: MIC_TRACKS, start: { ...level(TAKE_IDS, -8), ...muted(BAD_TAKES) }, controls: ['*:mute', '*:solo'] },
    [
      explain(
        'Where the mic goes',
        'Where you put the microphone changes a recording more than any plug-in can afterwards.\n\n- **Too close**: most mics that pick up from the front (cardioids) boost the bass when the source is very near, the **proximity effect**. A little warms a voice; too much booms.\n- **Too far**: in a hard-walled room the mic hears the walls nearly as loud as the instrument, and the take sounds distant and boxy. Reverb can be added later, never taken away.\n- **Rumble**: traffic, air conditioning, a foot tapping the mic stand. Small speakers can’t play it, so it’s easy to miss.\n\nHeadphones help with this lesson.',
        { hear: [hear('Close and clean', soloTake('tk3')), hear('Too close', soloTake('tk1')), hear('Too far', soloTake('tk2')), hear('Rumble', soloTake('tk4'))] },
      ),
      listen('What’s wrong with this take?', 'Six takes of the acoustic guitar, each on its own. One is good; the others each have a problem.', 'What’s wrong with it?', WHATS_WRONG, namedRounds(6, MIC_TAKES.map(t => ({ answer: t.answer, mix: soloTake(t.id), explain: t.explain })))),
      explore(
        'Take out the rumble',
        'Rumble sits below the music, so a **high-pass** filter (a filter that lets the highs pass and stops the lows) can take it out. You’ll meet it properly in the EQ unit.',
        [
          task('Solo **Take 4** and unmute it: hear the rumble under it', C.all(C.on('tk4:solo'), C.off('tk4:mute'))),
          task('Switch on its **high-pass**', C.on('tk4:hpOn')),
          task('Set the high-pass to around 100 Hz (90 to 150 Hz): the rumble goes, the guitar stays', C.all(C.on('tk4:hpOn'), C.between('tk4:hpFreq', 90, 150))),
        ],
        { controls: ['tk4:hp', '*:mute', '*:solo'] },
      ),
      mix('Pick the keeper', 'All six takes are playing at once. Solo each to listen, then mute every take but the best one.', { start: muted(TAKE_IDS, 0), target: muted(BAD_TAKES) }),
    ],
  ),
  lesson(
    'pr4-c',
    'Checkpoint: Gain Staging and Recording',
    'checkpoint',
    'Tell what’s wrong with a take, stage a session’s levels and keep the best take',
    { session: 'pop', channels: CHECK_TRACKS, start: { ...level(LEAD_IDS, -6), ...muted(['ld2', 'ld3', 'ld4']), 'ld3:gain': 16 }, controls: ['*:trim', '*:mute', '*:solo'] },
    [
      listen('What’s wrong with this take?', 'Four takes of the lead, each on its own.', 'What’s wrong with it?', WHATS_WRONG.filter(o => ['clean', 'boomy', 'roomy', 'clipped'].includes(o.value)), namedRounds(4, LEAD_TAKES.map(t => ({ answer: t.answer, mix: soloTake(t.id), explain: t.explain })))),
      mix('Stage the levels', 'The kick came in hot and the piano and lead take 3 too quietly. Set the trims so the kick, snare, bass, piano and lead take 3 all peak between −18 and −6 dBFS.', {
        start: { 'ld3:gain': 0 },
        goals: [{ kind: 'input', channels: ['kick', 'snare', 'bass', 'keys', 'ld3'], min: -18, max: -6 }],
        answer: { 'kick:gain': -8, 'keys:gain': 10, 'ld3:gain': 12 },
      }),
      mix('Keep the best take', 'All four lead takes are playing. Mute the three with problems.', { start: muted(LEAD_IDS, 0), target: muted(['ld1', 'ld2', 'ld4']) }),
    ],
  ),
]);
