import { describe, expect, it } from 'vitest';
import { parseKey } from '../music/keys';
import { midiOf, parsePitch } from '../music/pitch';
import {
  analysePlayed,
  chordNotes,
  consonance,
  diatonicChord,
  identifyChord,
  intervalName,
  intervalOf,
  intervalShort,
  invertInterval,
  numeralInKey,
  parseInterval,
  pitchText,
  scaleNotes,
  semitoneName,
  signatureAccidentals,
  spellInKey,
  stepPattern,
  transpose,
  withArticle,
} from './theory';

const P = parsePitch;
const m = (s: string) => midiOf(P(s));
const texts = (ps: { step: string; alter: number; octave: number }[]) => ps.map(p => pitchText(p as never)).join(' ');

describe('intervals', () => {
  it('names intervals by letters and semitones', () => {
    expect(intervalShort(intervalOf(P('C4'), P('G4')))).toBe('P5');
    expect(intervalShort(intervalOf(P('E4'), P('G#4')))).toBe('M3');
    expect(intervalShort(intervalOf(P('E4'), P('Ab4')))).toBe('d4');
    expect(intervalShort(intervalOf(P('F4'), P('B4')))).toBe('A4');
    expect(intervalShort(intervalOf(P('B3'), P('F4')))).toBe('d5');
    expect(intervalShort(intervalOf(P('C4'), P('C5')))).toBe('P8');
    expect(intervalShort(intervalOf(P('C4'), P('D5')))).toBe('M9');
    // order doesn't matter
    expect(intervalShort(intervalOf(P('G4'), P('C4')))).toBe('P5');
    expect(intervalName(parseInterval('m7'))).toBe('minor 7th');
    expect(intervalName(parseInterval('P8'))).toBe('octave');
    expect(semitoneName(6)).toBe('tritone');
    expect(semitoneName(3)).toBe('minor 3rd');
  });

  it('puts the right article before a name', () => {
    expect(withArticle('octave')).toBe('an octave');
    expect(withArticle('augmented 4th')).toBe('an augmented 4th');
    expect(withArticle('unison')).toBe('a unison');
    expect(withArticle('11th')).toBe('an 11th');
    expect(withArticle('8th')).toBe('an 8th');
    expect(withArticle('major 3rd')).toBe('a major 3rd');
    expect(withArticle('3rd')).toBe('a 3rd');
  });

  it('spells the note an interval up or down', () => {
    expect(pitchText(transpose(P('E4'), 'M3'))).toBe('G#4');
    expect(pitchText(transpose(P('Bb3'), 'P5'))).toBe('F4');
    expect(pitchText(transpose(P('C4'), 'm3'))).toBe('Eb4');
    expect(pitchText(transpose(P('C4'), 'M6', true))).toBe('Eb3');
    expect(pitchText(transpose(P('F#4'), 'A4'))).toBe('B#4');
  });

  it('inverts intervals and knows consonance', () => {
    const inv = invertInterval(parseInterval('M3'));
    expect(intervalShort(inv)).toBe('m6');
    expect(intervalShort(invertInterval(parseInterval('P4')))).toBe('P5');
    expect(intervalShort(invertInterval(parseInterval('A4')))).toBe('d5');
    expect(consonance(parseInterval('P5'))).toBe('perfect consonance');
    expect(consonance(parseInterval('m6'))).toBe('imperfect consonance');
    expect(consonance(parseInterval('M7'))).toBe('dissonance');
    expect(consonance(parseInterval('A4'))).toBe('dissonance');
  });
});

