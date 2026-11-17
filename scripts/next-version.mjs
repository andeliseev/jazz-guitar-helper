// Works out the version to release. Run from the repo root:
//   node scripts/next-version.mjs patch          (or minor, major)
//   node scripts/next-version.mjs patch 0.2.0    (an exact version wins over the bump)
// The last release is the highest vX.Y.Z tag on GitHub. Release tags only appear once a release
// is published, so a run that failed is simply retried and gets the same version. The rules are
// TorrStream Lite's (its scripts/release.py): the first release is package.json's version, and a
// later one never goes below it either. Prints `last=` and `version=` lines, as the Release
// workflow (.github/workflows/release.yml) reads them. tests/release.test.mjs tests nextVersion.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// MSI installers only accept numeric versions, so no "-beta" suffixes.
const parse = (text) => /^(\d+)\.(\d+)\.(\d+)$/.exec(text ?? '')?.slice(1).map(Number) ?? null;
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The highest vX.Y.Z among `tags`, as [major, minor, patch], or null before the first release. */
export function lastRelease(tags) {
  const versions = tags.map((tag) => (tag.startsWith('v') ? parse(tag.slice(1)) : null)).filter(Boolean);
  return versions.sort(compare).pop() ?? null;
}

/**
 * The version to release, as { last, version }: `exact` when given; for the first release,
 * package.json's version (`current`); after that the last release raised by `bump`, but never
 * below `current`, which a run that committed but didn't publish may have left ahead. Throws a
 * message for people when the version would go backwards.
 */
export function nextVersion(current, tags, bump = 'patch', exact = '') {
  const source = parse(current);
  if (!source) throw new Error(`package.json's version must look like 1.2.3, got: ${current}`);
  const last = lastRelease(tags);
  let next;
  if (exact) {
    next = parse(exact);
    if (!next) throw new Error(`The version must look like 1.2.3, got: ${exact}`);
  } else if (!last) {
    next = source;
  } else {
    const raised = { major: [last[0] + 1, 0, 0], minor: [last[0], last[1] + 1, 0], patch: [last[0], last[1], last[2] + 1] }[bump];
    if (!raised) throw new Error(`Choose patch, minor or major, got: ${bump || '(nothing)'}`);
    next = compare(raised, source) >= 0 ? raised : source;
  }
  if (last && compare(next, last) <= 0) {
    throw new Error(`${next.join('.')} isn't newer than the last release, ${last.join('.')}.`);
  }
  if (compare(next, source) < 0) {
    throw new Error(`package.json is already at ${current}, newer than ${next.join('.')}. Enter ${current} or higher as the version.`);
  }
  return { last: last ? last.join('.') : 'none', version: next.join('.') };
}

// Run as a script; the tests import the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [bump, exact] = process.argv.slice(2);
  try {
    const tags = execSync('git ls-remote --tags origin', { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.split('refs/tags/')[1] ?? '')
      .filter(Boolean);
    const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const { last, version } = nextVersion(current, tags, bump, exact);
    console.log(`last=${last}`);
    console.log(`version=${version}`);
  } catch (e) {
    console.error((process.env.GITHUB_ACTIONS ? '::error::' : '') + e.message);
    process.exit(1);
  }
}
