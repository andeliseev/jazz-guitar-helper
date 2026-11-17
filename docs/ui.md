# UI

Plain HTML/CSS/JS in `src/`, with no framework and no build step. `withGlobalTauri` exposes `window.__TAURI__`, so there's no npm package for the API either. The design follows [Unified Mail](https://github.com/andeliseev/unified-mail): the same tokens, type scale, outlined buttons, segmented controls, card dialogs and toast, and the app's own title bar. Its accent is amber instead of blue, as TorrStream Lite has its own green.

| File | Contents |
| --- | --- |
| `index.html` | The sidebar, the toolbar, the fretboards' pane and the empty state, Settings, the toast, the Windows window buttons |
| `styles.css` | Theme tokens on `:root` (light), the dark palette under `prefers-color-scheme: dark` and `data-theme="dark"`, layout, the fretboard |
| `app.js` | State, rendering, events, saving, the title bar |
| `fretboard.js` | SVG markup for boards, notes, voicing shapes and fret numbers |
| `theory.js` | The music theory (see [theory.md](theory.md)) |

## Layout

`#app` is a two-column grid: a 264 px sidebar and the main pane. Its single row is `minmax(0, 1fr)` so the fretboards scroll inside the window.

- **Sidebar:** the brand, **Progression** (a row per chord, then **Add chords**), **Quick add** (a key and the ready-made progressions), and Settings at the bottom. It scrolls when the progression is long.
- **Toolbar:** two rows. The first chooses what's voiced: the drop type (segmented), the string sets and the inversions (chips that are on or off). The second chooses how it's shown: Intervals or Notes, Stacked or Overlay, and Voice leading. When the pane is wide enough, the second row sits beside the first.
- **Fretboards** (`#boards`): fret numbers on top, sticky while the boards scroll, then a board per chord (Stacked) or one board for all (Overlay). With no chord to show, an empty state says why, with a button that adds a ii–V–I.

The window's minimum size is 960 × 560 (`tauri.conf.json`). Boards always fill the pane's width; a new width redraws them, and in Overlay a new height too (`ResizeObserver`).

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
- **Dots:** one per chord per spot, in the chord's color, labeled with the tone's interval or note name. The root is a rounded square so it stands out without color. Where several chords have a note on the same spot (Overlay), their dots stand side by side in chord order, smaller if the fret is narrow; below a 6.5 px radius a dot has no label.

Each shape and dot carries `data-v`, the voicings it belongs to (`<chord id>~<voicing id>`), which is all the mouse handling needs.

The fret numbers sit above the boards in their own SVG, the inlay frets darker. Moving the mouse over the boards shades the fret under it on every board (`.band`) and its number turns amber, so in Stacked you can follow one position down through all the chords.

## Views

- **Stacked:** a board per chord, 20 px between strings, headed by the chord's name, notes and roman numeral. On the right of the heading, the voicing under the mouse or the pinned one: inversion and frets. A click on a chord in the sidebar scrolls its board into view.
- **Overlay:** one board for all the chords, between 30 and 40 px between strings depending on the window's height. A legend above names each chord with its pinned frets; the line below shows the voicing under the mouse, or the pinned path (`Dm7 x x 3 5 3 5 → G7 x x 3 4 3 3 → …`).

## Pins and voice leading

- **Pointing** at a dot lights up every voicing that uses that note; at a line, that voicing. The board's other voicings fade.
- **Clicking** a line pins its voicing for that chord (`state.ui.pins`, chord id → voicing id); clicking it again unpins it. Clicking a note pins the first voicing using it, then the next one at each click, then none.
- A chord with a pin dims its other voicings; the pinned one keeps a strong line and outlined dots. Its frets show under the chord in the sidebar.
- **Voice leading** on: the chord last clicked is the `anchor`, and every render takes the other chords' pins from `voiceLead` (see [theory.md](theory.md#voice-leading)). So adding a chord, hiding one or changing the string sets keeps the path following the anchor. Unpinning anything clears the whole path, since it all comes from one voicing.
- Pins are voicing ids, which include the drop type and strings, so a pin only shows while its voicing is drawn, and comes back when it is again.
- `Esc` unpins everything.

## The progression

- **Add chords** reads the field with `parseChords`; what doesn't read stays in the field and a toast says what it was.
- **Quick add** appends a ready-made progression in the chosen key; the buttons' tooltips say the key (C♯ minor for ii–V–i in D♭).
- A chord's row shows its color, name, roman numeral, what was typed when it's shown as the nearest chord ("from Cmaj9"), its notes and its pinned frets. Under the mouse it shows Hide / Show, Move up, Move down and Remove. A double-click on the name puts a field in its place; Enter or leaving the field reads it, `Esc` cancels. A new chord loses the roman numeral and the pin.
- **Remove** and **Clear** show a toast with **Undo** (also `Z`) instead of asking first, as in Unified Mail.

## Keyboard

| Key | Action |
| --- | --- |
| `1` / `2` / `3` | Drop 2 / Drop 3 / Drop 2&4 |
| `V` | Stacked or Overlay |
| `N` | Intervals or Notes |
| `L` | Voice leading |
| `A` | Focus Add chords |
| `Z` | The toast's action (Undo) while it shows |
| `Esc` | Close Settings; otherwise unpin everything |

Shortcuts don't act while typing in a field or with Cmd, Ctrl or Alt held. With a Latin layout they go by the character typed; with any other, such as Russian, by the key's position (`e.code`), so `V` works whichever layout is on.

## Settings

A card over the window, closed by its ×, `Esc` or a click outside it.

- **Appearance:** System, Light or Dark. `set_theme` sets the window's theme, which is also what the page's `prefers-color-scheme` reports, and saves it; the page sets `data-theme` at once as well, which is all a plain browser has. At launch Rust creates the window already in the saved theme (`"create": false` in the config).
- **Frets:** 12, 15 (the default), 17, 20, 22 or 24.
- **Left-handed:** the nut on the right.
- **Open strings:** voicings that use open strings, near the nut. On by default.
- The version, from `app.getVersion`.
