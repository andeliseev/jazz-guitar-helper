# Jazz Guitar Helper

[README.md](README.md) is for people using the app. Building, testing and releasing are in [docs/development.md](docs/development.md). Implementation notes are in [docs/](docs/README.md): architecture, the music theory, UI, and [todo.md](docs/todo.md) for known gaps and ideas.

## Commands

- `npm run dev`: run the app with hot reload, as the separate test app "Jazz Guitar Helper (test)"
- `npm test`: the music theory tests (`src/theory.js`) and the release version rule's (`scripts/next-version.mjs`); `cd src-tauri && cargo test`: the Rust tests. It lists its test files by name (the Release workflow's Node 20 doesn't expand `*`): add new ones there
- `npm run serve`: the page alone at http://localhost:5178, in any browser, keeping its state in localStorage
- `npx tauri build --no-bundle`: release exe only, for size checks
- `node scripts/screenshots.mjs`: render the README screenshots from `src/` (after a visible UI change)
- `node scripts/icons.mjs`: make `src-tauri/icons/` from `app-icon.svg` (the Windows icon scaled to fill its square)

## Working rules

- `src/` is plain HTML/CSS/JS (ES modules) served as is. Don't add a framework or build step.
- `src/theory.js` stays free of the DOM, and every rule it follows has a test in `tests/theory.test.mjs`. Before changing how voicings are built, check them against shapes players know (`x x 0 2 1 1` is a Dm7 drop 2).
- Rust only creates the window, keeps `settings.json`, opens links in the browser and installs updates. Music theory and drawing belong in the page.
- Updates are signed with Unified Mail's key (the same `plugins.updater.pubkey`; the private key and password are this repository's secrets). Never commit a key, and don't go looking for it on disk: the user keeps it.
- Small binary is a goal, as in Unified Mail: check what a new crate or plugin adds with `npx tauri build --no-bundle` and record it in [docs/development.md](docs/development.md#size-budget).
- The design follows Unified Mail's (tokens, type scale, outlined buttons, card dialogs, the app's own title bar) with an amber accent; see [docs/ui.md](docs/ui.md). `app-icon.svg` and the sidebar logo in `src/index.html` are the same drawing; change both.
- Messages shown to people are written for people.
- Commits are authored as `Andrei Eliseev <andeliseev@gmail.com>` (set in this repo's git config). Never add `Co-Authored-By` lines or any other Claude/AI attribution to commit messages, pull requests or release notes.
- `README.md` stays user-facing (download, first launch, use, privacy). Developer details go in `docs/`.
- The website (home page, privacy policy, support page) is in its own repository, [andeliseev.github.io](https://github.com/andeliseev/andeliseev.github.io), in `jazz-guitar-helper/` ([docs/development.md](docs/development.md#website)). After a visible UI change, render the screenshots again and copy them there; when what the app connects to or keeps changes, update the privacy policy there; when the app icon changes, its favicon too.
- When behavior changes, update the matching file in `docs/`. Add things you notice but don't do to `docs/todo.md`.
- Every change people using the app would notice gets a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md), written for them (what changed for them, not how), in the same commit. The Release workflow turns those lines into the release's notes. Changes only to docs, tests or the release tooling don't go there.
