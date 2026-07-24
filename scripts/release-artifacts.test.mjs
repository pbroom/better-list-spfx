import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  prepareReleaseArtifacts,
  verifyReleaseArtifacts,
} from './release-artifacts.mjs';
import { syncSpfxVersion } from './sync-spfx-version.mjs';

const VERSION = '1.2.3';
const TAG = `v${VERSION}`;
const COMMIT = 'a'.repeat(40);
const SOURCE_DATE_EPOCH = 1_700_000_000;
const PRODUCT_ID = 'f1622b36-0843-4eb0-aca9-df6ac57a15c4';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createFixture({ placeholderCdn = false, sppkgVersion = `${VERSION}.0` } = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-test-'));
  await Promise.all([
    mkdir(path.join(rootDir, 'config'), { recursive: true }),
    mkdir(path.join(rootDir, 'release', 'assets', 'chunks'), { recursive: true }),
    mkdir(path.join(rootDir, 'release', 'assets', 'fonts', 'eb-garamond'), { recursive: true }),
    mkdir(path.join(rootDir, 'release', 'manifests'), { recursive: true }),
    mkdir(path.join(rootDir, 'sharepoint', 'solution'), { recursive: true }),
  ]);
  await Promise.all([
    writeJson(path.join(rootDir, 'package.json'), {
      name: 'better-list-spfx',
      version: VERSION,
    }),
    writeJson(path.join(rootDir, 'package-lock.json'), {
      name: 'better-list-spfx',
      version: VERSION,
      lockfileVersion: 3,
      packages: { '': { name: 'better-list-spfx', version: VERSION } },
    }),
    writeJson(path.join(rootDir, '.release-please-manifest.json'), { '.': VERSION }),
    writeJson(path.join(rootDir, 'config', 'package-solution.json'), {
      solution: {
        id: PRODUCT_ID,
        version: `${VERSION}.0`,
        features: [{ version: `${VERSION}.0` }],
      },
    }),
    writeJson(path.join(rootDir, 'config', 'write-manifests.json'), {
      cdnBasePath: placeholderCdn
        ? 'https://cdn.example.com/spfx/better-list-spfx/'
        : 'https://cdn.contoso.test/spfx/better-list-spfx/',
    }),
    writeFile(path.join(rootDir, '.nvmrc'), '22.22.3\n'),
    writeFile(path.join(rootDir, 'release', 'assets', 'chunks', 'app.js'), 'app();\n'),
    writeFile(
      path.join(rootDir, 'release', 'assets', 'fonts', 'eb-garamond', 'eb-garamond.css'),
      `@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-display: swap;
  font-weight: 400 800;
  src: url("./eb-garamond-latin-wght-normal.woff2") format("woff2-variations");
}
@font-face {
  font-family: "EB Garamond";
  font-style: italic;
  font-display: swap;
  font-weight: 400 800;
  src: url("./eb-garamond-latin-wght-italic.woff2") format("woff2-variations");
}
`,
    ),
    writeFile(
      path.join(
        rootDir,
        'release',
        'assets',
        'fonts',
        'eb-garamond',
        'eb-garamond-latin-wght-normal.woff2',
      ),
      Buffer.from('wOF2normal-fixture'),
    ),
    writeFile(
      path.join(
        rootDir,
        'release',
        'assets',
        'fonts',
        'eb-garamond',
        'eb-garamond-latin-wght-italic.woff2',
      ),
      Buffer.from('wOF2italic-fixture'),
    ),
    writeFile(
      path.join(rootDir, 'release', 'assets', 'fonts', 'eb-garamond', 'OFL.txt'),
      'Copyright 2017 The EB Garamond Project Authors\nSIL OPEN FONT LICENSE Version 1.1\n',
    ),
    writeFile(path.join(rootDir, 'release', 'manifests', 'manifest.js'), '{}\n'),
  ]);

  const packageFixture = path.join(rootDir, 'sppkg-fixture');
  await mkdir(path.join(packageFixture, '_rels'), { recursive: true });
  await Promise.all([
    writeFile(path.join(packageFixture, '[Content_Types].xml'), '<Types />\n'),
    writeFile(path.join(packageFixture, '_rels', '.rels'), '<Relationships />\n'),
    writeFile(
      path.join(packageFixture, 'AppManifest.xml'),
      `<App ProductID="${PRODUCT_ID}" Version="${sppkgVersion}" />\n`,
    ),
  ]);
  run(
    'zip',
    [
      '-X',
      '-q',
      path.join(rootDir, 'sharepoint', 'solution', 'better-list.sppkg'),
      '[Content_Types].xml',
      '_rels/.rels',
      'AppManifest.xml',
    ],
    { cwd: packageFixture },
  );
  return rootDir;
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

test('constructs and verifies a deterministic release payload manifest', async () => {
  const rootDir = await createFixture();
  const outputDir = path.join(rootDir, 'release-output');
  try {
    const prepared = await prepareReleaseArtifacts({
      rootDir,
      outputDir,
      tag: TAG,
      commit: COMMIT,
      sourceDateEpoch: SOURCE_DATE_EPOCH,
    });
    const secondOutputDir = path.join(rootDir, 'release-output-2');
    const secondBuild = await prepareReleaseArtifacts({
      rootDir,
      outputDir: secondOutputDir,
      tag: TAG,
      commit: COMMIT,
      sourceDateEpoch: SOURCE_DATE_EPOCH,
    });
    await verifyReleaseArtifacts({ rootDir, outputDir, tag: TAG, commit: COMMIT });
    assert.equal(await sha256(prepared.standalonePath), await sha256(secondBuild.standalonePath));
    assert.equal(await sha256(prepared.zipPath), await sha256(secondBuild.zipPath));

    const zipEntries = run('unzip', ['-Z1', prepared.zipPath])
      .trim()
      .split(/\r?\n/);
    assert.deepEqual(zipEntries, [...zipEntries].sort());
    assert(zipEntries.includes(`better-list-spfx-${VERSION}/RELEASE-MANIFEST.json`));
    for (const asset of [
      'eb-garamond.css',
      'eb-garamond-latin-wght-normal.woff2',
      'eb-garamond-latin-wght-italic.woff2',
      'OFL.txt',
    ]) {
      assert(
        zipEntries.includes(
          `better-list-spfx-${VERSION}/assets/fonts/eb-garamond/${asset}`,
        ),
      );
    }

    const manifest = JSON.parse(
      run('unzip', [
        '-p',
        prepared.zipPath,
        `better-list-spfx-${VERSION}/RELEASE-MANIFEST.json`,
      ]),
    );
    assert.equal(manifest.version, VERSION);
    assert.equal(manifest.spfxVersion, `${VERSION}.0`);
    assert.equal(manifest.commit, COMMIT);
    assert.deepEqual(
      manifest.files.map((file) => file.path),
      [...manifest.files.map((file) => file.path)].sort(),
    );
    assert.equal(
      manifest.files.find((file) => file.path === `sharepoint/better-list-spfx-${VERSION}.sppkg`)
        .sha256,
      await sha256(prepared.standalonePath),
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('verification detects a changed release asset', async () => {
  const rootDir = await createFixture();
  const outputDir = path.join(rootDir, 'release-output');
  try {
    const prepared = await prepareReleaseArtifacts({
      rootDir,
      outputDir,
      tag: TAG,
      commit: COMMIT,
      sourceDateEpoch: SOURCE_DATE_EPOCH,
    });
    await appendFile(prepared.standalonePath, 'tampered');
    await assert.rejects(
      verifyReleaseArtifacts({ rootDir, outputDir, tag: TAG, commit: COMMIT }),
      /Checksum mismatch/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preparation rejects the placeholder CDN used by an unconfigured repository', async () => {
  const rootDir = await createFixture({ placeholderCdn: true });
  const outputDir = path.join(rootDir, 'release-output');
  try {
    await assert.rejects(
      prepareReleaseArtifacts({
        rootDir,
        outputDir,
        tag: TAG,
        commit: COMMIT,
        sourceDateEpoch: SOURCE_DATE_EPOCH,
      }),
      /placeholder example\.com CDN/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preparation rejects an SPPKG whose embedded version does not match the tag', async () => {
  const rootDir = await createFixture({ sppkgVersion: '9.9.9.0' });
  const outputDir = path.join(rootDir, 'release-output');
  try {
    await assert.rejects(
      prepareReleaseArtifacts({
        rootDir,
        outputDir,
        tag: TAG,
        commit: COMMIT,
        sourceDateEpoch: SOURCE_DATE_EPOCH,
      }),
      /AppManifest version is 9\.9\.9\.0; expected 1\.2\.3\.0/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preparation rejects remote EB Garamond font URLs', async () => {
  const rootDir = await createFixture();
  const outputDir = path.join(rootDir, 'release-output');
  try {
    const stylesheetPath = path.join(
      rootDir,
      'release',
      'assets',
      'fonts',
      'eb-garamond',
      'eb-garamond.css',
    );
    const stylesheet = await readFile(stylesheetPath, 'utf8');
    await writeFile(
      stylesheetPath,
      stylesheet.replace(
        './eb-garamond-latin-wght-normal.woff2',
        'https://fonts.gstatic.com/eb-garamond.woff2',
      ),
    );
    await assert.rejects(
      prepareReleaseArtifacts({
        rootDir,
        outputDir,
        tag: TAG,
        commit: COMMIT,
        sourceDateEpoch: SOURCE_DATE_EPOCH,
      }),
      /local, relative font URLs/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('release preparation synchronizes four-part SPFx solution and feature versions', async () => {
  const rootDir = await createFixture();
  try {
    const solutionPath = path.join(rootDir, 'config', 'package-solution.json');
    await writeJson(solutionPath, {
      solution: {
        id: PRODUCT_ID,
        version: '1.2.2.0',
        features: [{ version: '1.2.2.0' }, { version: '1.2.2.0' }],
      },
    });
    const state = await syncSpfxVersion(rootDir);
    assert.deepEqual(state.errors, []);
    const solution = JSON.parse(await readFile(solutionPath, 'utf8')).solution;
    assert.equal(solution.version, `${VERSION}.0`);
    assert(solution.features.every((feature) => feature.version === `${VERSION}.0`));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
