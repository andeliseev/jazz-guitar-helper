# <img src="app-icon.svg" width="36" height="36" align="top" alt=""> Jazz Guitar Helper

A small desktop app for Windows and macOS that shows chords on the guitar fretboard: every Drop 2, Drop 3 and Drop 2&4 voicing of every chord in a progression, all at once.

- **Add a progression** by typing its chord symbols (`Dm7 G7 Cmaj7`, `B♭Δ`, `F♯ø`, `E♭°7`), or in one click: ii–V–I, ii–V–i, I–vi–ii–V or iii–VI–ii–V in any key
- **Drop 2, Drop 3 and Drop 2&4**, on any of their string sets, in any inversion
- **Every position at once:** a fretboard per chord, lined up fret by fret so you see what's under your hand for each chord, or all the chords on one fretboard in their own colors
- A line joins each voicing's notes, so its shape stands out. The root is a square, and the dots show intervals (R, ♭3, 5, ♭7) or note names
- **All notes:** every note of each chord on the whole neck, on all six strings, around its voicings
- **Point at a voicing** to see its frets (`x x 3 5 3 5`) and inversion, and **click** it to pin it
- **Voice leading:** pin a voicing of one chord and the others follow with their closest voicings on the same strings, the smoothest way through the progression
- Notes are spelled as musicians write them: B♭maj7 is B♭ D F A, F♯m7♭5 is F♯ A C E
- Fretboards as tall as you like, light or dark look, a left-handed fretboard, 12 to 24 frets, and fret numbers over and under them as you like
- Works offline and keeps your progression between launches
- **Updates itself:** when a new version is out, Settings shows an **Update** button, and one click installs it

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/screenshot-dark.png">
  <img src="docs/images/screenshot-light.png" alt="Jazz Guitar Helper with a ii–V–I in C: a fretboard per chord with every Drop 2 voicing on the top strings, and a voice-led path pinned">
</picture>

## Download

