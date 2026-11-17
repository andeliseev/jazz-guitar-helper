// Music theory for drop voicings: chord symbols, note names, voicings on the fretboard and voice
// leading. Plain functions with no DOM, so tests/theory.test.mjs runs them in Node.
// docs/theory.md explains the rules.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// The pitch class of each natural note, C = 0.
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

// Standard tuning as MIDI note numbers, by string number: 1 is the high E, 6 the low E.
export const TUNING = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
export const STRING_NAMES = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };

// The widest a voicing may stretch: frets between its lowest and highest fretted note (open
// strings don't count). Every drop voicing of the chords below fits (the tests check), so with
// 12 or more frets each shape shows at least once.
export const MAX_SPAN = 4;

const mod = (n, m) => ((n % m) + m) % m;

// Four-note chords. Each tone is [interval number, semitones above the root], in the chord's own
// order (root, 3rd, 5th, then 7th or 6th): the inversions are named after it.
export const QUALITIES = {
  maj7: { suffix: 'maj7', name: 'Major 7th', tones: [[1, 0], [3, 4], [5, 7], [7, 11]] },
  dom7: { suffix: '7', name: 'Dominant 7th', tones: [[1, 0], [3, 4], [5, 7], [7, 10]] },
  m7: { suffix: 'm7', name: 'Minor 7th', tones: [[1, 0], [3, 3], [5, 7], [7, 10]] },
  m7b5: { suffix: 'm7♭5', name: 'Half-diminished', tones: [[1, 0], [3, 3], [5, 6], [7, 10]] },
  dim7: { suffix: '°7', name: 'Diminished 7th', tones: [[1, 0], [3, 3], [5, 6], [7, 9]] },
  maj6: { suffix: '6', name: 'Major 6th', tones: [[1, 0], [3, 4], [5, 7], [6, 9]] },
  m6: { suffix: 'm6', name: 'Minor 6th', tones: [[1, 0], [3, 3], [5, 7], [6, 9]] },
  mMaj7: { suffix: 'm(maj7)', name: 'Minor-major 7th', tones: [[1, 0], [3, 3], [5, 7], [7, 11]] },
  sus4: { suffix: '7sus4', name: 'Dominant 7th sus4', tones: [[1, 0], [4, 5], [5, 7], [7, 10]] },
  dom7b5: { suffix: '7♭5', name: 'Dominant 7th ♭5', tones: [[1, 0], [3, 4], [5, 6], [7, 10]] },
  aug7: { suffix: '7♯5', name: 'Augmented 7th', tones: [[1, 0], [3, 4], [5, 8], [7, 10]] },
  augMaj7: { suffix: 'maj7♯5', name: 'Augmented major 7th', tones: [[1, 0], [3, 4], [5, 8], [7, 11]] },
};

// Close position, from low to high, is voices 4 3 2 1, counted down from the top voice. A drop
// voicing moves voice 2, voice 3, or voices 2 and 4 down an octave. `order` is the result from low
// to high, as indexes into the close voicing (0 = its lowest note). `sets` are the strings it's
// played on, low to high: four next to each other for Drop 2, with one skipped for the others.
export const DROPS = {
  drop2: { name: 'Drop 2', order: [2, 0, 1, 3], sets: ['4321', '5432', '6543'] },
  drop3: { name: 'Drop 3', order: [1, 0, 2, 3], sets: ['6432', '5321'] },
  drop24: { name: 'Drop 2&4', order: [0, 2, 1, 3], sets: ['6532', '5421'] },
};

// Named after the chord tone in the bass: root, 3rd, 5th, 7th (or 6th).
export const INVERSIONS = ['Root position', '1st inversion', '2nd inversion', '3rd inversion'];

