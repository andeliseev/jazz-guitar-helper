# Music theory

Everything here is in [`src/theory.js`](../src/theory.js): plain functions with no DOM, tested by [`tests/theory.test.mjs`](../tests/theory.test.mjs) (`npm test`).

## Chords

A chord is `{ root: { letter, acc }, quality }`: `letter` 0–6 for C–B, `acc` −1 for a flat and 1 for a sharp. Each quality in `QUALITIES` is four tones, each as `[interval number, semitones above the root]`, in the chord's own order: root, 3rd (or 4th), 5th, then 7th (or 6th). That order names the inversions.

| Key | Symbol | Tones |
| --- | --- | --- |
| `maj7` | maj7 | R 3 5 7 |
| `dom7` | 7 | R 3 5 ♭7 |
| `m7` | m7 | R ♭3 5 ♭7 |
| `m7b5` | m7♭5 | R ♭3 ♭5 ♭7 |
| `dim7` | °7 | R ♭3 ♭5 ♭♭7 |
| `maj6` | 6 | R 3 5 6 |
| `m6` | m6 | R ♭3 5 6 |
| `mMaj7` | m(maj7) | R ♭3 5 7 |
| `sus4` | 7sus4 | R 4 5 ♭7 |
| `dom7b5` | 7♭5 | R 3 ♭5 ♭7 |
| `aug7` | 7♯5 | R 3 ♯5 ♭7 |
| `augMaj7` | maj7♯5 | R 3 ♯5 7 |

The keys are stored in the saved state, so don't rename them.

## Spelling

Notes are spelled from the root's letter: the tone with interval number *n* takes the letter *n − 1* steps above the root's, and the accidental is whatever makes the pitch right (`spell`). So B♭maj7 is B♭ D F A, F♯m7♭5 is F♯ A C E, C♯7 is C♯ E♯ G♯ B and A♭m6 is A♭ C♭ E♭ F.

Double flats and sharps would be correct but nobody calls the notes that, so `noteName` gives the note they sound as: E♭°7 is E♭ G♭ A C, not E♭ G♭ B♭♭ D♭♭. Intervals keep their real name, so that A is labeled ♭♭7.

Interval labels (`intervalLabel`) compare the size with the natural one of that number: a 3rd of 3 semitones is ♭3, a 5th of 8 is ♯5. The root is R.

## Drop voicings

Close position stacks the four tones within an octave. Counting the voices down from the top (voice 1 is the highest), a drop voicing moves one or two of them down an octave:

| Drop | Voices lowered | From C E G B (low to high) | String sets |
| --- | --- | --- | --- |
| Drop 2 | 2 | G C E B | 4-3-2-1, 5-4-3-2, 6-5-4-3 |
| Drop 3 | 3 | E C G B | 6-4-3-2, 5-3-2-1 |
| Drop 2&4 | 2 and 4 | C G E B | 6-5-3-2, 5-4-2-1 |

`DROPS[drop].order` is the result from low to high, as indexes into the close voicing. Drop 2 spans a little over an octave and fits four strings next to each other. Drop 3 and Drop 2&4 span about two octaves, so they skip a string: Drop 3 between the bass and the rest, Drop 2&4 in the middle.

Each of the four close positions (starting from each tone in turn) gives a drop voicing with a different tone in the bass: the four **inversions**. Root position has the root in the bass, 1st inversion the 3rd, 2nd the 5th, 3rd the 7th (or 6th). This is how most method books name drop voicings.

## On the neck

`voicings(chord, drop, set, { frets, openStrings })` finds every place a voicing fits on a string set:

1. For each inversion, the drop voicing's tones from low to high.
2. The bass goes on the set's lowest string, at every fret from 0 to `frets` where that string plays the bass tone.
3. Each higher voice is the nearest note above the one below it, on the next string of the set. In a drop voicing no two neighboring voices are an octave or more apart, so this is always the right note.
4. It's dropped if a note falls outside the frets, if it uses an open string and open strings are off, or if its fretted notes stretch more than `MAX_SPAN` (4) frets. Open strings don't count toward the stretch.

Every drop voicing of every quality stretches at most 4 frets (a test checks that all four inversions appear on every string set), so the limit removes nothing today; it's a guard for chords added later. It also means that with 12 or more frets every shape shows at least once.

Standard tuning (`TUNING`, MIDI note numbers) is E2 A2 D3 G3 B3 E4. String 1 is the high E.

A voicing is `{ id, drop, set, notes, inversion, span, low, high }`, `notes` from low to high as `{ string, fret, pitch, tone }`. `fretText` writes it the usual way, from the low E string: `x x 0 2 1 1`. Its `id` (`drop2.4321.0-2-1-1`) is what a pin saves.

