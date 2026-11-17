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

// Ready-made progressions: [scale degree, quality, roman numeral] per chord.
export const PRESETS = [
  { id: 'ii-V-I', name: 'ii–V–I', chords: [[2, 'm7', 'ii'], [5, 'dom7', 'V'], [1, 'maj7', 'I']] },
  { id: 'ii-V-i', name: 'ii–V–i', minor: true, chords: [[2, 'm7b5', 'iiø'], [5, 'dom7', 'V'], [1, 'm6', 'i']] },
  { id: 'I-vi-ii-V', name: 'I–vi–ii–V', chords: [[1, 'maj7', 'I'], [6, 'm7', 'vi'], [2, 'm7', 'ii'], [5, 'dom7', 'V']] },
  { id: 'iii-VI-ii-V', name: 'iii–VI–ii–V', chords: [[3, 'm7', 'iii'], [6, 'dom7', 'VI'], [2, 'm7', 'ii'], [5, 'dom7', 'V']] },
];

// Note names

function accidental(acc) {
  return acc < 0 ? '♭'.repeat(-acc) : '♯'.repeat(acc);
}

/** A note's name from its letter (0 = C) and accidental (-1 = flat, 1 = sharp). */
export function noteName(letter, acc) {
  // Double flats and sharps read as the note they sound as (B♭♭ → A), as players call them.
  if (Math.abs(acc) > 1) {
    const pc = mod(NATURAL[letter] + acc, 12);
    const natural = NATURAL.indexOf(pc);
    if (natural >= 0) return LETTERS[natural];
    return acc < 0 ? `${LETTERS[NATURAL.indexOf(pc + 1)]}♭` : `${LETTERS[NATURAL.indexOf(pc - 1)]}♯`;
  }
  return LETTERS[letter] + accidental(acc);
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

/** The chord's four tones in its own order: pitch class, interval label and spelled name. */
export function chordTones(chord) {
  return QUALITIES[chord.quality].tones.map(([deg, semis], index) => {
    const note = spell(chord.root, deg, semis);
    return { index, deg, semis, pc: note.pc, label: intervalLabel(deg, semis), name: noteName(note.letter, note.acc) };
  });
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

/** One spelling for the many ways chord suffixes are written. `slash` says a bass was dropped. */
function normalize(suffix) {
  let s = suffix
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/[Δ∆^]/g, 'maj')
    .replace(/ø7?/g, 'm7b5')
    .replace(/[°º˚]/g, 'dim')
    .replace(/[−–]/g, '-')
    .replace(/[\s()]/g, '');
  // A slash chord's bass note (C/E) isn't part of a four-note drop voicing.
  const slash = /\/[A-Ga-g][#b]?$/.test(s);
  s = s.replace(/\/[A-Ga-g][#b]?$/, '');
  s = s.replace(/^(min|mi|-)/, 'm');
  // M, Ma, MA and j mean major, also after a minor's m: CM7, CmM7, Cj7.
  s = s.replace(/^(m?)(Maj|MAJ|MA|Ma|M|j)/, (_, m) => `${m}maj`);
  s = s.toLowerCase().replace(/^ma(?!j)/, 'maj');
  return { s, slash };
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

/**
 * Reads one chord symbol ("Dm7", "B♭Δ", "F♯ø", "G7alt"). Returns { root, quality, text, approx },
 * with `approx` when the chord is shown as the nearest one the app voices, or null.
 */
export function parseChord(text) {
  const m = /^([A-Ga-g])(♯♯|♭♭|##|bb|♯|♭|#|b)?(.*)$/.exec(text.trim());
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

/** The key a ready-made progression is in: "C", or "C♯ minor" for a minor one in D♭. */
export function presetKey(id, key) {
  const preset = PRESETS.find((p) => p.id === id);
  return preset.minor ? `${MINOR_KEYS[key] || key} minor` : key;
}

/** The chords of a ready-made progression in `key` (one of KEYS), with their roman numerals. */
export function presetChords(id, key) {
  const preset = PRESETS.find((p) => p.id === id);
  const tonic = parseRoot((preset.minor && MINOR_KEYS[key]) || key);
  return preset.chords.map(([deg, quality, role]) => {
    const { letter, acc } = spell(tonic, deg, MAJOR_SCALE[deg - 1]);
    return { root: { letter, acc }, quality, role };
  });
}
