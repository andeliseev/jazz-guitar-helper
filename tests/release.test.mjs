// Tests for the Release workflow's version rule, scripts/next-version.mjs: node --test tests/release.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastRelease, nextVersion } from '../scripts/next-version.mjs';

test("the first release is package.json's version, whatever the bump", () => {
  assert.deepEqual(nextVersion('0.1.0', [], 'patch'), { last: 'none', version: '0.1.0' });
  assert.equal(nextVersion('0.1.0', [], 'minor').version, '0.1.0');
  assert.equal(nextVersion('0.1.0', [], 'major').version, '0.1.0');
  assert.equal(nextVersion('0.1.0', [], 'patch', '0.2.0').version, '0.2.0');
});

test('a later release raises the last one', () => {
  const tags = ['v0.1.0', 'v0.1.1', 'v0.1.1^{}', 'not-a-release', 'v0.1'];
  assert.deepEqual(nextVersion('0.1.1', tags, 'patch'), { last: '0.1.1', version: '0.1.2' });
  assert.equal(nextVersion('0.1.1', tags, 'minor').version, '0.2.0');
  assert.equal(nextVersion('0.1.1', tags, 'major').version, '1.0.0');
  assert.equal(nextVersion('0.1.1', tags, 'patch', '0.5.0').version, '0.5.0');
});

test('a version committed by a run that never published is used again', () => {
  assert.equal(nextVersion('0.1.2', ['v0.1.1'], 'patch').version, '0.1.2');
  assert.equal(nextVersion('0.3.0', ['v0.1.1'], 'patch').version, '0.3.0');
  assert.equal(nextVersion('0.3.0', ['v0.1.1'], 'major').version, '1.0.0');
});

test('refuses a version that goes backwards, and says why', () => {
  assert.throws(() => nextVersion('0.1.0', [], 'patch', '0.0.9'), /package\.json is already at 0\.1\.0/);
  assert.throws(() => nextVersion('0.1.1', ['v0.1.1'], 'patch', '0.1.1'), /isn't newer than the last release, 0\.1\.1/);
  assert.throws(() => nextVersion('0.1.0', [], 'patch', '1.2'), /must look like 1\.2\.3/);
  assert.throws(() => nextVersion('0.1.1', ['v0.1.1'], 'huge'), /Choose patch, minor or major/);
});

test('the last release is the highest version tag, not the last listed', () => {
  assert.deepEqual(lastRelease(['v0.9.0', 'v0.10.0', 'v0.2.5']), [0, 10, 0]);
  assert.equal(lastRelease([]), null);
  assert.equal(lastRelease(['latest', 'v1.0']), null);
});
