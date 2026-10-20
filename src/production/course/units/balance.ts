/**
 * Unit 2: balance. Building a mix from silence around its most important part, hearing
 * which part sticks out, the lead on top, and checking the balance at a low volume. On
 * all four sessions, so the ear learns balance rather than one song.
 */
import { type Mix, SILENT_DB } from '../../dsp/params';
import { C, explain, explore, hear, lesson, listen, mix, namedRounds, task, unit } from '../build';

/** A balance for each session, set by ear: where these lessons' answers sit. */
const POP: Record<string, number> = { kick: -6, snare: -8, hats: -16, bass: -7, keys: -14, guitar: -14, pad: -20, lead: -5 };
const ACOUSTIC: Record<string, number> = { shaker: -18, bass: -7, guitar: -9, piano: -15, cello: -14, violin: -7 };
const ELECTRONIC: Record<string, number> = { kick: -5, clap: -9, hats: -15, sub: -8, pluck: -14, pad: -19, lead: -10 };
const ROCK: Record<string, number> = { kick: -6, snare: -8, hats: -16, bass: -9, gtrL: -13, gtrR: -13, lead: -9 };

const NAMES: Record<string, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hats: 'Hi-hats',
  bass: 'Bass',
  keys: 'Piano',
  guitar: 'Guitar',
  pad: 'Pad',
  lead: 'Lead',
  shaker: 'Shaker',
  piano: 'Piano',
  cello: 'Cello',
  violin: 'Violin',
  clap: 'Clap',
  sub: 'Sub bass',
  pluck: 'Pluck',
  guitars: 'Guitars',
};

/** Fader settings for a balance, with some parts moved (dB). */
const faders = (b: Record<string, number>, moved: Record<string, number> = {}): Mix => Object.fromEntries(Object.entries({ ...b, ...moved }).map(([id, v]) => [`${id}:fader`, v]));

/** Every fader of a balance all the way down. */
const silence = (b: Record<string, number>): Mix => Object.fromEntries(Object.keys(b).map(id => [`${id}:fader`, SILENT_DB]));

/** One part 6 dB up in each round: which one? Groups (two guitars) move together. */
function tooLoud(b: Record<string, number>, parts: Record<string, string[]> = Object.fromEntries(Object.keys(b).map(id => [id, [id]]))) {
  return (count: number) => namedRounds(count, Object.entries(parts).map(([answer, ids]) => ({ answer, mix: faders({}, Object.fromEntries(ids.map(id => [id, b[id] + 6]))), explain: `The ${NAMES[answer].toLowerCase()} ${answer === 'guitars' ? 'were' : 'was'} 6 dB up.` })));
}

const options = (ids: string[]) => ids.map(id => ({ value: id, label: NAMES[id] }));

const ROCK_PARTS = { kick: ['kick'], snare: ['snare'], hats: ['hats'], bass: ['bass'], guitars: ['gtrL', 'gtrR'], lead: ['lead'] };