// Keys for the ready-made progressions, as they're written in jazz.
export const KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
// Minor keys go by their usual names: C♯ minor, not D♭ minor.
const MINOR_KEYS = { 'D♭': 'C♯', 'A♭': 'G♯' };
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// Ready-made progressions: [scale degree, quality, roman numeral, beats, scale] per chord. The scale
// is the usual one for the chord's place in the key (Phrygian for a iii, Aeolian for a vi).
export const PRESETS = [
  { id: 'ii-V-I', name: 'ii–V–I', chords: [[2, 'm7', 'ii', 4, 'dorian'], [5, 'dom7', 'V', 4, 'mixolydian'], [1, 'maj7', 'I', 8, 'ionian']] },
  {
    id: 'ii-V-i',
    name: 'ii–V–i',
    minor: true,
    chords: [[2, 'm7b5', 'iiø', 4, 'locrian'], [5, 'dom7', 'V', 4, 'phrygianDominant'], [1, 'm6', 'i', 8, 'melodicMinor']],
  },
  {
    id: 'I-vi-ii-V',
    name: 'I–vi–ii–V',
    chords: [[1, 'maj7', 'I', 4, 'ionian'], [6, 'm7', 'vi', 4, 'aeolian'], [2, 'm7', 'ii', 4, 'dorian'], [5, 'dom7', 'V', 4, 'mixolydian']],
  },
  {
    id: 'iii-VI-ii-V',
    name: 'iii–VI–ii–V',
    chords: [[3, 'm7', 'iii', 4, 'phrygian'], [6, 'dom7', 'VI', 4, 'phrygianDominant'], [2, 'm7', 'ii', 4, 'dorian'], [5, 'dom7', 'V', 4, 'mixolydian']],
  },
];

// How long a chord lasts, in beats of 4/4: half a bar to four bars.
export const LENGTHS = [2, 4, 8, 12, 16];
export const DEFAULT_BEATS = 4;

/** "½ bar", "1 bar", "2 bars". */
export function lengthName(beats) {
  return beats === 2 ? '½ bar' : `${beats / 4} bar${beats === 4 ? '' : 's'}`;
}

// Scales to improvise over a chord, as [interval number, semitones] from its root. Modes have their
// proper names; the others are written lower case after the root: "G altered".
export const SCALES = {
  ionian: { name: 'Ionian', steps: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 11]] },
  dorian: { name: 'Dorian', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 10]] },
  phrygian: { name: 'Phrygian', steps: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
  lydian: { name: 'Lydian', steps: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 7], [6, 9], [7, 11]] },
  mixolydian: { name: 'Mixolydian', steps: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 10]] },
  aeolian: { name: 'Aeolian', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
  locrian: { name: 'Locrian', steps: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 6], [6, 8], [7, 10]] },
  locrian2: { name: 'Locrian ♮2', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 6], [6, 8], [7, 10]] },
  melodicMinor: { name: 'melodic minor', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 11]] },
  harmonicMinor: { name: 'harmonic minor', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 11]] },
  lydianAugmented: { name: 'Lydian augmented', steps: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 8], [6, 9], [7, 11]] },
  lydianDominant: { name: 'Lydian dominant', steps: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 7], [6, 9], [7, 10]] },
  mixolydianFlat13: { name: 'Mixolydian ♭13', steps: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 8], [7, 10]] },
  phrygianDominant: { name: 'Phrygian dominant', steps: [[1, 0], [2, 1], [3, 4], [4, 5], [5, 7], [6, 8], [7, 10]] },
  altered: { name: 'altered', steps: [[1, 0], [2, 1], [2, 3], [3, 4], [4, 6], [6, 8], [7, 10]] },
  halfWhole: { name: 'half-whole diminished', steps: [[1, 0], [2, 1], [2, 3], [3, 4], [4, 6], [5, 7], [6, 9], [7, 10]] },
  wholeHalf: { name: 'whole-half diminished', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 6], [6, 8], [7, 9], [7, 11]] },
  wholeTone: { name: 'whole tone', steps: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 8], [7, 10]] },
  majorPentatonic: { name: 'major pentatonic', steps: [[1, 0], [2, 2], [3, 4], [5, 7], [6, 9]] },
  minorPentatonic: { name: 'minor pentatonic', steps: [[1, 0], [3, 3], [4, 5], [5, 7], [7, 10]] },
  blues: { name: 'blues', steps: [[1, 0], [3, 3], [4, 5], [5, 6], [5, 7], [7, 10]] },
};

// The scales offered for each quality, the usual first.
const SCALE_CHOICES = {
  maj7: ['ionian', 'lydian', 'majorPentatonic'],
  maj6: ['ionian', 'lydian', 'majorPentatonic'],
  m7: ['dorian', 'aeolian', 'phrygian', 'minorPentatonic', 'blues'],
  m6: ['dorian', 'melodicMinor', 'minorPentatonic'],
  mMaj7: ['melodicMinor', 'harmonicMinor'],
  m7b5: ['locrian', 'locrian2'],
  dim7: ['wholeHalf'],
  dom7: ['mixolydian', 'lydianDominant', 'mixolydianFlat13', 'phrygianDominant', 'altered', 'halfWhole', 'wholeTone', 'blues'],
  sus4: ['mixolydian', 'phrygian'],
  dom7b5: ['wholeTone', 'lydianDominant', 'altered'],
  aug7: ['wholeTone', 'altered'],
  augMaj7: ['lydianAugmented'],
};