Get the latest version from the **[Releases page](https://github.com/andeliseev/jazz-guitar-helper/releases/latest)**. What changed in each version is in the [changelog](CHANGELOG.md).

| System | File |
| --- | --- |
| Windows 10 / 11 | `Jazz.Guitar.Helper_<version>_x64-setup.exe` (or the `.msi`) |
| macOS (Apple Silicon and Intel) | `Jazz.Guitar.Helper_<version>_universal.dmg` |

### First launch

The app isn't code-signed yet, so your system asks once before opening it:

- **Windows:** "Windows protected your PC" → **More info** → **Run anyway**.
- **macOS:** open the app, then go to **System Settings → Privacy & Security** and click **Open Anyway**.

## Using it

**Chords.** Type chord symbols into **Add chords** and press Enter: `Dm7 G7 Cmaj7`, or a line from a chart, `| Gm7♭5 | C7♭9 | Fm6 |`. The usual ways of writing each chord work: `CΔ7`, `C-7`, `Cø`, `C°7`, `C7sus4`, `C7♯5`. Chords with tensions keep every note: `G7♯5♭9` is G B D♯ F A♭ in the sidebar and over its fretboard, and on the neck in **Chord tones** and with **All notes**. Their drop voicings are those of the nearest four-note chord, which the chord says: `G7♯5♭9` voiced as G7♯5, `Cmaj9` as Cmaj7, `G13` as G7, a plain `C` as C6. As you type, a list shows the chords that fit, with their names and, for chords like Dm9, what they're voiced as: choose one with ↓ and Enter or a click to add it, or press Tab to put it in and keep typing. In the sidebar, drag a chord up or down to move it in the progression, and point at it for its buttons: hide it from the fretboard, or remove it. Double-click its name to type another chord in its place.

**Presets.** Click a ready-made progression under **Presets** (ii–V–I, ii–V–i, I–vi–ii–V, iii–VI–ii–V) to put it in place of yours, in the key you choose; if that was a mistake, click **Undo**. Point at one and click its **+** to add it to the end instead. **Save**, next to Progression, keeps your progression under **My presets** with a name you give it; click it later to bring it back, or use its **+** to add it to the end. Saving under a name that's already there replaces that one.

**Scales.** Turn on **Scales** and each fretboard outlines a scale to improvise over its chord, around the chord's notes, with the other notes named as tensions (9, 11, 13, ♭9…). Choose another one over the fretboard: Dorian, Aeolian or Phrygian for a minor 7th; Mixolydian, Lydian dominant, altered and more for a dominant 7th. Chords start with the usual one, and the ready-made progressions with the one for each chord's place in the key (Phrygian for the iii, Aeolian for the vi).

**Bars, staff and metronome.** Each chord lasts a bar unless you choose another length, from half a bar to four, at the end of its notes in the sidebar. **Staff**, at the bottom, shows the progression on a staff above the fretboards, a bar every four beats: each chord's pinned voicing (with Voice leading, the whole path), or else its notes in grey, or with **Scales** chosen above the staff, its scale. **Play** (or Space) plays it with a metronome, round and round, at the tempo you set: drag the slider or type it. The chord playing stands out in the sidebar, on its fretboard and on the staff. Turn on **Follow** to see only the chord playing and the next one while it plays, as tall as the window allows. Two buttons beside them each open a card: the click's sound (**Tick**, **Wood**, **Hi-hat**, **Beep**, **Ride**, or none), how loud it is, and its rhythm: every beat, only **2 & 4** as jazz players practice, or **Swing**, a ride cymbal's pattern whose swung eighths you can set from straight through triplet to dotted; and how the chords sound, again at each bar: held by a pad to improvise over (**Ambient**, **Warm pad**, **Strings**, **Organ**), plucked (**Pluck**), or not at all, with how much room around them (**Space**), how loud they are, and the root an octave lower (**Bass**).

**Voicings.** **Chord tones**, the first choice, shows every note of each chord on the whole neck. Or choose **Drop 2**, **Drop 3** or **Drop 2&4** for voicings, then the **strings** to play them on (Drop 2 on four strings next to each other, the others with one string skipped) and the **inversions**: Root has the root in the bass, 1st the 3rd, 2nd the 5th, 3rd the 7th. Double-click a string set or an inversion to show only that one. In Chord tones, what only voicings use dims until you choose a drop type again, and the voicings you pinned come back with it.

**Views.** **Stacked** shows a fretboard per chord, one under another and lined up, each with its fret numbers under it and the inlay frets' over it, so a column of frets shows what each chord has in that position; the fret under the mouse lights up on every fretboard. **Overlay** puts every chord on one fretboard in its own color, with the fret numbers under it and the inlay frets' over it; where chords share a note, their dots stand side by side, and while it plays, the chord playing keeps the middle of each fret, so its notes line up. The frets with inlays (3, 5, 7, 9, 12…) are a shade darker, so a note's fret is easy to tell from any string. **Intervals** or **Notes** chooses what the dots say. **All notes** adds every other note of each chord on the neck, outlined, so you see the whole arpeggio around the voicings. **Frets** sets how many frets they show, 12 to 24. Drag **Height** to make the fretboards taller or shorter; Stacked and Overlay each keep their own height, and a double-click on it goes back to the usual one. **Fit** makes them as tall as the window allows with all of them showing (with many chords, as small as they get, and the rest scroll).

**Pinning and voice leading.** Point at a voicing to see its frets and inversion; click it to pin it, and its frets show under the chord in the sidebar. A note that's in several voicings pins each of them in turn as you click. Turn on **Voice leading** and every chord gets a voicing at once: from the voicing you pinned last, or else from the first chord's lowest one, each other chord takes its closest voicing on the same strings, the one whose notes move least. Click any voicing to start the path from it. Turning Voice leading off keeps only the voicing you pinned yourself. `Esc` unpins everything.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `1` / `2` / `3` / `4` | Chord tones / Drop 2 / Drop 3 / Drop 2&4 |
| `V` | Stacked or Overlay |
| `N` | Intervals or Notes on the dots |
| `L` | Voice leading on or off |
| `S` | Scales on or off |
| `Space` | Play or stop |
| `A` | Add chords |
| `Z` | Undo, while its message shows (after removing a chord, clearing the progression, loading a preset, or replacing or deleting one of yours) |
| `Esc` | Unpin all voicings, or close Settings |

## Privacy

Jazz Guitar Helper runs entirely on your computer: no servers of ours, no analytics, no tracking. Your progression, the ones you save under My presets and your choices are kept in a settings file in the app's data folder. The links in Settings open in your browser.

- **Updates:** when it starts, every few hours, and when you open Settings, the app downloads a small file from GitHub to see whether a new version is out. GitHub sees your IP address, nothing else. An update installs only when you click **Update** in Settings, and only if it's signed by the developer.

Read the full [privacy policy](https://andeliseev.github.io/jazz-guitar-helper/privacy.html).

## Building from source and contributing

The app is built with [Tauri 2](https://v2.tauri.app/): a small Rust shell around your system's own web view, with the music theory and the fretboard in plain JavaScript. To build it yourself, see [docs/development.md](docs/development.md). How it works inside is in [docs/](docs/README.md).

Bug reports and pull requests are welcome.

## License

[MIT](LICENSE)
