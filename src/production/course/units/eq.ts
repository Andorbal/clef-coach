/**
 * Unit 5: EQ. The spectrum and who lives where, the high-pass, bells and Q, shelves,
 * hearing which region is boosted, fixing what the recording got wrong, and making room
 * between the kick and the bass. On Night Drive (pop), with faulty takes where a lesson
 * needs something to fix.
 */
import type { Mix } from '../../dsp/params';
import { C, explain, explore, hear, lesson, listen, mix, shuffle, task, unit } from '../build';

const S = 'pop';
const TRACKS = ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'pad', 'lead'];

/** The same EQ setting on every track (for hearing a region of the whole mix). */
const everywhere = (d: Mix): Mix => Object.fromEntries(TRACKS.flatMap(id => Object.entries(d).map(([k, v]) => [`${id}:${k}`, v])));

/** The guitar's takes with recording problems, for the lessons that fix them. */
const BOOMY_GUITAR = { id: 'guitar', from: 'guitar', fault: { boom: 10 } };
const MUDDY_PIANO = { id: 'keys', from: 'keys', fault: { mud: 11 } };
const HARSH_LEAD = { id: 'lead', from: 'lead', fault: { harsh: 12 } };

const REGIONS = [
  { value: 'low', label: 'Low (100 Hz)', band: { midFreq: 100, midGain: 9, midQ: 1.4 }, explain: 'A boost at 100 Hz: fuller, heavier, then boomy.' },
  { value: 'lowmid', label: 'Low mids (400 Hz)', band: { midFreq: 400, midGain: 9, midQ: 1.4 }, explain: 'A boost at 400 Hz: thicker and boxier, like a cardboard box around the sound.' },
  { value: 'mid', label: 'Mids (1 kHz)', band: { midFreq: 1000, midGain: 9, midQ: 1.4 }, explain: 'A boost at 1 kHz: honky and nasal, pushed forward.' },
  { value: 'upper', label: 'Upper mids (3 kHz)', band: { presFreq: 3000, presGain: 9, presQ: 1.4 }, explain: 'A boost at 3 kHz: bright, edgy, the pick and the bite.' },
];

/** A and B: the guitar alone, flat and with one region boosted. Which region? */
const regionRounds = (count: number) => (rng: () => number) => {
  let bag: typeof REGIONS = [];
  return Array.from({ length: count }, () => {
    if (!bag.length) bag = shuffle(rng, REGIONS);
    const r = bag.pop()!;
    const solo = { 'guitar:solo': 1 };
    const boosted = { ...solo, ...Object.fromEntries(Object.entries(r.band).map(([k, v]) => [`guitar:${k}`, v])) };
    return { mixes: [solo, boosted], answer: r.value, explain: r.explain };
  });
};

