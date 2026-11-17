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

This runs as a separate test app, **Jazz Guitar Helper (test)**, with its own data folder (`tauri.dev.conf.json`), so it never changes the progression saved by an installed copy. It replaces the whole `windows` list of `tauri.conf.json`, so it repeats `"create": false`: without that, Tauri would create the window and so would `main.rs`, and the app wouldn't start.

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

The music theory (`src/theory.js`) and the Release workflow's version rule (`scripts/next-version.mjs`), with Node's own test runner:

```bash
npm test
```

The Rust side (`settings.json`):

```bash
cd src-tauri && cargo test
```

Every rule in `theory.js` has a test. When a voicing looks wrong, add the shape players know as a test first (`x x 0 2 1 1` is Dm7 Drop 2), then fix it.

`npm test` names the test files (`node --test tests/theory.test.mjs tests/release.test.mjs`); add a new test file to it. A pattern like `tests/*.test.mjs` works only from Node 21, and the Release workflow runs the tests on Node 20, where it fails with "Could not find".

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
| `jazz-guitar-helper.exe` release, first version | 3.0 MB |
| `jazz-guitar-helper.exe` release, with the links in Settings (`open` crate, +27 KB) | 3.1 MB |
| `jazz-guitar-helper.exe` release, with updates (`tauri-plugin-updater` and the HTTP client it brings, on the OS's TLS, +603 KB) | 3.6 MB |

The release profile in `Cargo.toml` is tuned for size: `opt-level = "s"`, `lto`, `codegen-units = 1`, `panic = "abort"`, `strip`. Before adding a crate or plugin, check what it adds with `npx tauri build --no-bundle`.

## Releases (GitHub Actions)

[`.github/workflows/release.yml`](../.github/workflows/release.yml) builds and publishes a release in one click. It's Unified Mail's, without its Google client and Mac signing steps, and with TorrStream Lite's two fixes: the first release takes `package.json`'s version, and nothing is committed until every installer is built.

**One-time setup:** in the GitHub repo, open **Settings → Secrets and variables → Actions → New repository secret** and add the updater's signing key, the same one Unified Mail uses (see [Updates](#updates)):

| Secret | Value |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | The whole content of the private key file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | That key's password |

The workflow refuses to run without the key, so a release can never go out without its update files.

**To release:** **Actions → Release → Run workflow**, choose what to raise, and run it:

| Choice | From 1.2.3 | Use for |
| --- | --- | --- |
| `patch` (default) | 1.2.4 | Fixes |
| `minor` | 1.3.0 | New features |
| `major` | 2.0.0 | Big changes |

Or type an exact version. The version comes from `scripts/next-version.mjs`, by TorrStream Lite's rules:

- The last release is the highest `vX.Y.Z` tag on GitHub. Tags appear only when a release is published.
- **The first release is `package.json`'s version** (0.1.0), whatever is chosen above, unless an exact version is typed.
- After that, the last release raised as chosen, but never below `package.json`'s version: a run that pushed its release commit and then failed to publish is simply run again and gets the same version.
- A version that isn't newer than the last release, or is below `package.json`'s, is refused with a message saying what to enter.

What it does:

1. **Prepare** checks that it runs from `main` and that the signing key is there, runs the tests, works out the version, and creates a draft release with CHANGELOG.md's **Unreleased** lines as What's new (`scripts/changelog.mjs`). It commits nothing; a draft left by an earlier failed run of the same version is replaced, and a version already published is refused.
2. **Build** writes the version into `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock` in its own checkout (`scripts/set-version.mjs`), as the release commit will have them, makes the Windows installers (NSIS `.exe` and `.msi`) and one universal macOS `.dmg` for Apple Silicon and Intel, with their signed update files and `latest.json`, and uploads them to the draft.
3. **Publish**, only once every installer is there, commits the version and the changelog as "Release vX.Y.Z", authored by whoever started the release, pushes it to `main`, and publishes the release with its tag on that commit. So a failed run leaves `main` as it was and no half-empty release; run it again. If something was pushed to `main` while it ran, the push is refused: run the release again, so the installers are of the newest code.

The Mac app gets an ad-hoc signature (`"signingIdentity": "-"`), which Apple Silicon needs to run it. It isn't notarized, so macOS asks once at first launch (README → First launch). Unified Mail signs with its own certificate so the keychain keeps trusting it across updates; this app uses no keychain, so it doesn't need that.

## Updates

Installed apps update themselves with `tauri-plugin-updater`, set up as in Unified Mail (`src-tauri/src/update.rs`):

1. The app checks `https://github.com/andeliseev/jazz-guitar-helper/releases/latest/download/latest.json` (`plugins.updater.endpoints` in `tauri.conf.json`): 10 seconds after it starts, every 6 hours, and when Settings opens. The address only resolves once a release is published, so drafts are never offered, and a failed check stays quiet.
2. If that version is newer, Settings shows **Update to X** next to the version, and the Settings button gets a dot.
3. Clicking it downloads that platform's installer and checks its signature against `plugins.updater.pubkey`. Then:
   - **Windows:** runs the installer passively (`installMode: passive`), with no installer pages, and it starts the app again when done. The installer is picked to match the install: `windows-x86_64-nsis` or `windows-x86_64-msi`.
   - **macOS:** replaces the app and quits; a small shell command waits until this copy is gone, also from LaunchServices' list, then opens the app again (`relaunch_after_exit`, Unified Mail's), so it doesn't come back as a second Dock icon.