// Note names

function accidental(acc) {
  return acc < 0 ? '♭'.repeat(-acc) : '♯'.repeat(acc);
}

/**
 * A note as players call it: double flats and sharps read as the note they sound as (B♭♭ is A).
 * { letter, acc }.
 */
function plain(letter, acc) {
  if (Math.abs(acc) <= 1) return { letter, acc };
  const pc = mod(NATURAL[letter] + acc, 12);
  const natural = NATURAL.indexOf(pc);
  if (natural >= 0) return { letter: natural, acc: 0 };
  return acc < 0 ? { letter: NATURAL.indexOf(pc + 1), acc: -1 } : { letter: NATURAL.indexOf(pc - 1), acc: 1 };
}

/** A note's name from its letter (0 = C) and accidental (-1 = flat, 1 = sharp). */
export function noteName(letter, acc) {
  const note = plain(letter, acc);
  return LETTERS[note.letter] + accidental(note.acc);
}

/**
 * Where a note is on the staff, in steps of the scale (each line and space one): its octave times 7
 * plus its letter, for the note `tone` (a { letter, acc }) sounding at `midi`. C4 is 28.
 */
export function staffStep(tone, midi) {
  const octave = Math.round((midi - tone.acc - NATURAL[tone.letter]) / 12) - 1;
  return octave * 7 + tone.letter;
}

/** "♭3", "5", "♭♭7": an interval by its number and size; the root is "R". */
export function intervalLabel(deg, semis) {
  const natural = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 }[deg];
  const diff = semis - natural;
  if (deg === 1 && diff === 0) return 'R';
  return accidental(diff) + deg;
}

/** The note `deg` steps above a root with `semis` semitones: spelled from the root's letter. */
function spell(root, deg, semis) {
  const letter = mod(root.letter + deg - 1, 7);
  const pc = mod(NATURAL[root.letter] + root.acc + semis, 12);
  return { letter, acc: mod(pc - NATURAL[letter] + 6, 12) - 6, pc };
}

export function rootName(root) {
  return LETTERS[root.letter] + accidental(root.acc);
}

export function chordName(chord) {
  return rootName(chord.root) + QUALITIES[chord.quality].suffix;
}

/** A tone of a chord on `root`: pitch class, interval label, and its spelled name, letter and accidental. */
function toneOf(root, deg, semis, index) {
  const note = spell(root, deg, semis);
  const { letter, acc } = plain(note.letter, note.acc);
  return { index, deg, semis, pc: note.pc, label: intervalLabel(deg, semis), name: LETTERS[letter] + accidental(acc), letter, acc };
}

/** The four tones the chord is voiced with, in its own order (root, 3rd, 5th, 7th or 6th). */
export function chordTones(chord) {
  return QUALITIES[chord.quality].tones.map(([deg, semis], index) => toneOf(chord.root, deg, semis, index));
}

/**
 * Every note of the chord as written, in its order: the chord tones, then the tensions, and a slash
 * chord's bass when it isn't one of them. For a chord voiced as the nearest one, read from what was
 * typed (G7♯5♭9 is G B D♯ F A♭, though it's voiced as G7♯5); otherwise its four tones.
 */
export function chordNotes(chord) {
  const written = chord.approx && chord.text ? readSymbol(chord.text) : null;
  if (!written) return chordTones(chord);
  const notes = written.tones.map(([deg, semis], index) => toneOf(chord.root, deg, semis, index));
  const { bass } = written;
  if (bass) {
    const semis = mod(NATURAL[bass.letter] + bass.acc - NATURAL[chord.root.letter] - chord.root.acc, 12);
    const deg = mod(bass.letter - chord.root.letter, 7) + 1;
    if (!notes.some((n) => mod(n.semis, 12) === semis)) notes.push(toneOf(chord.root, deg, semis, notes.length));
  }
  return notes;
}

/** The chord as written: what was typed for one voiced as the nearest, with ♭ and ♯ (G7♯5♭9). */
export function chordSymbol(chord) {
  const m = chord.approx && chord.text ? SYMBOL.exec(chord.text.trim()) : null;
  return m ? rootName(chord.root) + prettySuffix(m[3]) : chordName(chord);
}

