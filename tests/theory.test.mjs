// Tests for src/theory.js: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DROPS,
  MAX_SPAN,
  QUALITIES,
  TUNING,
  chordName,
  chordTones,
  fretText,
  inversionName,
  notesOnNeck,
  parseChord,
  parseChords,
  presetChords,
  voiceLead,
  voicings,
} from '../src/theory.js';

function chord(text) {
  const c = parseChord(text);
  assert.ok(c, `reads ${text}`);
  return c;
}
const notes = (text) => chordTones(chord(text)).map((t) => t.name).join(' ');
const shapes = (text, drop, set, options) => voicings(chord(text), drop, set, options).map(fretText);

test('spells chord tones from the root', () => {
  assert.equal(notes('Dm7'), 'D F A C');
  assert.equal(notes('G7'), 'G B D F');
  assert.equal(notes('Cmaj7'), 'C E G B');
  assert.equal(notes('Bbmaj7'), 'B♭ D F A');
  assert.equal(notes('F#m7b5'), 'F♯ A C E');
  assert.equal(notes('Dbmaj7'), 'D♭ F A♭ C');
  assert.equal(notes('C#7'), 'C♯ E♯ G♯ B');
  assert.equal(notes('Abm6'), 'A♭ C♭ E♭ F');
  // B♭♭ and D♭♭ read as the notes they sound as.
  assert.equal(notes('Ebdim7'), 'E♭ G♭ A C');
});

test('labels intervals', () => {
  const labels = (text) => chordTones(chord(text)).map((t) => t.label).join(' ');
  assert.equal(labels('Cmaj7'), 'R 3 5 7');
  assert.equal(labels('Cm7b5'), 'R ♭3 ♭5 ♭7');
  assert.equal(labels('Cdim7'), 'R ♭3 ♭5 ♭♭7');
  assert.equal(labels('C7sus4'), 'R 4 5 ♭7');
  assert.equal(labels('Cm6'), 'R ♭3 5 6');
  assert.equal(labels('C7#5'), 'R 3 ♯5 ♭7');
});

test('reads the usual ways of writing each chord', () => {
  const cases = {
    'CΔ7': 'Cmaj7', 'CΔ': 'Cmaj7', 'C^7': 'Cmaj7', 'CM7': 'Cmaj7', 'Cma7': 'Cmaj7', 'CMaj7': 'Cmaj7', 'Cj7': 'Cmaj7',
    'C7': 'C7',
    'C-7': 'Cm7', 'Cmin7': 'Cm7', 'Cmi7': 'Cm7', 'Cm7': 'Cm7',
    'Cø': 'Cm7♭5', 'Cø7': 'Cm7♭5', 'Cm7-5': 'Cm7♭5', 'Cm7(b5)': 'Cm7♭5', 'C-7b5': 'Cm7♭5',
    'Co7': 'C°7', 'C°7': 'C°7', 'C°': 'C°7', 'Cdim': 'C°7', 'Cdim7': 'C°7',
    'C6': 'C6', 'C-6': 'Cm6', 'Cm6': 'Cm6',
    'Cm(maj7)': 'Cm(maj7)', 'C-Δ7': 'Cm(maj7)', 'CmM7': 'Cm(maj7)', 'CminMaj7': 'Cm(maj7)',
    'C7sus4': 'C7sus4', 'C7sus': 'C7sus4',
    'C7b5': 'C7♭5', 'C7(♭5)': 'C7♭5',
    'C7#5': 'C7♯5', 'C+7': 'C7♯5', 'Caug7': 'C7♯5', 'C7+': 'C7♯5',
    'CΔ#5': 'Cmaj7♯5', 'Cmaj7#5': 'Cmaj7♯5', 'C+maj7': 'Cmaj7♯5',
    'B♭7': 'B♭7', 'Bb7': 'B♭7', 'F♯m7': 'F♯m7', 'F#m7': 'F♯m7', 'ebm7': 'E♭m7',
  };
  for (const [text, name] of Object.entries(cases)) {
    const c = chord(text);
    assert.equal(chordName(c), name, text);
    assert.equal(c.approx, false, `${text} is exactly ${name}`);
  }
});

