# Development

## Requirements

- [Rust](https://rustup.rs) stable. `rustup` installs it into `~/.cargo/bin`; open a new terminal so it's on `PATH`.
- Node.js 18+, for the Tauri CLI (`@tauri-apps/cli`) and the theory tests.
- Windows: MSVC Build Tools and WebView2 (preinstalled on Windows 10/11).
- macOS: Xcode Command Line Tools.

There are no secrets or accounts to set up.

## Commands

Install the Tauri CLI:

```bash
npm install
```

Run with hot reload (edits to `src/` reload the page; Rust changes rebuild the app):

```bash
npm run dev
```

This runs as a separate test app, **Jazz Guitar Drop Helper (test)**, with its own data folder (`tauri.dev.conf.json`), so it never changes the progression saved by an installed copy. It replaces the whole `windows` list of `tauri.conf.json`, so it repeats `"create": false`: without that, Tauri would create the window and so would `main.rs`, and the app wouldn't start.

Release build with installers in `src-tauri/target/release/bundle/`:

```bash
npm run build
```

Release executable only, no installers (quick size check):

```bash
npx tauri build --no-bundle
```

The first `npm run build` on Windows downloads the NSIS and WiX installer tools. Build macOS bundles on a Mac, or with the Release workflow.

## Tests

The music theory (`src/theory.js`), with Node's own test runner:

```bash
npm test
```

The Rust side (`settings.json`):

```bash
cd src-tauri && cargo test
```

Every rule in `theory.js` has a test. When a voicing looks wrong, add the shape players know as a test first (`x x 0 2 1 1` is Dm7 Drop 2), then fix it.

## Trying the page in a browser

The page runs without Tauri: with no `window.__TAURI__`, `app.js` keeps its state in `localStorage` and Settings → Appearance only changes the page. To try layout and behavior in any browser:

```bash
npm run serve
```

and open <http://localhost:5178>. The title bar's buttons don't show there. To start over, clear the site's data or run `localStorage.clear()` in the console.

## Size budget

The app should stay small, as Unified Mail does. Current numbers on Windows x64:

| Build | Size |
| --- | --- |
| `jazz-guitar-drop-helper.exe` release | 3.0 MB |

The release profile in `Cargo.toml` is tuned for size: `opt-level = "s"`, `lto`, `codegen-units = 1`, `panic = "abort"`, `strip`. Before adding a crate or plugin, check what it adds with `npx tauri build --no-bundle`.

## Releases (GitHub Actions)

[`.github/workflows/release.yml`](../.github/workflows/release.yml) builds and publishes a release in one click, as Unified Mail's does, without its signing and updater steps. It needs no secrets.

**To release:** **Actions → Release → Run workflow**, choose what to raise, and run it:

| Choice | From 1.2.3 | Use for |
| --- | --- | --- |
| `patch` (default) | 1.2.4 | Fixes |
| `minor` | 1.3.0 | New features |
| `major` | 2.0.0 | Big changes |

Or type an exact version. **The first release needs `0.1.0` typed in**: with no release yet, `patch` would give 0.0.1, which is older than `package.json`, and the workflow refuses it.

What it does:

1. **Prepare** runs the theory tests, works out the version from the highest `vX.Y.Z` tag (`scripts/next-version.mjs`), writes it into `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock` (`scripts/set-version.mjs`), moves CHANGELOG.md's **Unreleased** lines under the version (`scripts/changelog.mjs`), commits and pushes that as "Release vX.Y.Z", and creates a draft release with those lines as What's new.
2. **Build** makes the Windows installers (NSIS `.exe` and `.msi`) and one universal macOS `.dmg` for Apple Silicon and Intel, and uploads them to the draft.
3. **Publish** publishes the release once every installer is there, so a release is never half-empty. A failed run leaves the draft; run it again with the same version.

The Mac app gets an ad-hoc signature (`"signingIdentity": "-"`), which Apple Silicon needs to run it. It isn't notarized, so macOS asks once at first launch (README → First launch). Unified Mail signs with its own certificate so the keychain keeps trusting it across updates; this app uses no keychain, so it doesn't need that.

## Screenshots

The README's screenshots (`docs/images/screenshot-light.png` and `screenshot-dark.png`) are rendered from `src/` in headless Edge or Chrome, at 1280 × 820 and twice the pixels, with the ii–V–I in C and a voice-led path pinned in the middle of the neck:

```bash
node scripts/screenshots.mjs
```

It needs Node 22 or newer for its WebSocket; on Node 21, add `--experimental-websocket`. Set `BROWSER` to the browser's path if it isn't found. Render them again after a visible UI change.

## App icon

The icon is drawn in [`app-icon.svg`](../app-icon.svg): a white chord diagram (nut, three frets, four strings) with a Drop 2 shape of four dots, on an amber tile with a wide rim, like Unified Mail's envelope on blue. The same drawing is the sidebar logo in `src/index.html`; change both together.

To regenerate the app's icon files after changing it:

```bash
npx tauri icon app-icon.svg -o <a temp folder>
```

Then copy only the files `src-tauri/icons/` already has: `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.ico` and `icon.icns`. The tool also makes Android, iOS and Windows Store icons, which this app doesn't use.

## Debugging

- `Ctrl+Shift+I` (`Cmd+Option+I` on macOS) opens devtools in dev builds.
- Release builds on Windows have no console (`windows_subsystem = "windows"`).
- To inspect a running build from outside, start it with WebView2's debugging port, then use any CDP client (`http://127.0.0.1:9333/json/list`):

  ```bash
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 src-tauri/target/debug/jazz-guitar-drop-helper.exe
  ```

- Clear the app's state by deleting its data folder (see [architecture.md](architecture.md#storage)).

## Manual test checklist

Before a release, on Windows and macOS:

- First launch shows ii–V–I in C, Drop 2 on strings 4-3-2-1, three boards.
- Type `Bbmaj9 Eø A7b9 H7` in Add chords: three chords are added (B♭maj7 "from Bbmaj9", Em7♭5, A7 "from A7b9"), `H7` stays in the field with a message.
- Drop 3 and Drop 2&4 show their own string sets; double-click a set or an inversion shows only it.
- Point at a dot and at a line: the voicings light up, the fret is shaded on every board, the heading shows inversion and frets. Click: pinned, frets under the chord in the sidebar.
- Voice leading on, click a Dm7 voicing: G7 and Cmaj7 follow on the same strings. Add a chord: it follows too. `Esc` clears.
- Overlay: one board, chords side by side where they share a spot, the path under the board.
- Remove a chord and Clear, then Undo (button and `Z`).
- Settings: Light / Dark / System change the window and the page; 24 frets, left-handed and open strings off redraw the boards.
- Quit and start again: progression, choices, pins and appearance are kept.
- Windows: drag the window by the toolbar and the brand, double-click to maximize, the three buttons work and dim when the window is in the background. macOS: the window buttons sit on the toolbar's first row; in full screen the brand moves up.
