import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  CDN_TEMPLATE_SENTINEL,
  inspectArchiveEntries,
  materializeCdnPackage,
  normalizeCdnBasePath,
} from './materialize-cdn-package.mjs';

const PRODUCT_ID = 'f1622b36-0843-4eb0-aca9-df6ac57a15c4';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.input,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    );
  }
  return result.stdout;
}

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function createTemplate({
  baseUrls = [CDN_TEMPLATE_SENTINEL],
  includeComponent = true,
  embeddedAssets = false,
} = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-cdn-template-test-'));
  const sourceDir = path.join(rootDir, 'source');
  const webPartDir = path.join(sourceDir, 'feature');
  await mkdir(webPartDir, { recursive: true });
  await mkdir(path.join(sourceDir, '_rels'), { recursive: true });
  await Promise.all([
    writeFile(path.join(sourceDir, '[Content_Types].xml'), '<Types />\n'),
    writeFile(
      path.join(sourceDir, 'AppManifest.xml'),
      `<App ProductID="${PRODUCT_ID}" Version="1.2.3.0" />\n`,
    ),
    writeFile(path.join(sourceDir, '_rels', '.rels'), '<Relationships />\n'),
  ]);
  if (includeComponent) {
    const manifest = {
      id: '432308c8-73ca-4d92-a86e-d45a7de4f508',
      loaderConfig: {
        internalModuleBaseUrls: baseUrls,
        entryModuleId: 'better-list',
        scriptResources: {
          'better-list': { type: 'path', path: 'better-list_hash.js' },
        },
      },
    };
    await writeFile(
      path.join(webPartDir, 'WebPart.xml'),
      `<Elements><ClientSideComponent ComponentManifest="${xmlEscape(
        JSON.stringify(manifest),
      )}" Type="WebPart"></ClientSideComponent></Elements>\n`,
    );
  } else {
    await writeFile(path.join(webPartDir, 'Feature.xml'), '<Elements />\n');
  }
  if (embeddedAssets) {
    await mkdir(path.join(sourceDir, 'ClientSideAssets'), { recursive: true });
    await writeFile(path.join(sourceDir, 'ClientSideAssets', 'better-list.js'), 'app();\n');
  }

  const templatePath = path.join(rootDir, 'template.sppkg');
  const files = [];
  async function collect(relativeDir = '') {
    const directory = path.join(sourceDir, relativeDir);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await collect(relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }
  await collect();
  files.sort();
  run('zip', ['-0', '-X', '-q', templatePath, '-@'], {
    cwd: sourceDir,
    input: `${files.join('\n')}\n`,
  });
  const templateContent = await readFile(templatePath);
  const templateStat = await stat(templatePath);
  const manifestPath = path.join(rootDir, 'RELEASE-MANIFEST.json');
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        version: '1.2.3',
        spfxVersion: '1.2.3.0',
        productId: PRODUCT_ID,
        artifactType: 'cdn-deployment-kit',
        templateBasePath: CDN_TEMPLATE_SENTINEL,
        files: [
          {
            path: path.basename(templatePath),
            sha256: createHash('sha256').update(templateContent).digest('hex'),
            size: templateStat.size,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return { manifestPath, rootDir, templatePath };
}

async function readWebPartXml(archivePath) {
  return run('unzip', ['-p', archivePath, 'feature/WebPart.xml']);
}

test('normalizes an HTTPS CDN base path and rejects unsafe URL forms', () => {
  assert.equal(
    normalizeCdnBasePath('https://cdn.contoso.test/better-list'),
    'https://cdn.contoso.test/better-list/',
  );
  for (const value of [
    'http://cdn.contoso.test/better-list/',
    'https://user:password@cdn.contoso.test/better-list/',
    'https://cdn.contoso.test/better-list/?version=1',
    'https://cdn.contoso.test/better-list/?',
    'https://cdn.contoso.test/better-list/#fragment',
    'https://cdn.contoso.test/better-list/#',
    'not a URL',
  ]) {
    assert.throws(() => normalizeCdnBasePath(value));
  }
});

test('materializes deterministic, unzip-valid packages for different CDN URLs', async () => {
  const fixture = await createTemplate();
  try {
    const firstPath = path.join(fixture.rootDir, 'first.sppkg');
    const firstCopyPath = path.join(fixture.rootDir, 'first-copy.sppkg');
    const secondPath = path.join(fixture.rootDir, 'second.sppkg');
    const first = await materializeCdnPackage({
      template: fixture.templatePath,
      cdnBasePath: 'https://one.contoso.test/better-list',
      output: firstPath,
    });
    const firstCopy = await materializeCdnPackage({
      template: fixture.templatePath,
      cdnBasePath: 'https://one.contoso.test/better-list/',
      output: firstCopyPath,
    });
    const second = await materializeCdnPackage({
      template: fixture.templatePath,
      cdnBasePath: 'https://two.contoso.test/apps/better-list/',
      output: secondPath,
    });

    assert.equal(first.sha256, firstCopy.sha256);
    assert.notEqual(first.sha256, second.sha256);
    assert.equal(first.replacementCount, 1);
    assert.equal(
      await readFile(first.checksumPath, 'utf8'),
      `${first.sha256}  first.sppkg\n`,
    );
    run('unzip', ['-tq', firstPath]);
    assert.deepEqual(
      inspectArchiveEntries(firstPath)
        .filter((entry) => entry.type === '-')
        .map((entry) => entry.name),
      inspectArchiveEntries(firstPath)
        .filter((entry) => entry.type === '-')
        .map((entry) => entry.name)
        .sort(),
    );

    const firstXml = await readWebPartXml(firstPath);
    const secondXml = await readWebPartXml(secondPath);
    assert(firstXml.includes('https://one.contoso.test/better-list/'));
    assert(secondXml.includes('https://two.contoso.test/apps/better-list/'));
    assert(!firstXml.includes(CDN_TEMPLATE_SENTINEL));
    assert(!secondXml.includes(CDN_TEMPLATE_SENTINEL));
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
});

for (const [name, options] of [
  ['missing sentinel', { baseUrls: ['https://unexpected.invalid/better-list/'] }],
  ['duplicate sentinel', { baseUrls: [CDN_TEMPLATE_SENTINEL, CDN_TEMPLATE_SENTINEL] }],
  [
    'unexpected additional base URL',
    { baseUrls: [CDN_TEMPLATE_SENTINEL, 'https://unexpected.invalid/better-list/'] },
  ],
  ['missing component manifest', { includeComponent: false }],
]) {
  test(`rejects a template with ${name}`, async () => {
    const fixture = await createTemplate(options);
    try {
      await assert.rejects(
        materializeCdnPackage({
          template: fixture.templatePath,
          cdnBasePath: 'https://cdn.contoso.test/better-list/',
          output: path.join(fixture.rootDir, 'output.sppkg'),
        }),
        /template CDN base URL|no replaceable ClientSideComponent/,
      );
    } finally {
      await rm(fixture.rootDir, { recursive: true, force: true });
    }
  });
}

test('rejects embedded ClientSideAssets entries', async () => {
  const fixture = await createTemplate({ embeddedAssets: true });
  try {
    await assert.rejects(
      materializeCdnPackage({
        template: fixture.templatePath,
        cdnBasePath: 'https://cdn.contoso.test/better-list/',
      }),
      /may not contain embedded ClientSideAssets/,
    );
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
});

test('rejects a ZIP traversal entry before extraction', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-cdn-traversal-test-'));
  try {
    const sourceDir = path.join(rootDir, 'source');
    await mkdir(sourceDir);
    await writeFile(path.join(rootDir, 'outside.xml'), '<Elements />\n');
    const archivePath = path.join(rootDir, 'traversal.sppkg');
    run('zip', ['-q', archivePath, '../outside.xml'], { cwd: sourceDir });
    assert.throws(() => inspectArchiveEntries(archivePath), /Unsafe ZIP entry path/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('rejects a template whose release-manifest checksum does not match', async () => {
  const fixture = await createTemplate();
  try {
    const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
    manifest.files[0].sha256 = '0'.repeat(64);
    await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      materializeCdnPackage({
        template: fixture.templatePath,
        cdnBasePath: 'https://cdn.contoso.test/better-list/',
      }),
      /checksum mismatch/,
    );
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
});

test('refuses to overwrite an existing output or checksum path', async () => {
  const fixture = await createTemplate();
  try {
    const outputPath = path.join(fixture.rootDir, 'existing.sppkg');
    await writeFile(outputPath, 'keep me\n');
    await assert.rejects(
      materializeCdnPackage({
        template: fixture.templatePath,
        cdnBasePath: 'https://cdn.contoso.test/better-list/',
        output: outputPath,
      }),
      /Refusing to overwrite existing output/,
    );
    assert.equal(await readFile(outputPath, 'utf8'), 'keep me\n');

    const secondOutputPath = path.join(fixture.rootDir, 'checksum-target.sppkg');
    await writeFile(`${secondOutputPath}.sha256`, 'keep checksum\n');
    await assert.rejects(
      materializeCdnPackage({
        template: fixture.templatePath,
        cdnBasePath: 'https://cdn.contoso.test/better-list/',
        output: secondOutputPath,
      }),
      /Refusing to overwrite existing output/,
    );
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
});

test('refuses a symbolic-link output path', async () => {
  const fixture = await createTemplate();
  try {
    const targetPath = path.join(fixture.rootDir, 'target.sppkg');
    const outputPath = path.join(fixture.rootDir, 'output-link.sppkg');
    await writeFile(targetPath, 'keep target\n');
    await symlink(targetPath, outputPath);
    await assert.rejects(
      materializeCdnPackage({
        template: fixture.templatePath,
        cdnBasePath: 'https://cdn.contoso.test/better-list/',
        output: outputPath,
      }),
      /Refusing to overwrite existing output/,
    );
    assert.equal(await readFile(targetPath, 'utf8'), 'keep target\n');
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
});

test('rejects a highly compressed ZIP before extraction', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-cdn-zip-bomb-test-'));
  try {
    const sourcePath = path.join(rootDir, 'zeros.bin');
    await writeFile(sourcePath, Buffer.alloc(1024 * 1024));
    const archivePath = path.join(rootDir, 'compressed.sppkg');
    run('zip', ['-q', archivePath, path.basename(sourcePath)], { cwd: rootDir });
    assert.throws(
      () => inspectArchiveEntries(archivePath),
      /excessive compression ratio/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