test('shows other chords as the nearest one it voices', () => {
  const cases = {
    'Cmaj9': 'Cmaj7', 'CΔ7#11': 'Cmaj7', 'C69': 'C6', 'C': 'C6', 'Cadd9': 'C6',
    'Cm': 'Cm7', 'Cm9': 'Cm7', 'Cm11': 'Cm7', 'C-9': 'Cm7', 'Cm69': 'Cm6',
    'C9': 'C7', 'C13': 'C7', 'C7b9': 'C7', 'C7#9': 'C7', 'C7alt': 'C7', 'C7(b9,#11)': 'C7',
    'C9sus4': 'C7sus4', 'C11': 'C7sus4', 'Csus': 'C7sus4', 'C+': 'C7♯5', 'C9b5': 'C7♭5',
    'C/E': 'C6', 'Dm7/G': 'Dm7',
  };
  for (const [text, name] of Object.entries(cases)) {
    const c = chord(text);
    assert.equal(chordName(c), name, text);
    assert.equal(c.approx, true, `${text} is shown as ${name}`);
  }
});

test('reads a list of chords and says what it could not read', () => {
  const { chords, bad } = parseChords('Dm7 G7 | Cmaj7, % H7 C5');
  assert.deepEqual(chords.map(chordName), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(bad, ['H7', 'C5']);
});

test('finds every drop 2 voicing on the middle strings', () => {
  assert.deepEqual(shapes('Cmaj7', 'drop2', '5432'), [
    'x 2 2 0 1 x',
    'x 3 5 4 5 x',
    'x 7 9 5 8 x',
    'x 10 10 9 12 x',
    'x 14 14 12 13 x',
  ]);
  assert.deepEqual(shapes('Cmaj7', 'drop2', '5432', { openStrings: false }).length, 4);
});

test('finds the familiar shapes', () => {
  // The open Dm7 and G7 chords are drop 2 voicings on the top strings.
  assert.ok(shapes('Dm7', 'drop2', '4321').includes('x x 0 2 1 1'));
  assert.ok(shapes('G7', 'drop2', '4321').includes('x x 0 0 0 1'));
  assert.ok(shapes('G7', 'drop2', '4321').includes('x x 3 4 3 3'));
  // Drop 3 with the root on the low E string, the 5th string muted.
  assert.ok(shapes('Cmaj7', 'drop3', '6432').includes('8 x 9 9 8 x'));
  assert.ok(shapes('G7', 'drop3', '6432').includes('3 x 3 4 3 x'));
  // Drop 2&4 with the root on the low E string.
  assert.ok(shapes('Cmaj7', 'drop24', '6532').includes('8 10 x 9 12 x'));
});

test('names inversions after the bass note', () => {
  const found = voicings(chord('Cmaj7'), 'drop2', '5432');
  const byFrets = Object.fromEntries(found.map((v) => [fretText(v), inversionName(v)]));
  assert.equal(byFrets['x 3 5 4 5 x'], 'Root position');
  assert.equal(byFrets['x 7 9 5 8 x'], '1st inversion, 3 in the bass');
  assert.equal(byFrets['x 10 10 9 12 x'], '2nd inversion, 5 in the bass');
  assert.equal(byFrets['x 2 2 0 1 x'], '3rd inversion, 7 in the bass');
});

test('every chord has all four inversions on every string set, within the stretch limit', () => {
  for (const quality of Object.keys(QUALITIES)) {
    const c = { root: { letter: 0, acc: 0 }, quality };
    const pcs = chordTones(c).map((t) => t.pc).sort((a, b) => a - b);
    for (const [drop, { sets }] of Object.entries(DROPS)) {
      for (const set of sets) {
        const found = voicings(c, drop, set, { frets: 24 });
        const label = `${chordName(c)} ${drop} ${set}`;
        assert.deepEqual([...new Set(found.map((v) => v.inversion))].sort(), [0, 1, 2, 3], label);
        for (const v of found) {
          assert.deepEqual(v.notes.map((n) => n.string), [...set].map(Number), label);
          assert.deepEqual(v.notes.map((n) => ((n.pitch % 12) + 12) % 12).sort((a, b) => a - b), pcs, label);
          for (let i = 1; i < 4; i++) assert.ok(v.notes[i].pitch > v.notes[i - 1].pitch, `${label} rises`);
          for (const n of v.notes) assert.equal(n.pitch, TUNING[n.string] + n.fret, label);
          assert.ok(v.span <= MAX_SPAN, label);
        }
      }
    }
  }
});

test('drop voicings move the right voice down an octave', () => {
  // Root position C E G B: Drop 2 lowers G, Drop 3 lowers E, Drop 2&4 lowers G and C.
  const lowToHigh = (drop, set) =>
    voicings(chord('Cmaj7'), drop, set, { frets: 24 })
      .filter((v) => v.notes[3].tone.label === '7')
      .map((v) => v.notes.map((n) => n.tone.label).join(' '));
  assert.ok(lowToHigh('drop2', '4321').includes('5 R 3 7'));
  assert.ok(lowToHigh('drop3', '6432').includes('3 R 5 7'));
  assert.ok(lowToHigh('drop24', '6532').includes('R 5 3 7'));
});

test('finds every note of a chord on the neck', () => {
  const notes = notesOnNeck(chord('Cmaj7'));
  const onHighE = notes.filter((n) => n.string === 1).map((n) => n.fret);
  assert.deepEqual(onHighE, [0, 3, 7, 8, 12, 15]); // E G B C E G
  assert.ok(notes.every((n) => [0, 4, 7, 11].includes(n.pitch % 12) && n.pitch === TUNING[n.string] + n.fret));
  assert.deepEqual([...new Set(notes.map((n) => n.string))], [1, 2, 3, 4, 5, 6]);
  assert.ok(notesOnNeck(chord('Cmaj7'), { openStrings: false }).every((n) => n.fret > 0));
  assert.ok(notesOnNeck(chord('Cmaj7'), { frets: 24 }).some((n) => n.fret === 24));
});

test('stays within the frets shown', () => {
  for (const v of voicings(chord('F7'), 'drop2', '6543', { frets: 12 })) {
    assert.ok(v.high <= 12 && v.low >= 0);
  }
});

test('leads voices to the nearest voicing on the same strings', () => {
  const lists = ['Dm7', 'G7', 'Cmaj7'].map((t) => voicings(chord(t), 'drop2', '4321'));
  const start = lists[0].find((v) => fretText(v) === 'x x 0 2 1 1');
  assert.deepEqual(voiceLead(lists, 0, start).map(fretText), ['x x 0 2 1 1', 'x x 0 0 0 1', 'x x 2 4 1 3']);
  // From the middle chord, both ways.
  const g7 = lists[1].find((v) => fretText(v) === 'x x 3 4 3 3');
  const path = voiceLead(lists, 1, g7);
  assert.equal(fretText(path[1]), 'x x 3 4 3 3');
  assert.ok(path.every((v) => v && v.set === '4321'));
});

test('leaves chords with no voicing on those strings out of the path', () => {
  const dm7 = voicings(chord('Dm7'), 'drop2', '4321');
  const g7Elsewhere = voicings(chord('G7'), 'drop2', '5432');
  const cmaj7 = voicings(chord('Cmaj7'), 'drop2', '4321');
  const path = voiceLead([dm7, g7Elsewhere, cmaj7], 0, dm7[0]);
  assert.equal(path[1], null);
  assert.equal(path[2], null);
});

test('builds progressions in any key', () => {
  const names = (id, key) => presetChords(id, key).map(chordName).join(' ');
  assert.equal(names('ii-V-I', 'C'), 'Dm7 G7 Cmaj7');
  assert.equal(names('ii-V-I', 'B♭'), 'Cm7 F7 B♭maj7');
  assert.equal(names('ii-V-I', 'F♯'), 'G♯m7 C♯7 F♯maj7');
  assert.equal(names('ii-V-I', 'D♭'), 'E♭m7 A♭7 D♭maj7');
  assert.equal(names('ii-V-i', 'C'), 'Dm7♭5 G7 Cm6');
  assert.equal(names('ii-V-i', 'D♭'), 'D♯m7♭5 G♯7 C♯m6');
  assert.equal(names('I-vi-ii-V', 'F'), 'Fmaj7 Dm7 Gm7 C7');
  assert.equal(names('iii-VI-ii-V', 'E♭'), 'Gm7 C7 Fm7 B♭7');
  assert.deepEqual(presetChords('ii-V-I', 'C').map((c) => c.role), ['ii', 'V', 'I']);
});
