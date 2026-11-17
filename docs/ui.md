# UI

Plain HTML/CSS/JS in `src/`, with no framework and no build step. `withGlobalTauri` exposes `window.__TAURI__`, so there's no npm package for the API either. The design follows [Unified Mail](https://github.com/andeliseev/unified-mail): the same tokens, type scale, outlined buttons, segmented controls, card dialogs and toast, and the app's own title bar. Its accent is amber instead of blue, as TorrStream Lite has its own green. One difference: a chosen segmented button or a chip that's on is tinted and in the accent color, but not bold, unlike Unified Mail's. In semibold, Segoe UI draws some glyphs differently at this size (the & of Drop 2&4 changed shape) and the button grows, moving the rest of the toolbar.

| File | Contents |
| --- | --- |
| `index.html` | The sidebar, the toolbar, the fretboards' pane and the empty state, Settings, the toast, the Windows window buttons |
| `styles.css` | Theme tokens on `:root` (light), the dark palette under `prefers-color-scheme: dark` and `data-theme="dark"`, layout, the fretboard |
| `app.js` | State, rendering, events, saving, the title bar |
| `fretboard.js` | SVG markup for boards, notes, voicing shapes and fret numbers |
| `theory.js` | The music theory (see [theory.md](theory.md)) |

## Layout

`#app` is a two-column grid: a 264 px sidebar and the main pane. Its single row is `minmax(0, 1fr)` so the fretboards scroll inside the window.