**The signing key is Unified Mail's.** `plugins.updater.pubkey` holds the same public key, and the repository secrets above hold its private key and password: each app only ever reads its own repository's `latest.json`, so one key serves both. Keep the private key and password backed up: without them, installed apps can't accept new updates. Never commit a key; `*.key` is git-ignored.

**Where the files come from:** the workflow builds with `--config src-tauri/tauri.release.conf.json`, which turns on `bundle.createUpdaterArtifacts`. The installers are signed with the `TAURI_SIGNING_PRIVATE_KEY` secret, the signatures go into `latest.json` (the separate `.sig` files aren't uploaded), and `tauri-action` merges the Windows and macOS entries into one `latest.json`. A local `npm run build` makes no update files, so it doesn't need the key.

**The test app never updates:** `tauri.dev.conf.json` sets an empty endpoint list, so `npm run dev` can't install a real release; its checks fail quietly.

**To try the update flow locally**, without GitHub, follow Unified Mail's docs/development.md#updates: a throwaway key, a local `latest.json` naming a higher version, and the test app started with an extra config pointing `plugins.updater` at them (`dangerousInsecureTransportProtocol: true`).

## Screenshots

The README's screenshots (`docs/images/screenshot-light.png` and `screenshot-dark.png`) are rendered from `src/` in headless Edge or Chrome, at 1280 × 820 and twice the pixels, with the ii–V–I in C and a voice-led path pinned in the middle of the neck:

```bash
node scripts/screenshots.mjs
```

It needs Node 22 or newer for its WebSocket; on Node 21, add `--experimental-websocket`. Set `BROWSER` to the browser's path if it isn't found. Render them again after a visible UI change, and copy them to the [website](#website) too.

## Website

The app's home page, privacy policy and support page are in their own repository, [andeliseev/andeliseev.github.io](https://github.com/andeliseev/andeliseev.github.io), in `jazz-guitar-helper/`, next to Unified Mail's and TorrStream Lite's. GitHub Pages serves it. Clone it next to this one; its README and CLAUDE.md say how to change and publish it: commit and push `main`.

| Page | URL |
| --- | --- |
| Home | https://andeliseev.github.io/jazz-guitar-helper/ |
| Privacy policy | https://andeliseev.github.io/jazz-guitar-helper/privacy.html |
| Support (Steam wishlist gifts and crypto donations) | https://andeliseev.github.io/jazz-guitar-helper/support.html |

Settings links to all three, and GitHub's Sponsor button (`.github/FUNDING.yml`) to the Support page. The home page shows the README's screenshots (`screenshot-light.png`, `screenshot-dark.png`) and the app icon as `favicon.svg`.

Go there when:

- the UI changes visibly: render the screenshots again and copy them;
- what the app connects to or keeps changes: update `privacy.html` and its effective date;
- the [app icon](#app-icon) changes: update `favicon.svg`.

## App icon

The icon is drawn in [`app-icon.svg`](../app-icon.svg): a white chord diagram (nut, three frets, four strings) with a Drop 2 shape of four dots, on an amber tile with a wide rim, like Unified Mail's envelope on blue. The same drawing is the sidebar logo in `src/index.html` and the website's `jazz-guitar-helper/favicon.svg`; change all three together.

To regenerate the app's icon files after changing it:

```bash
node scripts/icons.mjs
```

It runs the Tauri CLI's `icon` command twice and copies only the files `src-tauri/icons/` has (the CLI also makes Android, iOS and Windows Store icons, which this app doesn't use):

- **macOS and the PNGs** (`icon.icns`, `32x32.png` … `icon.png`) from `app-icon.svg` as it is. macOS draws app icons on a grid with room around the tile, and the drawing's tile, 20 of its 24 units, fits that grid.
- **Windows** (`icon.ico`: the taskbar, the window, the `.exe` and the installers) from the same drawing scaled 1.2 times, so the tile fills its square. Windows shows icons as they are, and with the room around it the icon looked smaller than other apps' in the taskbar.

`build.rs` tells Cargo to rebuild when `icons/icon.ico` changes: tauri-build embeds it in the `.exe` but watches only `tauri.conf.json` and `capabilities/`, so a new icon used to need a clean build. The macOS `.icns` encoder isn't byte-for-byte repeatable; when only the Windows icon changed, keep the committed `icon.icns` (`git checkout -- src-tauri/icons/icon.icns`).

## Debugging

- `Ctrl+Shift+I` (`Cmd+Option+I` on macOS) opens devtools in dev builds.
- Release builds on Windows have no console (`windows_subsystem = "windows"`).
- To inspect a running build from outside, start it with WebView2's debugging port, then use any CDP client (`http://127.0.0.1:9333/json/list`):

  ```bash
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 src-tauri/target/debug/jazz-guitar-helper.exe
  ```

- Clear the app's state by deleting its data folder (see [architecture.md](architecture.md#storage)).

## Manual test checklist

Before a release, on Windows and macOS:

- First launch shows ii–V–I in C, Drop 2 on strings 4-3-2-1, three boards.
- Type `Bbmaj9 Eø A7b9 H7` in Add chords: three chords are added (B♭maj7 "from Bbmaj9", Em7♭5, A7 "from A7b9"), `H7` stays in the field with a message.
- Type `Dm`: suggestions Dm7 to Dm11. ↓ ↓ Enter adds Dm7♭5; `G7b` then Tab gives `G7♭5 ` and the list closes; a click on a suggestion adds it; `Esc` closes the list, a second `Esc` leaves the field.
- Click I–vi–ii–V under Presets: it replaces the progression; Undo brings it back. Its + adds it to the end.
- Save, a name, Enter: it's under My presets. Clear, click it: it's back. Save it again under the same name: replaced, with Undo. Delete, then Undo.
- Drop 3 and Drop 2&4 show their own string sets; double-click a set or an inversion shows only it.
- Point at a dot and at a line: the voicings light up, the fret is shaded on every board, the heading shows inversion and frets. Click: pinned, frets under the chord in the sidebar.
- Voice leading on, click a Dm7 voicing: G7 and Cmaj7 follow on the same strings. Add a chord: it follows too. `Esc` clears.
- Overlay: one board, chords side by side where they share a spot, the path under the board.
- All notes: outlined dots for every other note of each chord on all six strings; they don't react to the mouse. Height: the boards follow the slider; Stacked and Overlay keep their own; double-click resets.
- Settings: each link opens in the browser.
- Remove a chord and Clear, then Undo (button and `Z`).
- Settings: Light / Dark / System change the window and the page; left-handed and open strings off redraw the boards. Frets 24, next to Height, does too.
- Quit and start again: progression, My presets, choices, pins and appearance are kept.
- Windows: drag the window by the toolbar and the brand, double-click to maximize, the three buttons work and dim when the window is in the background. macOS: the window buttons sit on the toolbar's first row; in full screen the brand moves up.
