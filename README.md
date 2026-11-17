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
- Fretboards as tall as you like, light or dark look, a left-handed fretboard, 12 to 24 frets
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

**Chords.** Type chord symbols into **Add chords** and press Enter: `Dm7 G7 Cmaj7`, or a line from a chart, `| Gm7♭5 | C7♭9 | Fm6 |`. The usual ways of writing each chord work: `CΔ7`, `C-7`, `Cø`, `C°7`, `C7sus4`, `C7♯5`. Chords the app doesn't voice yet are shown as the nearest one it does, and say so: `Cmaj9` as Cmaj7, `G13` as G7, a plain `C` as C6. As you type, a list shows the chords that fit, with their names and, for chords like Dm9, what you'll see: choose one with ↓ and Enter or a click to add it, or press Tab to put it in and keep typing. In the sidebar, drag a chord up or down to move it in the progression, and point at it for its buttons: hide it from the fretboard, or remove it. Double-click its name to type another chord in its place.

**Presets.** Click a ready-made progression under **Presets** (ii–V–I, ii–V–i, I–vi–ii–V, iii–VI–ii–V) to put it in place of yours, in the key you choose; if that was a mistake, click **Undo**. Point at one and click its **+** to add it to the end instead. **Save**, next to Progression, keeps your progression under **My presets** with a name you give it; click it later to bring it back, or use its **+** to add it to the end. Saving under a name that's already there replaces that one.

**Voicings.** Choose **Drop 2**, **Drop 3** or **Drop 2&4**, then the **strings** to play them on (Drop 2 on four strings next to each other, the others with one string skipped) and the **inversions**: Root has the root in the bass, 1st the 3rd, 2nd the 5th, 3rd the 7th. Double-click a string set or an inversion to show only that one.

**Views.** **Stacked** shows a fretboard per chord, one under another and lined up, each with its fret numbers under it, so a column of frets shows what each chord has in that position; the fret under the mouse lights up on every fretboard. **Overlay** puts every chord on one fretboard in its own color; where chords share a note, their dots stand side by side. **Intervals** or **Notes** chooses what the dots say. **All notes** adds every other note of each chord on the neck, outlined, so you see the whole arpeggio around the voicings. **Frets** sets how many frets they show, 12 to 24. Drag **Height** to make the fretboards taller or shorter; Stacked and Overlay each keep their own height, and a double-click on it goes back to the usual one.

**Pinning and voice leading.** Point at a voicing to see its frets and inversion; click it to pin it, and its frets show under the chord in the sidebar. A note that's in several voicings pins each of them in turn as you click. Turn on **Voice leading** and every chord gets a voicing at once: from the voicing you pinned last, or else from the first chord's lowest one, each other chord takes its closest voicing on the same strings, the one whose notes move least. Click any voicing to start the path from it. Turning Voice leading off keeps only the voicing you pinned yourself. `Esc` unpins everything.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `1` / `2` / `3` | Drop 2 / Drop 3 / Drop 2&4 |
| `V` | Stacked or Overlay |
| `N` | Intervals or Notes on the dots |
| `L` | Voice leading on or off |
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