/** A typed suffix with proper signs: ♭ and ♯ for b, #, - and + before a number, Δ for ^. */
function prettySuffix(suffix) {
  // A sign that starts the suffix is the chord's own: - is minor, + augmented.
  const lead = /^[-+]/.exec(suffix)?.[0] || '';
  const rest = suffix
    .slice(lead.length)
    .replace(/\/([A-Ga-g])([#b]?)$/, (_, letter, acc) => `/${letter.toUpperCase()}${acc.replace('b', '♭').replace('#', '♯')}`)
    .replace(/[b-](?=\d)/g, '♭')
    .replace(/\+(?=\d)/g, '♯')
    .replace(/#/g, '♯')
    .replace(/\^/g, 'Δ');
  return (lead === '-' ? '–' : lead) + rest;
}

// Voicings

/**
 * Every place on the neck where `chord` fits as a `drop` voicing on the strings of `set` ('4321' =
 * strings 4 to 1), within `frets` frets. Lowest position first.
 */
export function voicings(chord, drop, set, { frets = 15, openStrings = true } = {}) {
  const strings = [...set].map(Number);
  // The tones in rising order from the root; close position starts from each in turn.
  const rising = chordTones(chord).sort((a, b) => a.semis - b.semis);
  const found = [];
  for (let start = 0; start < 4; start++) {
    const close = rising.map((_, i) => rising[(start + i) % 4]);
    const voiced = DROPS[drop].order.map((i) => close[i]);
    const open = TUNING[strings[0]];
    for (let bass = open; bass <= open + frets; bass++) {
      if (mod(bass, 12) !== voiced[0].pc) continue;
      // Each voice is the nearest note above the one below it: in a drop voicing no two neighboring
      // voices are an octave or more apart.
      const notes = [];
      let pitch = bass;
      for (let i = 0; i < 4; i++) {
        if (i > 0) pitch += mod(voiced[i].pc - pitch, 12);
        notes.push({ string: strings[i], fret: pitch - TUNING[strings[i]], pitch, tone: voiced[i] });
      }
      if (notes.some((n) => n.fret < 0 || n.fret > frets)) continue;
      const fretted = notes.map((n) => n.fret).filter((f) => f > 0);
      if (fretted.length < 4 && !openStrings) continue;
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      if (span > MAX_SPAN) continue;
      const fretList = notes.map((n) => n.fret);
      found.push({
        id: `${drop}.${set}.${fretList.join('-')}`,
        drop,
        set,
        notes,
        span,
        inversion: voiced[0].index,
        low: Math.min(...fretList),
        high: Math.max(...fretList),
      });
    }
  }
  return found.sort((a, b) => a.low - b.low || a.high - b.high);
}

/** Every place on the neck within `frets` frets where one of the chord's notes is, on every string. */
export function notesOnNeck(chord, options) {
  return onNeck(chordNotes(chord), options);
}

/** Every place on the neck where one of the notes of `scale` (a key of SCALES) over `chord` is. */
export function scaleOnNeck(chord, scale, options) {
  return onNeck(scaleNotes(chord, scale), options);
}

function onNeck(notes, { frets = 15, openStrings = true } = {}) {
  const tones = new Map(notes.map((t) => [t.pc, t]));
  const found = [];
  for (let string = 1; string <= 6; string++) {
    for (let fret = openStrings ? 0 : 1; fret <= frets; fret++) {
      const pitch = TUNING[string] + fret;
      const tone = tones.get(mod(pitch, 12));
      if (tone) found.push({ string, fret, pitch, tone });
    }
  }
  return found;
}

/** Frets from the low E string to the high one, "x" for strings not played: "x x 0 2 1 1". */
export function fretText(voicing) {
  return [6, 5, 4, 3, 2, 1]
    .map((s) => voicing.notes.find((n) => n.string === s)?.fret ?? 'x')
    .join(' ');
}

/** "Root position", or "1st inversion, ♭3 in the bass". */
export function inversionName(voicing) {
  const bass = voicing.notes[0].tone;
  return voicing.inversion === 0 ? INVERSIONS[0] : `${INVERSIONS[voicing.inversion]}, ${bass.label} in the bass`;
}

// Voice leading

/** How far the voices move from `a` to `b` (on the same strings), in semitones: total and largest. */
export function movement(a, b) {
  const moves = a.notes.map((n, i) => Math.abs(n.pitch - b.notes[i].pitch));
  return { total: moves.reduce((sum, m) => sum + m, 0), largest: Math.max(...moves) };
}

/**
 * The voicing in `candidates` on the same strings as `from` whose voices move least; on a tie, the
 * one whose largest move is smallest, then the one nearest on the neck.
 */
export function closest(from, candidates) {
  let best = null;
  let bestMove = null;
  for (const c of candidates) {
    if (c.set !== from.set) continue;
    const m = movement(from, c);
    const better =
      !best ||
      m.total < bestMove.total ||
      (m.total === bestMove.total &&
        (m.largest < bestMove.largest ||
          (m.largest === bestMove.largest && Math.abs(c.low - from.low) < Math.abs(best.low - from.low))));
    if (better) {
      best = c;
      bestMove = m;
    }
  }
  return best;
}

/**
 * From `voicing` of chord number `anchor`, the smoothest way through the other chords: each one's
 * voicing is the closest to its neighbor's toward the anchor. `lists` holds each chord's voicings;
 * a chord with none on the anchor's strings gets null, and so do those beyond it.
 */
export function voiceLead(lists, anchor, voicing) {
  const path = lists.map(() => null);
  path[anchor] = voicing;
  for (let i = anchor + 1; i < lists.length; i++) path[i] = path[i - 1] && closest(path[i - 1], lists[i]);
  for (let i = anchor - 1; i >= 0; i--) path[i] = path[i + 1] && closest(path[i + 1], lists[i]);
  return path;
}

// Chord symbols

// Suffixes, as normalize() leaves them, that mean exactly a chord above. Anything else that reads
// as a chord is shown as the nearest of them ("Cmaj9" as Cmaj7, "C" as C6), marked `approx`.
const EXACT = {
  maj7: ['maj7', 'maj'],
  dom7: ['7'],
  m7: ['m7'],
  m7b5: ['m7b5', 'm7-5'],
  dim7: ['dim7', 'dim', 'o7', 'o'],
  maj6: ['6'],
  m6: ['m6'],
  mMaj7: ['mmaj7', 'mmaj'],
  sus4: ['7sus4', '7sus'],
  dom7b5: ['7b5', '7-5'],
  aug7: ['7#5', '7+5', '7+', '+7', 'aug7'],
  augMaj7: ['maj7#5', 'maj7+5', 'maj7+', 'maj#5', '+maj7', 'augmaj7'],
};

/**
 * One spelling for the many ways chord suffixes are written. A slash chord's bass (C/E) comes off,
 * as `bass`: it isn't part of a four-note drop voicing.
 */
function normalize(suffix) {
  let s = suffix
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/[Δ∆^]/g, 'maj')
    .replace(/ø7?/g, 'm7b5')
    .replace(/[°º˚]/g, 'dim')
    .replace(/[−–]/g, '-')
    .replace(/[\s()]/g, '');
  const over = /\/([A-Ga-g])([#b]?)$/.exec(s);
  const bass = over && { letter: LETTERS.indexOf(over[1].toUpperCase()), acc: accidentalValue(over[2]) };
  const slash = !!over;
  if (over) s = s.slice(0, over.index);
  s = s.replace(/^(min|mi|-)/, 'm');
  // M, Ma, MA and j mean major, also after a minor's m: CM7, CmM7, Cj7.
  s = s.replace(/^(m?)(Maj|MAJ|MA|Ma|M|j)/, (_, m) => `${m}maj`);
  s = s.toLowerCase().replace(/^ma(?!j)/, 'maj');
  return { s, slash, bass };
}

// Tensions and added notes at their natural size, in semitones.
const NATURAL_TENSION = { 2: 2, 4: 5, 9: 14, 11: 17, 13: 21 };

/**
 * Every tone a chord suffix asks for, as normalize() leaves it: [interval number, semitones] in the
 * chord's order (root, 3rd or a sus chord's 2nd or 4th, 5th, 6th or 7th, then the tensions). "maj9"
 * is R 3 5 7 9, "7#5b9" R 3 ♯5 ♭7 ♭9, "alt" R 3 ♭7 ♭9 ♯9 ♯11 ♭13. Null when it isn't a suffix the
 * app reads in full; such a chord shows the four tones it's voiced with.
 */
function suffixTones(s) {
  let rest = s;
  const take = (re) => {
    const m = re.exec(rest);
    if (m) rest = rest.slice(m[0].length);
    return m;
  };
  let minor = false;
  let dim = false;
  let fifths = [7];
  if (take(/^(dim|o)/)) {
    dim = true;
    fifths = [6];
  } else if (take(/^(aug|\+)5?/)) fifths = [8];
  else if (take(/^m(?!aj)/)) minor = true;
  let third = [3, minor || dim ? 3 : 4];
  const majorSeventh = !!take(/^maj/);
  // How far the chord goes: 6, 6/9, or a 7th up to its 9th, 11th or 13th.
  const number = take(/^(6\/9|69|6|7|9|11|13)/)?.[1];
  let sixth = false;
  let seventh = null;
  let upTo = 0;
  const tensions = [];
  if (number && number.startsWith('6')) {
    sixth = true;
    if (number !== '6') tensions.push([9, 14]);
  } else if (number || majorSeventh || dim) {
    // "maj" and "dim" alone are maj7 and °7, as EXACT has them.
    seventh = majorSeventh ? 11 : dim ? 9 : 10;
    upTo = Number(number || 7);
  }
  let alt = false;
  while (rest) {
    let m;
    if (take(/^[,/]/)) continue; // between tensions: C7(♭9,♯11)
    if ((m = take(/^(b|-|#|\+)(5|9|11|13)/))) {
      const by = m[1] === 'b' || m[1] === '-' ? -1 : 1;
      const deg = Number(m[2]);
      if (deg === 5) fifths = [...fifths.filter((f) => f !== 7), 7 + by];
      else tensions.push([deg, NATURAL_TENSION[deg] + by]);
    } else if ((m = take(/^add(2|4|9|11|13)/) || take(/^(9|11|13)/) || take(/^(2)$/))) {
      tensions.push([Number(m[1]), NATURAL_TENSION[m[1]]]);
    } else if ((m = take(/^sus(2|4)?/))) {
      third = m[1] === '2' ? [2, 2] : [4, 5];
    } else if (take(/^alt/)) {
      alt = true;
    } else if ((m = take(/^(no|omit)(3|5)/))) {
      if (m[2] === '3') third = null;
      else fifths = [];
    } else if (take(/^\+$/)) {
      fifths = [8]; // C7+
    } else {
      return null;
    }
  }
  // An altered dominant: its 5th gives way to ♯11 and ♭13, as in the altered scale.
  if (alt) {
    if (seventh == null) seventh = 10;
    fifths = [];
    tensions.push([9, 13], [9, 15], [11, 18], [13, 20]);
  }
  // A 9th, 11th or 13th chord has the tensions below its number, unless they're altered; a 13th
  // skips the 11th, which clashes with the 3rd, except on a minor chord. A dominant 11th leaves out
  // the 3rd instead, as jazz players read it: C11 is C9sus4.
  const has = (deg) => tensions.some(([d]) => d === deg);
  if (upTo >= 9 && !has(9)) tensions.push([9, 14]);
  if ((upTo === 11 || (upTo === 13 && minor)) && !has(11)) tensions.push([11, 17]);
  if (upTo === 13 && !has(13)) tensions.push([13, 21]);
  if (upTo === 11 && !minor && !majorSeventh && third?.[0] === 3) third = null;

  const tones = [[1, 0]];
  if (third) tones.push(third);
  for (const f of [...new Set(fifths)].sort((a, b) => a - b)) tones.push([5, f]);
  if (sixth) tones.push([6, 9]);
  if (seventh != null) tones.push([7, seventh]);
  // Tensions low to high, each pitch once (♯11 and ♭5 are one note).
  for (const t of tensions.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (!tones.some(([, semis]) => mod(semis - t[1], 12) === 0)) tones.push(t);
  }
  return tones;
}

/** What a chord symbol asks for in full: { tones, bass }, or null (suffixTones). */
function readSymbol(text) {
  const m = SYMBOL.exec(text.trim());
  if (!m) return null;
  const { s, bass } = normalize(m[3]);
  const tones = suffixTones(s);
  return tones && { tones, bass };
}

/** The quality nearest to a suffix that isn't exactly one of QUALITIES, or null. */
function nearest(s) {
  if (['', 'add9', 'add2', '2'].includes(s)) return 'maj6'; // a major triad
  if (/^mmaj/.test(s)) return 'mMaj7';
  if (/^m(?!aj)/.test(s)) {
    if (/b5|-5/.test(s)) return 'm7b5';
    if (/^m6/.test(s)) return 'm6';
    return 'm7'; // m, m9, m11, m13
  }
  if (/^maj/.test(s)) {
    if (/#5|\+5|\+$/.test(s)) return 'augMaj7';
    if (/^maj6/.test(s)) return 'maj6';
    return 'maj7'; // maj9, maj13, maj7#11
  }
  if (/^(dim|o)/.test(s)) return 'dim7';
  if (/^6/.test(s)) return 'maj6'; // 69, 6add9
  if (/^(\+|aug)/.test(s)) return /maj/.test(s) ? 'augMaj7' : 'aug7';
  if (/^sus/.test(s)) return 'sus4';
  if (/^alt/.test(s)) return 'dom7';
  if (/^(7|9|11|13)/.test(s)) {
    if (/sus/.test(s) || /^11/.test(s)) return 'sus4';
    if (/#5|\+5|\+$|aug/.test(s)) return 'aug7';
    if (/(b5|-5)(?!\d)/.test(s)) return 'dom7b5';
    return 'dom7'; // 9, 13, 7b9, 7#9, 7#11, 7b13, 7alt
  }
  return null;
}

/** Reads a root note: "C", "Bb", "F♯". */
export function parseRoot(text) {
  const m = /^([A-Ga-g])(♯♯|♭♭|##|bb|♯|♭|#|b)?$/.exec(text.trim());
  return m && { letter: LETTERS.indexOf(m[1].toUpperCase()), acc: accidentalValue(m[2]) };
}

function accidentalValue(text) {
  if (!text) return 0;
  return /[#♯]/.test(text) ? text.length : -text.length;
}

// A chord symbol: its root's letter and accidentals, then the suffix.
const SYMBOL = /^([A-Ga-g])(♯♯|♭♭|##|bb|♯|♭|#|b)?(.*)$/;

/**
 * Reads one chord symbol ("Dm7", "B♭Δ", "F♯ø", "G7alt"). Returns { root, quality, text, approx },
 * with `approx` when the chord is voiced as the nearest one the app has (chordNotes() still reads
 * all its notes from `text`), or null.
 */
export function parseChord(text) {
  const m = SYMBOL.exec(text.trim());
  if (!m) return null;
  const { s, slash } = normalize(m[3]);
  let quality = Object.keys(EXACT).find((q) => EXACT[q].includes(s));
  const approx = !quality || slash;
  quality = quality || nearest(s);
  if (!quality) return null;
  return { root: { letter: LETTERS.indexOf(m[1].toUpperCase()), acc: accidentalValue(m[2]) }, quality, text: text.trim(), approx };
}

/** Reads chord symbols separated by spaces, commas or bar lines. `bad` lists what didn't read. */
export function parseChords(text) {
  const chords = [];
  const bad = [];
  // Commas and spaces inside parentheses belong to the chord: C7(♭9, ♯11).
  const joined = text.replace(/\([^)]*\)/g, (group) => group.replace(/[\s,]/g, ''));
  for (const token of joined.split(/[\s,;|]+/)) {
    // Repeat signs and other chart marks between the chords.
    if (!token || /^[%/.:–—-]+$/.test(token)) continue;
    const chord = parseChord(token);
    if (chord) chords.push(chord);
    else bad.push(token);
  }
  return { chords, bad };
}

// The usual short way to write a chord, shown next to its suggestion: "minor 7th · D–7". Only
// where it teaches a sign; D–Δ and DΔ♯5 only combine signs shown on other rows.
const SHORTHAND = { maj7: 'Δ', m7: '–7', m7b5: 'ø', dim7: 'o7', sus4: 'sus', aug7: '+7' };
// Chords people write that the app voices as the nearest one it has, suggested once something
// follows the root.
const NEARBY = [
  'maj9', 'maj7#11', '9', '13', '7b9', '7#9', '7#11', '7b13', '7alt', '7#5b9', '7#5#9', '13b9', '9#11',
  'm9', 'm11', '69', '9sus4', 'add9',
];
const pretty = (suffix) => suffix.replace(/b/g, '♭').replace(/#/g, '♯');

/**
 * Chords to suggest while `token`, one chord symbol, is being typed: the qualities with a way of
 * writing them that starts with what follows the root, then common chords the app shows as the
 * nearest one (`approx`). [{ text, quality, desc, approx }], at most `limit`. A lone "m" is minor,
 * so it doesn't suggest maj chords.
 */
export function suggestChords(token, limit = 12) {
  const m = SYMBOL.exec(token.trim());
  if (!m) return [];
  const name = rootName({ letter: LETTERS.indexOf(m[1].toUpperCase()), acc: accidentalValue(m[2]) });
  const { s } = normalize(m[3]);
  const fits = (form) => form.startsWith(s) && !(s === 'm' && form.startsWith('maj'));
  const found = [];
  for (const [quality, forms] of Object.entries(EXACT)) {
    if (!forms.some(fits)) continue;
    const short = SHORTHAND[quality] ? ` · ${name}${SHORTHAND[quality]}` : '';
    found.push({ text: name + QUALITIES[quality].suffix, quality, desc: QUALITIES[quality].name.toLowerCase() + short, approx: false });
  }
  if (s) {
    for (const suffix of NEARBY) {
      const form = normalize(suffix).s;
      if (!fits(form)) continue;
      const quality = nearest(form);
      found.push({ text: name + pretty(suffix), quality, desc: `voiced as ${name}${QUALITIES[quality].suffix}`, approx: true });
    }
  }
  return found.slice(0, limit);
}

// Scales over chords

/** The scales offered for a chord, as keys of SCALES, the usual one first. */
export function scaleChoices(chord) {
  return SCALE_CHOICES[chord.quality];
}

/**
 * The scale to improvise over a chord unless one is chosen: the usual one for its quality, or for
 * the tensions written in it (altered for G7♯5♭9, half-whole diminished for G13♭9, Lydian for
 * Cmaj7♯11).
 */
export function defaultScale(chord) {
  const m = chord.approx && chord.text ? SYMBOL.exec(chord.text.trim()) : null;
  const s = m ? normalize(m[3]).s : '';
  const has = (re) => re.test(s);
  switch (chord.quality) {
    case 'maj7':
    case 'maj6':
      return has(/#11/) ? 'lydian' : 'ionian';
    case 'm7b5':
      return has(/(^|[^b#+-])9|11/) ? 'locrian2' : 'locrian';
    case 'sus4':
      return has(/b9/) ? 'phrygian' : 'mixolydian';
    case 'aug7':
      return has(/b9|#9|alt/) ? 'altered' : 'wholeTone';
    case 'dom7':
      if (has(/alt/) || (has(/#9/) && has(/b9|b13|#11/))) return 'altered';
      if (has(/b9/) && has(/b13/)) return 'phrygianDominant';
      if (has(/[b#]9/)) return 'halfWhole';
      if (has(/#11/)) return 'lydianDominant';
      if (has(/b13/)) return 'mixolydianFlat13';
      return 'mixolydian';
    default:
      return SCALE_CHOICES[chord.quality][0];
  }
}

/** The chord's scale: the one chosen for it if it's still one of its choices, else its default. */
export function chordScale(chord) {
  return scaleChoices(chord).includes(chord.scale) ? chord.scale : defaultScale(chord);
}

/** "D Dorian", "G altered". */
export function scaleName(chord, scale) {
  return `${rootName(chord.root)} ${SCALES[scale].name}`;
}

/**
 * The notes of `scale` over `chord`, low to high from the root, as chordNotes() gives tones: a note
 * of the chord keeps its name and label (G7♯5♭9's D♯ stays ♯5), the others are named as tensions
 * above the octave (9, 11, 13).
 */
export function scaleNotes(chord, scale) {
  const own = new Map(chordNotes(chord).map((t) => [t.pc, t]));
  const rootPc = mod(NATURAL[chord.root.letter] + chord.root.acc, 12);
  return SCALES[scale].steps.map(([deg, semis], index) => {
    const tone = own.get(mod(rootPc + semis, 12));
    if (tone) return { ...tone, index, semis: mod(tone.semis, 12) };
    const t = toneOf(chord.root, deg, semis, index);
    const above = { 2: 9, 4: 11, 6: 13 }[deg];
    return above ? { ...t, label: intervalLabel(above, semis + 12) } : t;
  });
}

/** The key a ready-made progression is in: "C", or "C♯ minor" for a minor one in D♭. */
export function presetKey(id, key) {
  const preset = PRESETS.find((p) => p.id === id);
  return preset.minor ? `${MINOR_KEYS[key] || key} minor` : key;
}

/** The chords of a ready-made progression in `key` (one of KEYS), with their roman numerals, lengths and scales. */
export function presetChords(id, key) {
  const preset = PRESETS.find((p) => p.id === id);
  const tonic = parseRoot((preset.minor && MINOR_KEYS[key]) || key);
  return preset.chords.map(([deg, quality, role, beats, scale]) => {
    const { letter, acc } = spell(tonic, deg, MAJOR_SCALE[deg - 1]);
    return { root: { letter, acc }, quality, role, beats, scale };
  });
}
