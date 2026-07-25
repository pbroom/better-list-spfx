import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
const COMPONENT_ID = '432308c8-73ca-4d92-a86e-d45a7de4f508';
const CDN_TEMPLATE_BASE_PATH = 'https://cdn.invalid/better-list-spfx/';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CDN_FILES = [
  'app.js',
  'better-list-eb-garamond-OFL.txt',
  'better-list-eb-garamond-latin-wght-italic.woff2',
  'better-list-eb-garamond-latin-wght-normal.woff2',
  'better-list-eb-garamond.css',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.input,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function xmlAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function createSppkg({
  rootDir,
  destination,
  basePath,
  includeClientSideAssets,
  embeddedAssetOverrides = {},
  version,
}) {
  const packageRoot = path.join(rootDir, `sppkg-${path.basename(destination)}`);
  const componentPath = path.join(
    packageRoot,
    PRODUCT_ID,
    `WebPart_${COMPONENT_ID}.xml`,
  );
  await Promise.all([
    mkdir(path.join(packageRoot, '_rels'), { recursive: true }),
    mkdir(path.dirname(componentPath), { recursive: true }),
  ]);
  const componentManifest = {
    id: COMPONENT_ID,
    alias: 'BetterList',
    componentType: 'WebPart',
    version: VERSION,
    manifestVersion: 2,
    loaderConfig: {
      internalModuleBaseUrls: [basePath],
      entryModuleId: 'better-list',
      scriptResources: {
        'better-list': { type: 'path', path: 'app.js' },
      },
    },
  };
  await Promise.all([
    writeFile(path.join(packageRoot, '[Content_Types].xml'), '<Types />\n'),
    writeFile(path.join(packageRoot, '_rels', '.rels'), '<Relationships />\n'),
    writeFile(
      path.join(packageRoot, 'AppManifest.xml'),
      `<App ProductID="${PRODUCT_ID}" Version="${version}" />\n`,
    ),
    writeFile(
      componentPath,
      `<Elements><ClientSideComponent ComponentManifest="${xmlAttribute(
        JSON.stringify(componentManifest),
      )}" /></Elements>\n`,
    ),
  ]);

  if (includeClientSideAssets) {
    const embeddedRoot = path.join(packageRoot, 'ClientSideAssets');
    await mkdir(embeddedRoot, { recursive: true });
    for (const file of CDN_FILES) {
      const destinationPath = path.join(embeddedRoot, file);
      if (Object.hasOwn(embeddedAssetOverrides, file)) {
        await writeFile(destinationPath, embeddedAssetOverrides[file]);
      } else {
        await copyFile(
          path.join(rootDir, 'release-build', 'cdn-assets', file),
          destinationPath,
        );
      }
    }
  }

  const files = [];
  const collect = async (directory, relative = '') => {
    const entries = await import('node:fs/promises').then(({ readdir }) =>
      readdir(directory, { withFileTypes: true }),
    );
    for (const entry of entries) {
      const entryRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        await collect(path.join(directory, entry.name), entryRelative);
      } else if (entry.isFile()) {
        files.push(entryRelative);
      }
    }
  };
  await collect(packageRoot);
  files.sort();
  run('zip', ['-0', '-X', '-q', destination, '-@'], {
    cwd: packageRoot,
    input: `${files.join('\n')}\n`,
  });
}

async function createFixture({
  embeddedAssetOverrides,
  standaloneVersion = `${VERSION}.0`,
  templateVersion = `${VERSION}.0`,
} = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-test-'));
  const assetsRoot = path.join(rootDir, 'release-build', 'cdn-assets');
  await Promise.all([
    mkdir(path.join(rootDir, 'config'), { recursive: true }),
    mkdir(assetsRoot, { recursive: true }),
    mkdir(path.join(rootDir, 'scripts'), { recursive: true }),
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
        includeClientSideAssets: true,
        features: [{ version: `${VERSION}.0` }],
      },
    }),
    writeJson(path.join(rootDir, 'config', 'write-manifests.json'), {
      cdnBasePath: '<!-- PATH TO CDN -->',
    }),
    writeFile(path.join(rootDir, '.nvmrc'), '22.22.3\n'),
    writeFile(path.join(assetsRoot, 'app.js'), 'app();\n'),
    writeFile(
      path.join(assetsRoot, 'better-list-eb-garamond.css'),
      `@font-face { font-family: "EB Garamond"; font-style: normal; font-display: swap; font-weight: 400 800; src: url("./better-list-eb-garamond-latin-wght-normal.woff2") format("woff2-variations"); }
@font-face { font-family: "EB Garamond"; font-style: italic; font-display: swap; font-weight: 400 800; src: url("./better-list-eb-garamond-latin-wght-italic.woff2") format("woff2-variations"); }
`,
    ),
    writeFile(
      path.join(assetsRoot, 'better-list-eb-garamond-latin-wght-normal.woff2'),
      Buffer.from('wOF2normal-fixture'),
    ),
    writeFile(
      path.join(assetsRoot, 'better-list-eb-garamond-latin-wght-italic.woff2'),
      Buffer.from('wOF2italic-fixture'),
    ),
    writeFile(
      path.join(assetsRoot, 'better-list-eb-garamond-OFL.txt'),
      'Copyright 2017 The EB Garamond Project Authors\nSIL OPEN FONT LICENSE Version 1.1\n',
    ),
    copyFile(
      path.join(SCRIPT_DIR, 'materialize-cdn-package.mjs'),
      path.join(rootDir, 'scripts', 'materialize-cdn-package.mjs'),
    ),
  ]);
  await Promise.all([
    createSppkg({
      rootDir,
      destination: path.join(rootDir, 'release-build', 'standalone.sppkg'),
      basePath: 'HTTPS://SPCLIENTSIDEASSETLIBRARY/',
      embeddedAssetOverrides,
      includeClientSideAssets: true,
      version: standaloneVersion,
    }),
    createSppkg({
      rootDir,
      destination: path.join(rootDir, 'release-build', 'cdn-template.sppkg'),
      basePath: CDN_TEMPLATE_BASE_PATH,
      includeClientSideAssets: false,
      version: templateVersion,
    }),
  ]);
  return rootDir;
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

