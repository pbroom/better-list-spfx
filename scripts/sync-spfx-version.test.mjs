import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  bumpPatchVersion,
  compareStableVersions,
  inspectVersions,
  nextPatchVersion,
  readPackageVersion,
  setNewerVersion,
  syncSpfxVersion,
} from './sync-spfx-version.mjs';

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createFixture(version = '0.2.9') {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-version-test-'));
  await mkdir(path.join(rootDir, 'config'));
  await Promise.all([
    writeJson(path.join(rootDir, 'package.json'), {
      name: 'better-list-spfx',
      version,
    }),
    writeJson(path.join(rootDir, 'package-lock.json'), {
      name: 'better-list-spfx',
      version,
      packages: { '': { name: 'better-list-spfx', version } },
    }),
    writeJson(path.join(rootDir, 'config', 'package-solution.json'), {
      solution: {
        version: `${version}.0`,
        features: [{ version: `${version}.0` }, { version: `${version}.0` }],
      },
    }),
  ]);
  return rootDir;
}

test('compares stable semantic versions and increments the patch component', () => {
  assert.equal(compareStableVersions('0.2.0', '0.1.11'), 1);
  assert.equal(compareStableVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareStableVersions('1.0.0', '1.0.1'), -1);
  assert.equal(nextPatchVersion('0.2.9'), '0.2.10');
  assert.throws(() => nextPatchVersion('0.2.0-beta.1'), /stable SemVer/);
});

test('reads and validates a package version from standard input', async () => {
  assert.equal(
    await readPackageVersion(Readable.from(['{"name":"better-list-spfx","version":"0.2.10"}'])),
    '0.2.10',
  );
  await assert.rejects(
    readPackageVersion(Readable.from(['{"version":"0.2.10-beta.1"}'])),
    /stable SemVer/,
  );
});

test('patch bump updates every canonical npm and SPFx version', async () => {
  const rootDir = await createFixture();
  try {
    const state = await bumpPatchVersion(rootDir);
    assert.equal(state.version, '0.2.10');
    assert.equal(state.packageLock.version, '0.2.10');
    assert.equal(state.packageLock.packages[''].version, '0.2.10');
    assert.equal(state.solutionConfig.solution.version, '0.2.10.0');
    assert(
      state.solutionConfig.solution.features.every(
        (feature) => feature.version === '0.2.10.0',
      ),
    );
    assert.deepEqual(state.errors, []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('explicit minor or major versions can be synchronized in one operation', async () => {
  const rootDir = await createFixture('0.2.10');
  try {
    const state = await setNewerVersion('1.0.0', rootDir);
    assert.equal(state.version, '1.0.0');
    assert.deepEqual(state.errors, []);
    await assert.rejects(setNewerVersion('0.9.0', rootDir), /must be newer than 1\.0\.0/);
    assert.equal((await inspectVersions(rootDir)).version, '1.0.0');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('inspection reports drift and bump refuses an inconsistent starting point', async () => {
  const rootDir = await createFixture();
  try {
    const lockPath = path.join(rootDir, 'package-lock.json');
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    lock.packages[''].version = '0.2.8';
    await writeJson(lockPath, lock);
    const state = await inspectVersions(rootDir);
    assert.match(state.errors.join('\n'), /root package version is 0\.2\.8/);
    await assert.rejects(bumpPatchVersion(rootDir), /Cannot bump inconsistent versions/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('SPFx-only synchronization repairs solution drift but refuses canonical drift', async () => {
  const rootDir = await createFixture();
  try {
    const solutionPath = path.join(rootDir, 'config', 'package-solution.json');
    const solution = JSON.parse(await readFile(solutionPath, 'utf8'));
    solution.solution.version = '0.2.8.0';
    solution.solution.features[0].version = '0.2.8.0';
    await writeJson(solutionPath, solution);

    const repaired = await syncSpfxVersion(rootDir);
    assert.deepEqual(repaired.errors, []);

    const lockPath = path.join(rootDir, 'package-lock.json');
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    lock.version = '0.2.8';
    await writeJson(lockPath, lock);
    await assert.rejects(syncSpfxVersion(rootDir), /Canonical version files are inconsistent/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