export const BALANCE_UNIT = unit('pr-balance', 'Balance', 'Levels', 'Building a mix from silence around its most important part, hearing what sticks out, the lead on top, and checking it quietly.', [
  lesson(
    'pr2-1',
    'Start From Silence',
    'learn',
    'Build a balance from all the faders down, the most important part first',
    { session: 'pop', start: silence(POP), controls: ['*:fader', '*:mute'] },
    [
      explain(
        'Build it up from nothing',
        'A good way to start a mix is with every fader down. Bring up the most important part first, the one the song is about, then add the others around it one at a time, each only as loud as it needs to be.\n\nIn a pop song that’s usually the lead (the singer), with the kick and the bass close behind: they carry the beat and the low end. Pads and extra parts come last.\n\nPress **Play**. You’ll hear nothing yet: every fader is down.',
      ),
      explore('Build the mix', 'Move one fader at a time, and listen to the whole mix each time, not just the part you’re moving.', [
        task('Press **Play** and bring the **lead** up to about −6 dB', C.all(C.playing, C.above('lead:fader', -10))),
        task('Bring in the **kick** and the **snare** under the lead', C.all(C.above('kick:fader', -30), C.above('snare:fader', -30))),
        task('Add the **bass** until it locks in with the kick', C.above('bass:fader', -30)),
        task('Add the **piano** and the **guitar**, a little quieter', C.all(C.above('keys:fader', -40), C.above('guitar:fader', -40))),
        task('Bring in the **hi-hats** and the **pad** last', C.all(C.above('hats:fader', -40), C.above('pad:fader', -40))),
        task('The pad test: **mute** the pad. If you miss it when it’s gone, it’s loud enough; if you noticed it before, it was too loud', C.on('pad:mute')),
      ]),
      explain(
        'Levels are relative',
        'No fader setting is right on its own: what matters is how loud each part is *against the others*. Push every fader up 6 dB and you have the same balance, only louder.\n\nThat’s why the quizzes judge the balance, not the numbers. Match how the target sounds, and your faders can be anywhere that gives the same balance.',
        { hear: [hear('A balance', faders(POP)), hear('Every fader 6 dB up', faders(Object.fromEntries(Object.entries(POP).map(([k, v]) => [k, v + 6]))))] },
      ),
      mix('From silence', 'Every fader is down again. Build the target’s balance: start with the lead, then bring the rest in around it.', { target: faders(POP) }),
    ],
  ),
  lesson(
    'pr2-2',
    'Who’s Too Loud?',
    'learn',
    'Hear which part sticks out of a mix, and put it back',
    { session: 'acoustic', start: faders(ACOUSTIC), controls: ['*:fader'] },
    [
      explain(
        'Listen to the whole',
        'When one part is too loud, it pulls your ear towards it and away from everything else. When one is too quiet, you find yourself leaning in to hear it.\n\nTo hear a balance, listen to the whole band at once, as a listener would, and ask: does anything stick out? Is anything hard to hear? Try these on *Porch Light*.',
        { hear: [hear('Balanced'), hear('Guitar too loud', faders({}, { guitar: ACOUSTIC.guitar + 6 })), hear('Violin too quiet', faders({}, { violin: ACOUSTIC.violin - 8 }))] },
      ),
      listen('Who’s too loud?', 'One part is 6 dB louder than it should be in each round.', 'Which part is too loud?', options(Object.keys(ACOUSTIC)), tooLoud(ACOUSTIC)(5)),
      mix('Put them back', 'Two parts are out: one sticks out, one has sunk. Listen to the target and fix them.', { start: faders({}, { guitar: ACOUSTIC.guitar + 6, piano: ACOUSTIC.piano - 7 }), target: faders({}, { guitar: ACOUSTIC.guitar, piano: ACOUSTIC.piano }) }),
      mix('Two more', 'This time the shaker is shouting and the bass has gone shy.', { start: faders({}, { shaker: ACOUSTIC.shaker + 8, bass: ACOUSTIC.bass - 6 }), target: faders({}, { shaker: ACOUSTIC.shaker, bass: ACOUSTIC.bass }) }),
    ],
  ),
  lesson(
    'pr2-3',
    'The Lead on Top',
    'learn',
    'Set the lead clearly above the music, without pasting it on top',
    { session: 'electronic', start: faders(ELECTRONIC), controls: ['*:fader'] },
    [
      explain(
        'The lead leads',
        'The lead (a singer, or here a synth playing the tune) is what most listeners follow. It should sit clearly on top: every note easy to hear, without seeming pasted on in front of the music.\n\nToo loud, and the band shrinks behind it; too quiet, and the listener strains. Between the two is a range of good balances, not one right answer.',
        { hear: [hear('Lead too quiet', faders({}, { lead: ELECTRONIC.lead - 8 })), hear('About right'), hear('Lead too loud', faders({}, { lead: ELECTRONIC.lead + 6 }))] },
      ),
      listen(
        'Too loud, too quiet, or right?',
        'Listen to the lead against the rest of *Neon Rain*.',
        'How does the lead sit?',
        [
          { value: 'quiet', label: 'Too quiet' },
          { value: 'right', label: 'About right' },
          { value: 'loud', label: 'Too loud' },
        ],
        namedRounds(6, [
          { answer: 'quiet', mix: faders({}, { lead: ELECTRONIC.lead - 9 }), explain: 'The lead was 9 dB down: the tune was getting lost.' },
          { answer: 'right', mix: {}, explain: 'That was the balance this lesson starts from.' },
          { answer: 'loud', mix: faders({}, { lead: ELECTRONIC.lead + 7 }), explain: 'The lead was 7 dB up: the band shrank behind it.' },
        ]),
      ),
      mix('Lift the lead', 'The lead has sunk into the music. Bring it back up to where the target has it.', { start: faders({}, { lead: ELECTRONIC.lead - 9 }), target: faders({}, { lead: ELECTRONIC.lead }) }),
      mix('Room for the tune', 'The sub bass and the pluck have crept up and the lead has dropped. Get all three back to the target.', {
        start: faders({}, { lead: ELECTRONIC.lead - 5, sub: ELECTRONIC.sub + 5, pluck: ELECTRONIC.pluck + 6 }),
        target: faders({}, { lead: ELECTRONIC.lead, sub: ELECTRONIC.sub, pluck: ELECTRONIC.pluck }),
      }),
    ],
  ),
  lesson(
    'pr2-4',
    'Quiet Listening',
    'learn',
    'Check a balance at a low volume, where the important parts must still come through',
    { session: 'pop', start: { ...faders(POP), 'master:fader': -20 }, controls: ['*:fader', 'master:fader'], fresh: ['master:fader'] },
    [
      explain(
        'Mix at a sensible level',
        'Loud music sounds exciting, and that fools you: the louder music plays, the more bass and treble your ears hear compared with the middle. Mix loud for long and your ears tire, too.\n\nEngineers do most of their mixing at a moderate level and check the balance quietly. If the lead and the beat still come through at a low volume, the balance is solid.\n\nThe **master fader** sets the level of the whole mix, without changing the balance.',
        { hear: [hear('Normal level', { 'master:fader': 0 }), hear('Quiet')] },
      ),
      explore('Turn it down', 'Use the master fader on the right of the console.', [
        task('Press **Play** and take the **master** down to −30 dB: can you still follow the lead and the kick?', C.all(C.playing, C.below('master:fader', -29.9))),
        task('Bring it back up to 0 dB: listen to the bass and the hi-hats grow more than the rest', C.above('master:fader', -0.5)),
      ]),
      mix('A quiet balance', 'At this low level the lead and the kick have disappeared into the band. Bring them back to where the target has them.', {
        start: { 'master:fader': -20, ...faders({}, { lead: POP.lead - 7, kick: POP.kick - 6 }) },
        target: faders({}, { lead: POP.lead, kick: POP.kick }),
      }),
    ],
  ),
  lesson(
    'pr2-c',
    'Checkpoint: Balance',
    'checkpoint',
    'Spot what sticks out, fix a balance, and build one from silence',
    { session: 'rock', start: faders(ROCK), controls: ['*:fader'] },
    [
      listen('Who’s too loud?', 'One part is 6 dB up in each round of *Fuzz Garden*.', 'Which part is too loud?', options(Object.keys(ROCK_PARTS)), tooLoud(ROCK, ROCK_PARTS)(4)),
      mix('Fix the balance', 'Three parts are out. Listen to the target and put them right.', { start: faders({}, { snare: ROCK.snare + 6, bass: ROCK.bass - 6, lead: ROCK.lead - 5 }), target: faders({}, { snare: ROCK.snare, bass: ROCK.bass, lead: ROCK.lead }) }),
      mix('From silence', 'Every fader is down. Build the target’s balance from nothing.', { start: silence(ROCK), target: faders(ROCK) }),
    ],
  ),
]);
