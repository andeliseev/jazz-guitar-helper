# To do / ideas for later

## Not verified yet

- The macOS build: the title bar (window buttons centered on the toolbar's first row, the brand under them, full screen), WKWebView rendering of the SVG boards, and the `.dmg` from the Release workflow. Everything so far was checked on Windows 11 (WebView2) and in Chromium.
- Updates end to end: no release has been updated from yet. The first real test is 0.1.0 updating to the next version, on Windows and macOS (the relaunch after a Mac update is Unified Mail's, which works there). The Mac app is only ad-hoc signed, while Unified Mail updates itself with its own certificate. If macOS asks anything when this app updates itself, sign it with that certificate the way Unified Mail's workflow does (its `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` secrets, rcodesign, `signingIdentity` in `tauri.release.conf.json`).
- Windows 10: the window buttons' glyphs fall back to Segoe MDL2 Assets there.

## Gaps in current features

- Voice leading is greedy from the anchor; it doesn't search for the best path over the whole progression, and never changes string set. A "best path" option could compare all starting voicings.
- Voice leading needs every chord on the anchor's strings; with several string sets shown it stays on the anchor's.
- A chord can only be changed by typing its symbol again (double-click). A menu of qualities and roots would be quicker.
- My presets can't be renamed or reordered (save under a new name, then delete the old one), and stay in the key they were saved in: there's no transposing them, or the progression, to another key.
- Suggestions follow what's typed, not the caret: moving it with ← and → doesn't change the list until the next key typed.
- Chords that aren't one of the twelve qualities are voiced as the nearest one (Cmaj9 as Cmaj7). Chord tones and All notes show their tensions, but the voicings don't have them.
- Chord tones: no way yet to show only some of the tones (the 3rds and 7ths, say, the guide tones), or to point at a note and see what it is.
- Dots aren't reachable from the keyboard; pinning needs a mouse.
- The window's size and position aren't remembered between launches.

## New features

- **Extensions in drop voicings:** the usual jazz substitutions, 9 for the root, 13 for the 5th, ♭9/♯9 on dominants, and rootless voicings, each as its own quality with the tone it replaces shown.
- **Melody on top:** filter voicings by their top note (chord melody), and show the top voice's line through the progression.
- **More voicing types:** close position on the top strings, Drop 2&3, shell voicings (R 3 7, R 7 3), triads and their inversions on each string set, spread triads.
- **Drop types together:** the way many teachers present them, Drop 2 with the bass on the 4th and 5th strings and Drop 3 with it on the 6th, on one fretboard. Today a view shows one drop type at a time.
- **Hear it:** play a voicing or the pinned path with Web Audio (a plucked-string sound), no samples needed.
- **Scales over chords:** what to play over each chord: the usual scales and modes for its quality and function, with a sensible first choice (Dorian over a ii, Mixolydian over a V, altered over V7♯5♭9, Locrian over iiø, Ionian or Lydian over a maj7), its notes on the neck around the chord tones, on the whole neck or in one position (a window of 4–5 frets). Or one scale for the whole progression, its key.
- **Staff:** the chord, or the pinned voicing, in notation: a bar per chord on a treble staff, an octave up as guitar music is written, drawn by the app in SVG (noteheads, accidentals, ledger lines) rather than with a notation library. With voice leading on, the staff shows the voices moving.
- **Play along:** a metronome at a chosen tempo that walks through the progression, the chord being played highlighted on the fretboard (and scrolled to in Stacked). It needs each chord's length, which the progression doesn't keep yet; importing a chart would bring it. Goes with Hear it.
- **Export:** the pinned path as chord diagrams (SVG or PNG) or as tab, to print or paste.
- **Other tunings:** 7-string, DADGAD, drop D, baritone; the theory takes the tuning as a parameter already except for `TUNING`.
- Import a chart (iReal Pro link or a text file), and share My presets as a file.
- Scale degrees as labels relative to the key (for ii–V–I: the chord tones as degrees of C).
- A Russian interface.

## Distribution

- **Code signing:** the Windows SmartScreen and macOS Gatekeeper warnings at first launch go away only with paid certificates (and notarization on macOS).

## Code quality

- `app.js` tests: the page has none yet. A small Node test with a fake DOM for `sanitize()` and the pin logic would catch regressions in saved state.
- A test that the SVG markup's labels stay escaped if user text ever reaches it (today only the app's own labels do).