test('constructs and verifies deterministic standalone and CDN kit archives', async () => {
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
    assert.equal(
      await sha256(prepared.standaloneZipPath),
      await sha256(secondBuild.standaloneZipPath),
    );
    assert.equal(
      await sha256(prepared.cdnKitZipPath),
      await sha256(secondBuild.cdnKitZipPath),
    );

    const standaloneEntries = run('unzip', ['-Z1', prepared.standaloneZipPath])
      .trim()
      .split(/\r?\n/);
    assert.deepEqual(standaloneEntries, [...standaloneEntries].sort());
    assert.deepEqual(standaloneEntries, [
      'INSTALL.md',
      'RELEASE-MANIFEST.json',
      `better-list-spfx-${VERSION}.sppkg`,
    ]);

    const cdnEntries = run('unzip', ['-Z1', prepared.cdnKitZipPath])
      .trim()
      .split(/\r?\n/);
    assert(cdnEntries.includes('materialize-cdn-package.mjs'));
    assert(cdnEntries.includes(`better-list-spfx-${VERSION}-cdn-template.sppkg`));
    assert(CDN_FILES.every((file) => cdnEntries.includes(file)));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preparation rejects standalone assets whose bytes differ from the CDN payload', async () => {
  const rootDir = await createFixture({
    embeddedAssetOverrides: { 'app.js': 'tampered();\n' },
  });
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
      /asset bytes do not match the CDN payload: app\.js/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('verification detects a changed release archive', async () => {
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
    await appendFile(prepared.standaloneZipPath, 'tampered');
    await assert.rejects(
      verifyReleaseArtifacts({ rootDir, outputDir, tag: TAG, commit: COMMIT }),
      /unzip exited|extra bytes|archive|canonical/i,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preparation rejects nested CDN assets', async () => {
  const rootDir = await createFixture();
  const outputDir = path.join(rootDir, 'release-output');
  try {
    await mkdir(path.join(rootDir, 'release-build', 'cdn-assets', 'nested'), {
      recursive: true,
    });
    await writeFile(
      path.join(rootDir, 'release-build', 'cdn-assets', 'nested', 'app.js'),
      'nested app();\n',
    );
    await assert.rejects(
      prepareReleaseArtifacts({
        rootDir,
        outputDir,
        tag: TAG,
        commit: COMMIT,
        sourceDateEpoch: SOURCE_DATE_EPOCH,
      }),
      /CDN payload must be flat; found nested asset: nested\/app\.js/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preparation rejects a standalone SPPKG whose version does not match the tag', async () => {
  const rootDir = await createFixture({ standaloneVersion: '9.9.9.0' });
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

test('preparation rejects a CDN template that embeds client-side assets', async () => {
  const rootDir = await createFixture();
  const outputDir = path.join(rootDir, 'release-output');
  try {
    await createSppkg({
      rootDir,
      destination: path.join(rootDir, 'release-build', 'cdn-template.sppkg'),
      basePath: CDN_TEMPLATE_BASE_PATH,
      includeClientSideAssets: true,
      version: `${VERSION}.0`,
    });
    await assert.rejects(
      prepareReleaseArtifacts({
        rootDir,
        outputDir,
        tag: TAG,
        commit: COMMIT,
        sourceDateEpoch: SOURCE_DATE_EPOCH,
      }),
      /CDN template SPPKG unexpectedly embeds ClientSideAssets/,
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
      'release-build',
      'cdn-assets',
      'better-list-eb-garamond.css',
    );
    const stylesheet = await readFile(stylesheetPath, 'utf8');
    await writeFile(
      stylesheetPath,
      stylesheet.replace(
        './better-list-eb-garamond-latin-wght-normal.woff2',
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
        includeClientSideAssets: true,
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