export const EQ_UNIT = unit('pr-eq', 'EQ', 'Shaping the tone', 'The spectrum and who lives where, high-pass filters, bells and shelves, fixing what the recording got wrong, and making room for each part.', [
  lesson(
    'pr5-1',
    'The Spectrum',
    'learn',
    'Hear where each part lives, from the lows to the highs',
    { session: S, controls: ['*:solo', '*:mute'] },
    [
      explain(
        'Low to high',
        'Every sound is made of frequencies, measured in **hertz** (Hz): how many times a second the air shakes. We hear from about 20 Hz, a rumble you feel more than hear, to about 20,000 Hz (20 kHz), a faint hiss.\n\nEngineers split that range into regions with names: the **low end**, the **low mids**, the **mids**, the **upper mids** and the **top end**. Each instrument lives mostly in a few of them.\n\nAn **EQ** (equaliser) turns regions up or down, the way a fader turns a whole track up or down.',
        { visual: 'spectrum' },
      ),
      explain('Hear the regions', 'Here is the whole mix with each end taken away. Press Play, then switch between them.', {
        hear: [hear('Everything'), hear('No lows', everywhere({ hpOn: 1, hpFreq: 400 })), hear('No highs', everywhere({ presGain: -15, presFreq: 2500, presQ: 0.5, highGain: -15, highFreq: 3000 }))],
      }),
      explore('Who lives where?', 'Solo a few parts and listen to where each one sits: down low, in the middle, or up high.', [
        task('Press **Play** and **solo** the bass: almost all of it lives down low', C.on('bass:solo')),
        task('Solo only the **hi-hats**: they live right at the top', C.all(C.on('hats:solo'), C.off('bass:solo'))),
        task('Solo the **kick** and the **bass** together: both live in the low end, so they compete for it', C.all(C.on('kick:solo'), C.on('bass:solo'), C.off('hats:solo'))),
        task('Turn every solo off', C.all(...TRACKS.map(id => C.off(`${id}:solo`)))),
      ]),
      explain(
        'Masking',
        'When two parts are loud in the same region, the louder one covers up, or **masks**, the other. That’s why a mix can sound muddy even when every track sounds fine alone.\n\nEQ is how you share the spectrum out: a little less of one part where another needs to be heard.',
      ),
    ],
  ),
  lesson(
    'pr5-2',
    'High-Pass Filters',
    'learn',
    'Clear the low end of parts that don’t need it',
    { session: S, controls: ['*:hp', '*:solo'], fresh: ['*:hp'] },
    [
      explain(
        'Clear the low end',
        'A **high-pass filter** (HPF, or low cut) lets the highs pass and removes everything below its frequency.\n\nMost parts make little useful sound below about 100 Hz, but their mics still pick up rumble, thumps and boom down there. Add that up over a dozen tracks and the kick and bass have to fight through it.\n\nSo engineers high-pass nearly everything except the kick and the bass. Listen to the low end tighten up.',
        {
          visual: 'eq-curves',
          hear: [hear('No high-pass filters'), hear('High-passed', { 'keys:hpOn': 1, 'keys:hpFreq': 160, 'guitar:hpOn': 1, 'guitar:hpFreq': 160, 'pad:hpOn': 1, 'pad:hpFreq': 250, 'lead:hpOn': 1, 'lead:hpFreq': 120 })],
        },
      ),
      explore('Sweep a high-pass', 'Solo the piano so you can hear exactly what the filter takes away.', [
        task('Press **Play** and **solo** the piano', C.on('keys:solo')),
        task('Turn on the piano’s **High-pass**', C.on('keys:hpOn')),
        task('Sweep its frequency past 500 Hz: the piano goes thin and small', C.all(C.on('keys:hpOn'), C.above('keys:hpFreq', 500))),
        task('Bring it back down to between 120 and 200 Hz, where it only clears the mud', C.all(C.on('keys:hpOn'), C.between('keys:hpFreq', 120, 200))),
      ]),
      explain(
        'How high?',
        'Sweep the filter up until the part starts to sound thin on its own, then back off a little. With the rest of the mix playing you’ll hear it much less than you think.\n\nTo start with: guitars and keys around 100–200 Hz, a lead voice 80–150 Hz, pads and hi-hats even higher. Never on the kick and bass: their low end is the point.',
      ),
      mix('High-pass the guitar', 'The guitar’s low notes crowd the bass. Use its high-pass to match the target: listen to how much of the bottom is gone.', { controls: ['guitar:hp', 'guitar:solo'], target: { 'guitar:hpOn': 1, 'guitar:hpFreq': 250 } }),
      mix('Thin the pad', 'The pad only needs to be a soft bed of chords. Clear its low end to match the target.', { controls: ['pad:hp', 'pad:solo'], target: { 'pad:hpOn': 1, 'pad:hpFreq': 400 } }),
    ],
  ),
  lesson(
    'pr5-3',
    'Bells and Q',
    'learn',
    'Boost and cut a range with a bell, and set how wide it is',
    { session: S, controls: ['guitar:eq', 'guitar:solo'], fresh: ['guitar:eq'] },
    [
      explain(
        'The bell',
        'A **bell** (or peaking) band raises or lowers a range of frequencies around its centre: **Gain** sets how much, **Freq** where, and **Q** how wide. A low Q is a broad, gentle hill; a high Q is a narrow spike.\n\nThe console has two bells on every strip, **Mid** and **Hi-mid**, between a low shelf and a high shelf.',
        { visual: 'eq-curves' },
      ),
      explore('Sweep a boost', 'A boost you sweep across the spectrum is how engineers find a sound’s good and bad spots.', [
        task('Press **Play**, **solo** the guitar, and boost its **Mid** band by 9 dB or more', C.all(C.on('guitar:solo'), C.above('guitar:midGain', 8.9))),
        task('Sweep **Mid freq** up past 1.5 kHz while it plays: hear the boost travel', C.above('guitar:midFreq', 1500)),
        task('Narrow it: raise **Mid Q** above 4', C.above('guitar:midQ', 4)),
        task('Now make it a cut: **Mid** at −6 dB or lower', C.below('guitar:midGain', -6)),
      ]),
      explain(
        'Cut before you boost',
        'When something sounds wrong, look for what to take away before adding something new. Cuts sound more natural, and every boost makes the track louder, which fools your ears into liking it.\n\nA useful habit: boost narrow to *find* the problem, then cut it, a little wider and a little less.',
      ),
      listen('Which region is boosted?', 'A is the guitar as it was recorded; in B one region is boosted by 9 dB.', 'Where is the boost in B?', REGIONS.map(r => ({ value: r.value, label: r.label })), regionRounds(6)),
      mix('Find the boost', 'Someone has boosted the guitar somewhere. Find the band and take it back out, until it sounds like the target.', { start: { 'guitar:midFreq': 1000, 'guitar:midGain': 9 }, target: { 'guitar:midGain': 0 } }),
    ],
  ),
  lesson(
    'pr5-4',
    'Shelves',
    'learn',
    'Tilt a sound darker or brighter, warmer or thinner',
    { session: S, controls: ['keys:eq', 'bass:eq', 'snare:eq', 'keys:solo', 'bass:solo', 'snare:solo'] },
    [
      explain(
        'Shelves',
        'A **shelf** lifts or lowers everything beyond its frequency, like the tone controls on a stereo. The **low shelf** works on everything below it, the **high shelf** on everything above.\n\nA bell picks out one range; a shelf tilts the whole sound: warmer or thinner at the bottom, brighter or darker at the top.',
        {
          visual: 'eq-curves',
          hear: [hear('The piano'), hear('Darker', { 'keys:solo': 1, 'keys:highFreq': 2000, 'keys:highGain': -12 }), hear('Brighter', { 'keys:solo': 1, 'keys:highFreq': 2000, 'keys:highGain': 8 })],
        },
      ),
      explore('Tilt the tone', 'Solo the piano, then the bass, and lean on their shelves.', [
        task('Darken the piano: its **High** shelf at −8 dB or lower', C.below('keys:highGain', -8)),
        task('Then brighten it instead: **High** at +4 dB or more', C.above('keys:highGain', 4)),
        task('Give the bass more weight: its **Low** shelf at +4 dB or more', C.above('bass:lowGain', 4)),
      ]),
      mix('A warmer bass', 'The bass sounds a little thin. Use its low shelf to give it the weight the target has.', { controls: ['bass:eq', 'bass:solo'], target: { 'bass:lowFreq': 150, 'bass:lowGain': 8 } }),
      // a high shelf on the snare rather than the piano: the piano carries little of its energy up there, so a shelf is easier to hear on the snare
      mix('A softer snare', 'The snare is a bit bright and splashy for this song. Take some of its top end off with the high shelf, as in the target.', { controls: ['snare:eq', 'snare:solo'], target: { 'snare:highFreq': 2500, 'snare:highGain': -12 } }),
    ],
  ),
  lesson(
    'pr5-5',
    'Fixing a Recording',
    'quiz',
    'Hear what went wrong at the recording and fix it with EQ',
    { session: S, channels: ['kick', 'snare', 'hats', 'bass', MUDDY_PIANO, BOOMY_GUITAR, 'pad', HARSH_LEAD], controls: ['keys:eq', 'guitar:eq', 'lead:eq', '*:solo'] },
    [
      explain(
        'Problems from the room and the mic',
        'Three of these tracks came back from the recording with problems you can hear:\n\n- the **guitar** mic was too close: a boom around 150 Hz (the proximity effect)\n- the **piano** was recorded in a small, boxy room: mud around 400 Hz\n- the **lead** went through a harsh, edgy mic: too much around 3.5 kHz\n\nEach one is a bump in the spectrum, so each fix is a cut in the same place. Listen to them alone first.',
        { hear: [hear('Boomy guitar', { 'guitar:solo': 1 }), hear('Muddy piano', { 'keys:solo': 1 }), hear('Harsh lead', { 'lead:solo': 1 })] },
      ),
      mix('The boomy guitar', 'Cut the boom out of the guitar with its **Mid** band until it sounds like the target. Narrow in on the boom first, then cut.', { controls: ['guitar:eq', 'guitar:solo'], channels: ['guitar'], aspects: ['tone'], target: { 'guitar:midFreq': 150, 'guitar:midGain': -10, 'guitar:midQ': 1 } }),
      mix('The muddy piano', 'Now the piano: find the mud in the low mids and cut it.', { controls: ['keys:eq', 'keys:solo'], channels: ['keys'], aspects: ['tone'], target: { 'keys:midFreq': 380, 'keys:midGain': -11 } }),
      mix('The harsh lead', 'And the lead: its edge lives in the upper mids. The **Hi-mid** band reaches it.', { controls: ['lead:eq', 'lead:solo'], channels: ['lead'], aspects: ['tone'], target: { 'lead:presFreq': 3500, 'lead:presGain': -12, 'lead:presQ': 1.5 } }),
    ],
  ),
  lesson(
    'pr5-6',
    'Kick and Bass',
    'learn',
    'Make room in the low end so the kick and bass both come through',
    { session: S, controls: ['kick:eq', 'bass:eq', 'kick:solo', 'bass:solo'] },
    [
      explain(
        'Two parts, one low end',
        'The kick and the bass both live at the bottom of the mix, and when they’re loud in the same place they blur into one dull thud.\n\nThe usual fix is to give each its own spot:\n\n- the **kick** keeps the deepest thump and loses some of its cardboard box sound around 300–400 Hz, which is where the bass guitar’s body is\n- the **bass** gives up a little of the very bottom, below about 80 Hz, to the kick\n\nNeither change sounds like much alone. Listen with both playing.',
        { hear: [hear('Fighting', { 'kick:solo': 1, 'bass:solo': 1 }), hear('Sharing', { 'kick:solo': 1, 'bass:solo': 1, 'kick:midFreq': 350, 'kick:midGain': -10, 'bass:lowFreq': 80, 'bass:lowGain': -10 })] },
      ),
      explore('Carve the low end', 'Solo the kick and the bass together while you work.', [
        task('Solo the **kick** and the **bass**', C.all(C.on('kick:solo'), C.on('bass:solo'))),
        task('Cut the kick’s **Mid** band by 6 dB or more, between 250 and 500 Hz', C.all(C.below('kick:midGain', -6), C.between('kick:midFreq', 250, 500))),
        task('Cut the bass’s **Low** shelf by 6 dB or more, at 100 Hz or below', C.all(C.below('bass:lowGain', -6), C.below('bass:lowFreq', 100.5))),
      ]),
      mix('Room for both', 'Share the low end out between the kick and the bass as the target does: two cuts, one on each.', { aspects: ['tone'], target: { 'kick:midFreq': 350, 'kick:midGain': -10, 'bass:lowFreq': 80, 'bass:lowGain': -10 } }),
    ],
  ),
  lesson(
    'pr5-c',
    'Checkpoint: EQ',
    'checkpoint',
    'Hear a boosted region, high-pass a part and fix a boomy take',
    { session: S, channels: ['kick', 'snare', 'hats', 'bass', 'keys', BOOMY_GUITAR, 'pad', 'lead'], controls: ['guitar:eq', 'pad:hp', '*:solo'] },
    [
      listen('Which region is boosted?', '', 'Where is the boost in B?', REGIONS.map(r => ({ value: r.value, label: r.label })), regionRounds(4)),
      mix('Clear the pad', 'Take the low end out of the pad to match the target.', { controls: ['pad:hp', 'pad:solo'], target: { 'pad:hpOn': 1, 'pad:hpFreq': 350 } }),
      mix('Fix the guitar', 'This take of the guitar is boomy. Cut it out to match the target.', { controls: ['guitar:eq', 'guitar:solo'], channels: ['guitar'], aspects: ['tone'], target: { 'guitar:midFreq': 150, 'guitar:midGain': -10, 'guitar:midQ': 1 } }),
    ],
  ),
]);