describe('scales and keys', () => {
  it('builds scales with the right letters', () => {
    expect(texts(scaleNotes('D4', 'major'))).toBe('D4 E4 F#4 G4 A4 B4 C#5 D5');
    expect(texts(scaleNotes('F4', 'major'))).toBe('F4 G4 A4 Bb4 C5 D5 E5 F5');
    expect(texts(scaleNotes('A3', 'harmonic-minor'))).toBe('A3 B3 C4 D4 E4 F4 G#4 A4');
    expect(texts(scaleNotes('D4', 'dorian'))).toBe('D4 E4 F4 G4 A4 B4 C5 D5');
    expect(texts(scaleNotes('A4', 'minor-pentatonic'))).toBe('A4 C5 D5 E5 G5 A5');
    expect(texts(scaleNotes('C4', 'blues'))).toBe('C4 Eb4 F4 F#4 G4 Bb4 C5');
    expect(stepPattern(scaleNotes('C4', 'major'))).toBe('W W H W W W H');
    expect(scaleNotes('C4', 'major', 2)).toHaveLength(15);
  });

  it('spells played notes the way a key writes them', () => {
    expect(pitchText(spellInKey(m('F#4'), parseKey('D')))).toBe('F#4');
    expect(pitchText(spellInKey(m('Bb4'), parseKey('F')))).toBe('Bb4');
    expect(pitchText(spellInKey(m('G#4'), parseKey('Am')))).toBe('G#4');
    expect(pitchText(spellInKey(m('Eb4'), parseKey('Bb')))).toBe('Eb4');
    expect(signatureAccidentals(3)).toEqual(['F♯', 'C♯', 'G♯']);
    expect(signatureAccidentals(-2)).toEqual(['B♭', 'E♭']);
  });
});

describe('chords', () => {
  it('builds and inverts chords, spelled', () => {
    expect(texts(chordNotes('C4', 'maj'))).toBe('C4 E4 G4');
    expect(texts(chordNotes('D4', 'min'))).toBe('D4 F4 A4');
    expect(texts(chordNotes('B3', 'dim'))).toBe('B3 D4 F4');
    expect(texts(chordNotes('G3', '7'))).toBe('G3 B3 D4 F4');
    expect(texts(chordNotes('C4', 'dim7'))).toBe('C4 Eb4 Gb4 Bbb4');
    expect(texts(chordNotes('C4', 'maj', 1))).toBe('E4 G4 C5');
    expect(texts(chordNotes('C4', 'maj', 2))).toBe('G4 C5 E5');
  });

  it('names a chord from what is played, with its inversion', () => {
    const c = identifyChord([m('E4'), m('G4'), m('C5')])!;
    expect(pitchText(c.root)).toBe('C5');
    expect(c.quality.id).toBe('maj');
    expect(c.inversion).toBe(1);
    expect(identifyChord([m('G3'), m('B3'), m('D4'), m('F4')])!.quality.id).toBe('7');
    expect(identifyChord([m('A3'), m('C4'), m('E4'), m('G4')])!.quality.id).toBe('m7');
    expect(identifyChord([m('C4'), m('E4')])).toBeNull();
    expect(identifyChord([m('C3'), m('G3')])!.quality.id).toBe('5');
  });

  it('builds the chords of a key', () => {
    const C = parseKey('C');
    expect([1, 2, 3, 4, 5, 6, 7].map(d => diatonicChord(C, d).numeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(diatonicChord(C, 5, { seventh: true }).numeral).toBe('V7');
    expect(diatonicChord(C, 2, { seventh: true }).numeral).toBe('ii7');
    expect(diatonicChord(C, 7, { seventh: true }).numeral).toBe('viiø7');
    const am = parseKey('Am');
    expect([1, 4, 5].map(d => diatonicChord(am, d).numeral)).toEqual(['i', 'iv', 'V']);
    expect(numeralInKey(identifyChord([m('G3'), m('B3'), m('D4')])!, C)).toBe('V');
    expect(numeralInKey(identifyChord([m('G3'), m('B3'), m('D4')])!, am)).toBe('♭VII');
  });

  it('describes what is held', () => {
    expect(analysePlayed([m('C4'), m('G4')])?.title).toBe('perfect 5th');
    expect(analysePlayed([m('E4'), m('G#4')], parseKey('A'))?.title).toBe('major 3rd');
    // without a key, a semitone above E is written as a 2nd, the 3rd is spelled as a 3rd
    expect(analysePlayed([m('E4'), m('Ab4')])?.title).toBe('major 3rd');
    const ch = analysePlayed([m('E3'), m('G3'), m('C4')], parseKey('C'))!;
    expect(ch.title).toBe('C major');
    expect(ch.detail).toContain('first inversion');
    expect(ch.detail).toContain('I in C major');
    expect(analysePlayed([m('C4'), m('C5')])?.title).toBe('octave');
  });
});
