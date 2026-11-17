// Sets the app version everywhere it's recorded. Run from the repo root:
//   node scripts/set-version.mjs 0.2.0
// Used by the Release workflow (.github/workflows/release.yml): in each build, so the installers
// carry the version, and in Publish, which commits it. A file already at that version is fine.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
// MSI installers only accept numeric versions, so no "-beta" suffixes.
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error(`Version must look like 1.2.3, got: ${version ?? '(nothing)'}`);
  process.exit(1);
}

// Replaces what `pattern` matches with its first group and the version: an unchanged file is fine
// (the first release keeps package.json's version), a missing version isn't.
function edit(path, pattern) {
  const before = readFileSync(path, 'utf8');
  if (!pattern.test(before)) throw new Error(`${path}: version not found`);
  writeFileSync(path, before.replace(pattern, `$1${version}"`));
}

// npm writes these as 2-space JSON with a trailing newline, so a round trip keeps the formatting.
for (const path of ['package.json', 'package-lock.json']) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json.version = version;
  if (json.packages?.['']) json.packages[''].version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

// Text replacements keep the hand-written formatting of these files.
edit('src-tauri/tauri.conf.json', /("version":\s*")[^"]+"/);
edit('src-tauri/Cargo.toml', /^(version\s*=\s*")[^"]+"/m);
edit('src-tauri/Cargo.lock', /(\[\[package\]\]\r?\nname = "jazz-guitar-helper"\r?\nversion = ")[^"]+"/);

console.log(`Version set to ${version}`);
