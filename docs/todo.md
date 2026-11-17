# To do / ideas for later

## Not verified yet

- The macOS build: the title bar (window buttons centered on the toolbar's first row, the brand under them, full screen), WKWebView rendering of the SVG boards, and the `.dmg` from the Release workflow. Everything so far was checked on Windows 11 (WebView2) and in Chromium.
- The Release workflow hasn't run yet. The first release needs the exact version `0.1.0` and the updater's two secrets (see [development.md](development.md#releases-github-actions)).
- Updates end to end: no release has been updated from yet. The first real test is 0.1.0 updating to the next version, on Windows and macOS (the relaunch after a Mac update is Unified Mail's, which works there). The Mac app is only ad-hoc signed, while Unified Mail updates itself with its own certificate. If macOS asks anything when this app updates itself, sign it with that certificate the way Unified Mail's workflow does (its `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` secrets, rcodesign, `signingIdentity` in `tauri.release.conf.json`).
- Windows 10: the window buttons' glyphs fall back to Segoe MDL2 Assets there.

## Gaps in current features

- Voice leading is greedy from the anchor; it doesn't search for the best path over the whole progression, and never changes string set. A "best path" option could compare all starting voicings.
- Voice leading needs every chord on the anchor's strings; with several string sets shown it stays on the anchor's.
- A chord can only be changed by typing its symbol again (double-click). A menu of qualities and roots, and dragging chords to reorder them, would be quicker.
- Chords that aren't one of the twelve qualities are shown as the nearest one (Cmaj9 as Cmaj7). The extensions themselves aren't voiced.
- Dots aren't reachable from the keyboard; pinning needs a mouse.
- The window's size and position aren't remembered between launches.

## New features

- **Extensions in drop voicings:** the usual jazz substitutions, 9 for the root, 13 for the 5th, ♭9/♯9 on dominants, and rootless voicings, each as its own quality with the tone it replaces shown.
- **Melody on top:** filter voicings by their top note (chord melody), and show the top voice's line through the progression.
- **More voicing types:** close position on the top strings, Drop 2&3, shell voicings (R 3 7, R 7 3), triads and their inversions on each string set, spread triads.
- **Drop types together:** the way many teachers present them, Drop 2 with the bass on the 4th and 5th strings and Drop 3 with it on the 6th, on one fretboard. Today a view shows one drop type at a time.
- **Hear it:** play a voicing or the pinned path with Web Audio (a plucked-string sound), no samples needed.
- **Export:** the pinned path as chord diagrams (SVG or PNG) or as tab, to print or paste.
- **Other tunings:** 7-string, DADGAD, drop D, baritone; the theory takes the tuning as a parameter already except for `TUNING`.
- Save several progressions by name, and import a chart (iReal Pro link or a text file).
- Scale degrees as labels relative to the key (for ii–V–I: the chord tones as degrees of C).
- A Russian interface.

## Distribution

- **Code signing:** the Windows SmartScreen and macOS Gatekeeper warnings at first launch go away only with paid certificates (and notarization on macOS).
- The website's Download link goes to the GitHub Releases page, which is empty until the first release.

## Code quality

- `app.js` tests: the page has none yet. A small Node test with a fake DOM for `sanitize()` and the pin logic would catch regressions in saved state.
- A test that the SVG markup's labels stay escaped if user text ever reaches it (today only the app's own labels do).