- **Sidebar:** the brand, **Progression** (Save and Clear in its heading, a row per chord, then **Add chords** with its suggestions), **Presets** (a key and the ready-made progressions), **My presets** (the progressions saved), and Settings at the bottom. It scrolls when the progression is long.
- **Toolbar:** two rows. The first chooses what the boards show: a drop type or Chord tones (segmented), the string sets and the inversions (chips that are on or off). The second chooses how it's shown: Intervals or Notes, Stacked or Overlay, Voice leading, All notes, Frets (a select: 12, 15, the default, 17, 20, 22 or 24) and Height (a slider). When the pane is wide enough, the second row sits beside the first.
- **Staff** (`#staff`, when Staff is on): under the toolbar, the progression's bars (see [Staff](#staff)).
- **Fretboards** (`#boards`): fret numbers on top, sticky while the boards scroll, then a board per chord (Stacked) or one board for all (Overlay). With no chord to show, an empty state says why, with a button that adds a ii–V–I.
- **Player** (`#player`): along the bottom, the metronome: Play, Tempo, Count-in, Loop, Click, Follow, the chords' sound, the beat, what's playing, and the Staff switch (see [Playing](#playing)).

The window's minimum size is 960 × 560 (`tauri.conf.json`). Boards always fill the pane's width, and a new width redraws them (`ResizeObserver`). How tall they are is the user's choice (see [Height](#height)).

### Title bar

As in Unified Mail, the window has no grey system title bar, so the icon and name appear once, at the top of the sidebar. `initTitleBar` (in the app, on Windows and macOS):

- adds `own-title-bar` and `win` or `mac` to `<html>`;
- makes the brand and the toolbar drag areas (`data-tauri-drag-region="deep"`): anywhere inside drags the window, except on buttons, fields and labels, which Tauri's drag script skips. A double-click maximizes (macOS: zooms).

**Windows:** `main.rs` builds the window with `decorations(false)`; Tauri still resizes it from the edges and keeps the shadow and rounded corners. The page draws Minimize, Maximize / Restore Down and Close (46 × 32 px, glyphs from Segoe Fluent Icons / Segoe MDL2 Assets), fixed at the top right over everything, Close red on hover. They sit at the right end of the toolbar's first row, which keeps 156 px free for them. They dim while another window is in front.

**macOS:** the system's window buttons stay, over a see-through title bar (`TitleBarStyle::Overlay`, title hidden), at `traffic_light_position(18, 28)`: centered 26 px down, on the line of the toolbar's first row, whose 28 px controls start 12 px down. The brand is padded 46 px down, under them. In full screen the system hides them and the brand moves up (`full-screen` on `<html>`, from `isFullscreen` on every resize; leaving full screen updates when the animation ends). `accept_first_mouse(true)` lets the first click on an inactive window reach the page, so the drag areas work at once.

## State and rendering

One `state` object in `app.js`. `state.ui` is what's saved (see [architecture.md](architecture.md#storage)); the rest is derived or momentary: `rows` (the chords on the fretboard with their tones and voicings), the boards' geometry, the fret under the mouse and the voicing under the mouse (`hover`).

`render()` recomputes the rows (and, with voice leading on, the pins), rebuilds the sidebar and the toolbar's state, redraws the boards and schedules a save. Each board is one `innerHTML` assignment of SVG markup from `fretboard.js`. The mouse never redraws: `restyle()` only toggles classes on the drawn voicings, and `renderInfo()` updates the text about them.

Chord colors are `--c0` to `--c7` by the chord's place in the progression, set through a class (`.c0` → `--chord`), with lighter versions in dark mode. Text from the user (what was typed for a chord) is always set with `textContent`; the SVG markup holds only the app's own labels.

## Fretboard

`geometry(width, frets, { gap, leftHanded })` lays a board out: string names, then a column for open strings' notes, the nut, and the frets. Each fret's space is 0.97 of the one before (a real neck is 0.944), a hint of a real neck while a shape still looks the same all along it. The high E string is on top, as in tab. Left-handed mirrors every x, so the nut is on the right; labels aren't mirrored.

A board is drawn in this order: the wood (light maple, dark rosewood in dark mode), the hover band, the inlays (single at 3, 5, 7, 9, 15, 17, 19, 21, double at 12 and 24), the frets, the nut, the strings (thicker for the wound ones) and their names. Then, from `notesMarkup`:

- **Shapes:** a line through each voicing's four notes, in the chord's color, at 38% opacity, and over it a 14 px invisible line to point at (`.hit`).
- **Dots:** one per chord per spot, in the chord's color, labeled with the tone's interval or note name. The root is a rounded square so it stands out without color. Where several chords have a note on the same spot (Overlay), their dots stand side by side in chord order, smaller if the fret is narrow; below a 6.5 px radius a dot has no label. A dot's radius is 0.46 of the gap between strings, at most 14 px, and its label grows with it (`LABEL_FIT`).
- **All notes** (`state.ui.allNotes`): every other place the chord's notes are on the neck, on all six strings (`notesOnNeck` in `theory.js`), tensions too (the ♭9 of G7♯5♭9, which its voicings, those of G7♯5, don't have), as outlined dots in the chord's color (`.ghost`). A note that's in a drawn voicing is drawn as the voicing's. Outlined dots belong to no voicing, so they have no `data-v`: the mouse passes them by, and they fade with the rest while a voicing is under the mouse.

Each shape and voicing dot carries `data-v`, the voicings it belongs to (`<chord id>~<voicing id>`), which is all the mouse handling needs.

The fret numbers sit above the boards in their own SVG, the inlay frets darker. In Stacked each board also has its own row of them underneath (`numbers` in `geometry`, 14 px), so a fret reads at any board without looking up to the top: the inlay dots alone don't do it, since notes cover them, more so with All notes. Overlay has one board right under the numbers at the top, so it needs no row of its own. Moving the mouse over the boards shades the fret under it on every board (`.band`) and its number turns amber in every row, so in Stacked you can follow one position down through all the chords.

## Views

- **Stacked:** a board per chord, headed by the chord as written (`chordSymbol`), all its notes (`chordNotes`), its roman numeral and, for a chord voiced as another, "voiced as G7♯5". On the right of the heading, the voicing under the mouse or the pinned one: inversion and frets. A click on a chord in the sidebar scrolls its board into view.
- **Overlay:** one board for all the chords. A legend above names each chord with its pinned frets; the line below shows the voicing under the mouse, or the pinned path (`Dm7 x x 3 5 3 5 → G7 x x 3 4 3 3 → …`).

### Chord tones

The fourth choice next to the drop types (`state.ui.mode`, `voicings` or `tones`; key `4`) shows every note of each chord on the whole neck instead of voicings: the places All notes would outline, as dots of their own (`notes` in a board's layer), with no lines and no `data-v`, so the mouse passes them by. Stacked and Overlay, Intervals or Notes, Frets and Height work as with voicings; in Overlay, notes the chords share stand side by side, which shows what can stay put from one chord to the next.

What only voicings use (Strings, Inversions, Voice leading, All notes) stays where it is, dimmed and disabled, so the toolbar doesn't move; the mouse goes through a dimmed string set or inversion to its group, whose tooltip says to choose a drop type. `ui.drop` keeps the drop type, and choosing it again (or `1`, `2`, `3`) brings the voicings back. The pins stay too: `computeRows` doesn't start a path while there are no voicings, and `Esc` doesn't unpin.

### Height

The Height slider sets the gap between strings, 16 to 44 px, which is how tall the boards are. Each view keeps its own (`state.ui.heights`): 20 px for Stacked and 32 px for Overlay at first, since one board for all the chords can be taller. The boards follow the slider as it moves, redrawn at most once a frame, and the value is saved like the rest of the state. A double-click on the slider goes back to the view's first height.

**Fit** (`fitHeight`) sets it once: the tallest gap at which every board drawn shows in the pane without scrolling (`fittedGap`, measured on what's drawn: headings, fret numbers and legend stay, only the boards grow), from 44 px down to 16. With too many chords to fit even at 16 px, it stays there and the rest scroll. The slider follows, and the height is saved like a slider's.

### Scales

**Scales** (`state.ui.scales`, key `S`) outlines each chord's scale on its board (`scaleOnNeck`, see [theory.md](theory.md#scales-over-chords)), as All notes outlines the chord's notes: added to the layer's `extras`, so a spot that's already the chord's (a voicing's note, or a Chord tones dot) keeps its look. The labels are the scale's own: the chord's notes as the chord names them, the others as tensions (9, 11, 13, ♭9, ♯11). Scales works with voicings and in Chord tones.

Each board's heading (Stacked) and each legend item (Overlay) gets a picker (`scalePicker`): the scales offered for the chord (`scaleChoices`) by name, "D Dorian", then the chosen scale's notes. The choice is the chord's `scale`; without one, or with one that doesn't fit after the chord is changed, the chord has its default (`chordScale`). Ready-made progressions set it for each chord.

## Staff

**Staff** (`state.ui.staff`, in the player bar) shows the progression above the boards, drawn by `staff.js` as one SVG: a treble clef with an 8 under it (guitar music is written an octave above how it sounds), 4/4, a bar line every four beats and a double bar at the end. Each chord's symbol, in its color, starts its span, which is as wide as its length (`chord.beats`): bars share the pane's width, but a beat is never under 32 px, so a long progression scrolls sideways (`#staff-scroll`), and a scale's notes get room enough.

What each chord holds (`staffEntries`), chosen above the staff (`staffShows`):

- **Chords:** its pinned voicing, the pitches it sounds an octave up; with Voice leading on, the whole path, so the voices' movement shows. A chord with no voicing pinned, or any chord in Chord tones, shows its notes (`chordNotes`) from the root under middle C, in grey: they aren't a voicing. Its length is split at the bar lines into whole notes (a bar) and half notes (with a stem: up when the notes sit low, down when high), tied; ties are thin crescents curving away from the middle line, deeper the longer they are.
- **Scales:** its scale from the root to the octave, as filled heads spread over its length, clear of the bar lines.

A note a step above the one under it goes beside it; accidentals stand left of the notes, moved further left when they'd touch; notes off the staff get ledger lines; the staff is as tall as its highest and lowest notes need. Chord symbols are what was typed, so `staff.js` escapes them. The playing chord's span is tinted (`.staff-now`) and a line marks the beat (`.staff-playhead`).

## Playing

The player bar plays the progression with a metronome: **Play** (or `Space`, unless a button has the focus) starts it, again stops it.

- **Timing:** Web Audio, scheduled 0.12 s ahead every 25 ms (`schedule`), so the beats stay even when the page is busy; each beat also sets a timer for the screen (`showBeat`). Each chord plays for its `beats` (`timeline`); the tempo (`bpm`, 40 to 240) applies from the next beat. **Count-in** plays a bar of clicks first; **Loop** starts over after the last chord, or else it stops there. The progression can change while it plays: it reads the chords at every beat.
- **Sound:** **Click** is a short tick on every beat, higher on the first of the bar. Each chord sounds as it starts (`chordSound`): its pinned voicing, or else its notes from the root, and with **Bass** the root an octave lower. How, the sound button says (`state.ui.sound`, `SOUNDS`): **Pluck** strums it low to high, a burst of noise run through a delay one period long (Karplus–Strong), made once per pitch; a pad holds it for the chord's whole length, oscillators per note through a low-pass filter, fading in over its attack and out over its release, so one chord melts into the next: **Ambient** (a slow filter sweep, a long tail), **Warm pad** (two detuned saws), **Strings** (three saws with vibrato), **Organ** (sines); or **Off**. No samples to ship.
  - The chords go through one mix (`makeMix`): at **Volume**, dry and through a reverb at **Space** (a convolver whose impulse is a few seconds of fading noise), into a compressor; the click goes straight to the compressor. Space and Volume change at once; a new sound starts with the next chord. Stopping fades the pads still sounding (`fadeVoices`).
  - The sound button names the sound and is on (tinted) unless it's Off; its card (`#sound-card`), hidden until the button is clicked, holds the choice, Space, Volume and Bass, and closes on a click elsewhere or `Esc`.
- **Follow** (`follow`, on at first): while playing, the boards show only the chord playing and the next one (`followedRows`; the first two during the count-in, round to the first again when looping), drawn as tall as the pane allows (`fittedGap`, without touching the saved height), and drawn again as each chord starts. Height and Fit wait, dimmed. Stopping, or turning Follow off, brings every board back at the slider's height.
- **Marks** (`markPlaying`, again after any render): the chord's row in the sidebar, its board (the others rest at a third; it scrolls into view as it starts), in Overlay the other chords' dots and lines faded, its span on the staff (which scrolls to it), the beat's dot, and "Dm7 · bar 2 of 4" or "Count-in 3".

## Pins and voice leading

- **Pointing** at a dot lights up every voicing that uses that note; at a line, that voicing. The board's other voicings fade.
- **Clicking** a line pins its voicing for that chord (`state.ui.pins`, chord id → voicing id); clicking it again unpins it. Clicking a note pins the first voicing using it, then the next one at each click, then none.
- A chord with a pin dims its other voicings; the pinned one keeps a strong line and outlined dots. Its frets show under the chord in the sidebar.
- **Voice leading** on: the chord last clicked is the `anchor`, and every render takes the other chords' pins from `voiceLead` (see [theory.md](theory.md#voice-leading)). So adding a chord, hiding one or changing the string sets keeps the path following the anchor. Unpinning anything clears the whole path, since it all comes from one voicing.
  - Turning it on shows a path at once (`toggleLeading`): from the voicing pinned last, or with none, from the first chord's lowest voicing (`startPath`, which marks the anchor `autoAnchor`).
  - When the anchor's voicing isn't drawn any more (another drop type or string set, its chord hidden, changed or removed), the path starts again from the first chord, so voice leading always shows one. After the user unpins everything, it waits for a click.
  - Turning it off keeps only the anchor's pin, and only when the user pinned it; the pins the path chose, and an anchor the app chose, go.
- Pins are voicing ids, which include the drop type and strings, so a pin only shows while its voicing is drawn, and comes back when it is again (after Chord tones, say).
- `Esc` unpins everything, except in Chord tones, where the pins don't show.

## The progression

- **Add chords** reads the field with `parseChords`; what doesn't read stays in the field and a toast says what it was.
- **Suggestions** (`renderSuggestions`, from `suggestChords` in [theory.md](theory.md#suggestions)): while typing, a list under the field shows the chords that fit the symbol the caret is in, up to 12. The ones the app voices as written come first, bold, named in full; the ones it voices as the nearest (`Dm9`) are in regular weight and say what they're voiced as. One suggestion that is just what's typed isn't shown.
  - ↓ and ↑ choose one; none is chosen at first, so Enter still adds what's typed. Enter or a click puts the chosen one in place of the symbol and adds the field. Tab puts it in (the first one when none is chosen) with a space after, to type the next chord. `Esc` closes the list, and a second `Esc` leaves the field. A press on the list doesn't take the focus from the field.
  - The field is a combobox: `aria-expanded`, `aria-controls` the list (`role="listbox"`), and `aria-activedescendant` the chosen row.
  - The list is as wide as the field and its button, the most the sidebar has room for (it scrolls, so nothing can stick out of it). The descriptions are kept short enough to fit: a short form only where it teaches a sign.
- **Presets** put a ready-made progression in the chosen key in place of the progression, with nothing pinned; the toast offers Undo (also `Z`). The **+** that shows on a preset under the mouse (or with the keyboard focus in it) adds it to the end instead. The tooltips say the key (C♯ minor for ii–V–i in D♭). On an empty progression the two do the same; the empty state's button loads ii–V–I.
- **My presets** (`state.ui.saved`): **Save**, in the Progression heading, opens a name field above the list, filled with the progression's name (`state.ui.title`) or else its chords, and selected so typing replaces it. Enter keeps the progression under that name; `Esc` or leaving the field cancels. A name that's already there, in any case, replaces that one, with Undo. A click on a saved progression loads it as a preset does, its **+** adds it to the end, and Delete removes it, with Undo. A saved chord keeps its roman numeral and what was typed, but not its id, pin or being hidden.
- The progression's name (`title`) is the preset's when one is loaded, or added to an empty progression; Clear, or typing chords into an empty progression, clears it. So Save offers the name of what's on screen, and saving a loaded preset of your own again, changed, replaces it.
- A chord's row shows its color, its name as written (Cmaj9, though it's voiced as Cmaj7), its roman numeral, "voiced as Cmaj7" when its voicings are another chord's (`voicedAs`, not in Chord tones), all its notes and its pinned frets. Under the mouse it shows Hide / Show and Remove. Toasts, the legend, the path and My presets name chords as written too.
- At the end of the notes' line, under the row's buttons' line so they don't cover it, the chord's **length** (`chord.beats`, see [theory.md](theory.md#lengths)): half a bar to four bars, for the staff and the player. It reads as plain text until the mouse is on it. A new chord lasts a bar; ready-made progressions give the I (or i) of a ii–V–I two. My presets keep lengths and scales.
- **Dragging a row moves the chord** (`initChordDrag`, pointer events rather than HTML drag and drop, which Tauri's own file drop handling stops on Windows). A press that moves less than 4 px stays a click. The row follows the pointer, raised, and a line in the accent color shows where it will go: before the first row whose middle is below the pointer. Releasing moves it there (`moveChordTo`); `Esc` puts it back. Colors stay with the places, not the chords, so the chord that becomes first turns blue. A double-click on the name puts a field in its place; Enter or leaving the field reads it, `Esc` cancels. A new chord loses the roman numeral and the pin.
- **Remove**, **Clear**, loading a preset, and replacing or deleting a saved one show a toast with **Undo** (also `Z`) instead of asking first, as in Unified Mail.

## Keyboard

| Key | Action |
| --- | --- |
| `1` / `2` / `3` / `4` | Drop 2 / Drop 3 / Drop 2&4 / Chord tones |
| `V` | Stacked or Overlay |
| `N` | Intervals or Notes |
| `L` | Voice leading |
| `S` | Scales |
| `Space` | Play or stop (not while a button or a select has the focus: Space is theirs) |
| `A` | Focus Add chords |
| `Z` | The toast's action (Undo) while it shows |
| `Esc` | Close Settings; otherwise unpin everything |

Shortcuts don't act while typing in a field or with Cmd, Ctrl or Alt held. With a Latin layout they go by the character typed; with any other, such as Russian, by the key's position (`e.code`), so `V` works whichever layout is on.

In the app, a right-click shows no menu: the web view's own (Back, Reload, Print) means nothing there. Text fields keep it, for Cut, Copy and Paste, and with Shift held it shows anywhere, which gives Inspect in the test app. A page in a browser keeps its menu.

## Settings

A card over the window, closed by its ×, `Esc` or a click outside it.

- **Appearance:** System, Light or Dark. `set_theme` sets the window's theme, which is also what the page's `prefers-color-scheme` reports, and saves it; the page sets `data-theme` at once as well, which is all a plain browser has. At launch Rust creates the window already in the saved theme (`"create": false` in the config).
- **Left-handed:** the nut on the right.
- **Open strings:** voicings that use open strings, near the nut, and with All notes the open strings' notes. On by default.
- The version, from `app.getVersion`, and links as in Unified Mail: GitHub, Releases, Website, Privacy policy and Support (the website's pages, see [development.md](development.md#website)). They open in the browser through `open_external`.
- **Update to X**, an orange pill next to the version, when GitHub has a newer release (`checkForUpdate`: 10 s after launch, every 6 hours, and on opening Settings; a failed check stays quiet). The Settings button then has an orange dot and says which version is out. A click shows "Updating…" while `install_update` downloads and installs it; the app then closes and comes back as the new version. A failure shows in a toast, and the app looks for the update again. See [development.md](development.md#updates).