`notesOnNeck(chord, { frets, openStrings })` gives every place on the neck where one of the chord's tones is, on all six strings, for All notes: the whole arpeggio the voicings are taken from.

Shapes players know make good checks: the open Dm7 (`x x 0 2 1 1`) and G7 (`x x 0 0 0 1`) are Drop 2 voicings on the top strings, `8 x 9 9 8 x` is Cmaj7 Drop 3, `x 3 5 4 5 x` is Cmaj7 Drop 2 in root position.

## Voice leading

`closest(from, candidates)` picks, among the voicings on the same strings, the one whose voices move least: the sum over the four strings of how far each note moves, in semitones (`movement`). A tie goes to the smaller largest move, then to the voicing nearer on the neck.

`voiceLead(lists, anchor, voicing)` starts from the pinned voicing of one chord and walks both ways through the progression, each chord taking the voicing closest to its neighbor's. It's greedy, one step at a time: the path you'd find by hand from that voicing, not the best path over the whole progression. A chord with no voicing on those strings (its string set isn't shown) breaks the path there.

From the open Dm7 on the top strings this gives Dm7 `x x 0 2 1 1` → G7 `x x 0 0 0 1` → Cmaj7 `x x 2 4 1 3`.

## Reading chord symbols

`parseChord` reads a root (A–G, upper or lower case, with `#`, `b`, `♯` or `♭`, at most two), then the rest as a suffix. `normalize` writes the many spellings one way: `Δ`, `^`, `M`, `Ma`, `j` mean maj; `-`, `min`, `mi` mean m; `ø` is m7♭5; `°` and `o` are dim; parentheses and spaces go; a slash bass (`C/E`) is dropped.

A suffix that means one of the qualities exactly (`EXACT`) gives that quality. Anything else that's still a chord gives the nearest quality the app voices, with `approx: true`, and the sidebar shows what was typed ("from Cmaj9"):

| Written | Shown as |
| --- | --- |
| `C`, `Cadd9`, `C69` | C6 |
| `Cm`, `Cm9`, `Cm11` | Cm7 |
| `Cmaj9`, `CΔ7♯11` | Cmaj7 |
| `C9`, `C13`, `C7♭9`, `C7♯9`, `C7alt` | C7 |
| `C9sus4`, `C11`, `Csus` | C7sus4 |
| `C+` | C7♯5 |
| `Dm7/G` | Dm7 |

A plain major triad becomes a 6 chord because that's how jazz players usually voice a C on a chart; a plain minor triad becomes m7, which fits any minor function. Power chords (`C5`) and unknown roots (`H7`) don't read.

`parseChords` splits a line on spaces, commas, semicolons and bar lines (`|`), keeps commas inside parentheses (`C7(♭9, ♯11)`), skips repeat signs (`%`), and returns what didn't read in `bad`.

### Suggestions

`suggestChords(token)` is what Add chords suggests while a symbol is typed. It reads the root as `parseChord` does, normalizes what follows it, and lists:

1. Each quality with a way of writing it (`EXACT`) that starts with what's typed, in `QUALITIES` order: `Dm7`, described as "minor 7th · D–7". The short form (`SHORTHAND`) is added only where it teaches a sign: Δ, –, ø, o, sus, +.
2. Once something follows the root, common chords the app shows as the nearest one (`NEARBY`: maj9, maj7♯11, 9, 13, 7♭9, 7♯9, 7♯11, 7♭13, 7alt, m9, m11, 69, 9sus4, add9), with `approx: true` and what they're shown as: `Dm9`, "shown as Dm7".

A lone `m` means minor, so it doesn't suggest maj chords. At most 12 (`limit`). Every suggestion reads back with `parseChord` as the quality and `approx` it was listed with; the tests check that.

## Ready-made progressions

`PRESETS` are written as scale degrees, qualities and roman numerals, and `presetChords(id, key)` spells them in a key from `KEYS`:

| Progression | Chords | In C |
| --- | --- | --- |
| ii–V–I | ii m7, V 7, I maj7 | Dm7 G7 Cmaj7 |
| ii–V–i | iiø m7♭5, V 7, i m6 | Dm7♭5 G7 Cm6 |
| I–vi–ii–V | I maj7, vi m7, ii m7, V 7 | Cmaj7 Am7 Dm7 G7 |
| iii–VI–ii–V | iii m7, VI 7, ii m7, V 7 | Em7 A7 Dm7 G7 |

The keys are named as in jazz charts (D♭, E♭, F♯, A♭, B♭). A minor progression in D♭ or A♭ goes to C♯ or G♯ minor, the names those keys have (`presetKey`).
