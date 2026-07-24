#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  access,
  chmod,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { inspectVersions } from './sync-spfx-version.mjs';
import { validateEbGaramondAssets } from './copy-eb-garamond-assets.mjs';
import {
  CDN_TEMPLATE_SENTINEL,
  inspectArchiveEntries,
} from './materialize-cdn-package.mjs';

const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const MANIFEST_NAME = 'RELEASE-MANIFEST.json';
const INSTALL_NAME = 'INSTALL.md';
const MATERIALIZER_NAME = 'materialize-cdn-package.mjs';
const EMBEDDED_PACKAGE_BASE_PATH = 'HTTPS://SPCLIENTSIDEASSETLIBRARY/';

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const name = argument.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  return { command, options };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.binary ? null : 'utf8',
    env: { ...process.env, ...options.env },
    input: options.input,
    maxBuffer: 256 * 1024 * 1024,
    stdio: options.capture ? 'pipe' : options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${result.stderr?.toString('utf8') || result.stdout?.toString('utf8')}`
      : '';
    throw new Error(`${command} exited with status ${result.status}${detail}`);
  }
  return options.capture ? result.stdout : '';
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function sha256Content(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function walkFiles(rootDir, relativeDir = '') {
  const directory = path.join(rootDir, relativeDir);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => comparePaths(left.name, right.name))) {
    if (/[\r\n]/.test(entry.name)) {
      throw new Error(`Release payload path contains a line break: ${entry.name}`);
    }
    const relativePath = path.posix.join(relativeDir.split(path.sep).join(path.posix.sep), entry.name);
    const absolutePath = path.join(rootDir, ...relativePath.split('/'));
    if (entry.isSymbolicLink()) {
      throw new Error(`Release payload may not contain symbolic links: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Unsupported release payload entry: ${relativePath}`);
    }
  }
  return files.sort(comparePaths);
}

function assertFlatCdnPayload(files) {
  for (const file of files) {
    if (file.includes('/')) {
      throw new Error(`CDN payload must be flat; found nested asset: ${file}`);
    }
  }
}

function assertSafeArchiveEntries(entries, archiveName) {
  if (entries.length === 0) {
    throw new Error(`${archiveName} is empty`);
  }
  for (const entry of entries) {
    const normalized = entry.replaceAll('\\', '/');
    if (
      normalized.startsWith('/') ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.split('/').includes('..')
    ) {
      throw new Error(`${archiveName} contains unsafe path: ${entry}`);
    }
  }
}

function listZipEntries(archivePath) {
  const output = run('unzip', ['-Z1', archivePath], { capture: true });
  const entries = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  assertSafeArchiveEntries(entries, path.basename(archivePath));
  return entries;
}

function readXmlAttribute(xml, attribute) {
  const match = new RegExp(`\\b${attribute}="([^"]+)"`).exec(xml);
  return match?.[1];
}

function validateSppkg(sppkgPath, { expectedProductId, expectedVersion }) {
  run('unzip', ['-tq', sppkgPath], { capture: true });
  const entries = listZipEntries(sppkgPath);
  for (const requiredEntry of ['[Content_Types].xml', '_rels/.rels', 'AppManifest.xml']) {
    if (!entries.includes(requiredEntry)) {
      throw new Error(`${path.basename(sppkgPath)} is missing ${requiredEntry}`);
    }
  }
  const appManifest = run('unzip', ['-p', sppkgPath, 'AppManifest.xml'], { capture: true });
  const productId = readXmlAttribute(appManifest, 'ProductID');
  const version = readXmlAttribute(appManifest, 'Version');
  if (productId?.toLowerCase() !== expectedProductId.toLowerCase()) {
    throw new Error(
      `${path.basename(sppkgPath)} ProductID is ${productId}; expected ${expectedProductId}`,
    );
  }
  if (version !== expectedVersion) {
    throw new Error(
      `${path.basename(sppkgPath)} AppManifest version is ${version}; expected ${expectedVersion}`,
    );
  }
}

function validateReleaseIdentity(tag, commit, expectedVersion) {
  const tagMatch = TAG_PATTERN.exec(tag ?? '');
  if (!tagMatch) {
    throw new Error(`Release tag must match vX.Y.Z: ${tag}`);
  }
  const tagVersion = tag.slice(1);
  if (tagVersion !== expectedVersion) {
    throw new Error(`Release tag ${tag} does not match package version ${expectedVersion}`);
  }
  if (!COMMIT_PATTERN.test(commit ?? '')) {
    throw new Error(`Release commit must be a full lowercase 40-character SHA: ${commit}`);
  }
}

async function normalizeTimes(rootDir, epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  const files = await walkFiles(rootDir);
  for (const relativePath of files) {
    const filePath = path.join(rootDir, ...relativePath.split('/'));
    await chmod(filePath, 0o644);
    await utimes(filePath, date, date);
  }
}

async function canonicalizeZip(sourcePath, destinationPath, epochSeconds) {
  const entries = listZipEntries(sourcePath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'better-list-canonical-'));
  try {
    run('unzip', ['-q', sourcePath, '-d', tempDir]);
    const files = await walkFiles(tempDir);
    if (files.length === 0) {
      throw new Error(`${path.basename(sourcePath)} has no file payload`);
    }
    await normalizeTimes(tempDir, epochSeconds);
    run('zip', ['-0', '-X', '-q', destinationPath, '-@'], {
      cwd: tempDir,
      env: { TZ: 'UTC' },
      input: `${files.join('\n')}\n`,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  if (entries.filter((entry) => !entry.endsWith('/')).length !== listZipEntries(destinationPath).length) {
    throw new Error(`Canonical ZIP lost payload entries from ${path.basename(sourcePath)}`);
  }
}

function standaloneInstallationText({ packageName, version }) {
  return `# Better List ${version} self-contained installation

This archive was built from the matching immutable GitHub release tag. The SharePoint package
contains its client-side assets and does not require a separately configured CDN.

1. Upload \`${packageName}\` to the SharePoint tenant App Catalog.
2. Deploy the app, approve any tenant prompts, and add Better List to a modern page.

Keep \`RELEASE-MANIFEST.json\` with the package as its provenance and checksum record.
`;
}

function cdnKitInstallationText({ templateName, version }) {
  return `# Better List ${version} CDN deployment kit

This kit is URL-agnostic. The included \`${templateName}\` is intentionally not deployable until
it is materialized with the final HTTPS CDN base path.

## Create the URL-bound SharePoint package

1. Extract the kit on a machine with Node.js 22, \`zip\`, and \`unzip\`.
2. Choose a version-specific HTTPS base URL whose directory will contain every file listed under
   \`cdnFiles\` in \`RELEASE-MANIFEST.json\`.
3. Run:

   \`node ${MATERIALIZER_NAME} \\
     --template ${templateName} \\
     --cdn-base-path https://cdn.example.test/spfx/better-list/${version}/\`

   Replace the example.test URL with the real deployment URL. The command writes a final
   \`.sppkg\` and a matching \`.sha256\` file.
4. Upload the flat CDN files without renaming them and serve them from that exact base URL.
5. Upload the materialized \`.sppkg\` to the SharePoint tenant App Catalog, deploy it, and add
   Better List to a modern page.

Do not upload the template package. Retain the CDN files while the materialized package is
installed.
`;
}

async function buildManifest(bundleRoot, metadata) {
  const payloadFiles = (await walkFiles(bundleRoot)).filter((file) => file !== MANIFEST_NAME);
  const files = [];
  for (const relativePath of payloadFiles) {
    const absolutePath = path.join(bundleRoot, ...relativePath.split('/'));
    const fileStat = await stat(absolutePath);
    files.push({
      path: relativePath,
      sha256: await sha256(absolutePath),
      size: fileStat.size,
    });
  }
  return {
    schemaVersion: 1,
    version: metadata.version,
    spfxVersion: metadata.spfxVersion,
    tag: metadata.tag,
    commit: metadata.commit,
    artifactType: metadata.artifactType,
    nodeVersion: metadata.nodeVersion,
    productId: metadata.productId,
    sourceDateEpoch: metadata.sourceDateEpoch,
    files,
    ...(metadata.cdnFiles ? { cdnFiles: metadata.cdnFiles } : {}),
    ...(metadata.templateBasePath ? { templateBasePath: metadata.templateBasePath } : {}),
  };
}

async function writeBundleManifest(bundleRoot, metadata) {
  const manifest = await buildManifest(bundleRoot, metadata);
  await writeFile(
    path.join(bundleRoot, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function createDeterministicBundle(bundleRoot, destinationPath, epochSeconds) {
  await normalizeTimes(bundleRoot, epochSeconds);
  const archiveFiles = await walkFiles(bundleRoot);
  run('zip', ['-0', '-X', '-q', destinationPath, '-@'], {
    cwd: bundleRoot,
    env: { TZ: 'UTC' },
    input: `${archiveFiles.join('\n')}\n`,
  });
}

function readComponentXmlDocuments(sppkgPath) {
  const documents = [];
  for (const entry of listZipEntries(sppkgPath).filter(
    (file) => file.endsWith('.xml') && !file.includes('['),
  )) {
    const content = run('unzip', ['-p', sppkgPath, entry], { capture: true });
    if (content.includes('<ClientSideComponent')) {
      documents.push({ entry, content });
    }
  }
  if (documents.length === 0) {
    throw new Error(`${path.basename(sppkgPath)} has no ClientSideComponent manifest`);
  }
  return documents;
}

function validateStandaloneSppkg(sppkgPath, identity, cdnFiles, cdnAssetHashes) {
  validateSppkg(sppkgPath, identity);
  const entries = listZipEntries(sppkgPath).map((entry) => entry.replaceAll('\\', '/'));
  const embeddedEntries = entries.filter(
    (entry) => entry.includes('ClientSideAssets/') && !entry.endsWith('/'),
  );
  if (embeddedEntries.length === 0) {
    throw new Error('Self-contained SPPKG has no embedded ClientSideAssets');
  }
  const embeddedAssets = embeddedEntries.map((entry) => {
    const marker = 'ClientSideAssets/';
    const relativePath = entry.slice(entry.indexOf(marker) + marker.length);
    const segments = relativePath.split('/');
    if (segments.length !== 1 || !segments[0]) {
      throw new Error(`Self-contained SPPKG has an unexpected embedded asset path: ${entry}`);
    }
    return { entry, file: segments[0] };
  });
  const embeddedFiles = embeddedAssets.map(({ file }) => file).sort(comparePaths);
  if (JSON.stringify(embeddedFiles) !== JSON.stringify(cdnFiles)) {
    throw new Error(
      `Self-contained SPPKG assets do not exactly match the CDN payload: ${embeddedFiles.join(', ')}`,
    );
  }
  for (const { entry, file } of embeddedAssets) {
    const embeddedContent = run('unzip', ['-p', sppkgPath, entry], {
      binary: true,
      capture: true,
    });
    if (sha256Content(embeddedContent) !== cdnAssetHashes.get(file)) {
      throw new Error(`Self-contained SPPKG asset bytes do not match the CDN payload: ${file}`);
    }
  }
  const componentXml = readComponentXmlDocuments(sppkgPath)
    .map(({ content }) => content)
    .join('\n');
  if (/cdn\.(?:invalid|example)\b/i.test(componentXml)) {
    throw new Error('Self-contained SPPKG contains an external CDN placeholder');
  }
  if (!componentXml.includes(EMBEDDED_PACKAGE_BASE_PATH)) {
    throw new Error(`Self-contained SPPKG does not use ${EMBEDDED_PACKAGE_BASE_PATH}`);
  }
}

function validateCdnTemplateSppkg(sppkgPath, identity) {
  validateSppkg(sppkgPath, identity);
  const entries = listZipEntries(sppkgPath).map((entry) => entry.replaceAll('\\', '/'));
  if (entries.some((entry) => entry.includes('ClientSideAssets/'))) {
    throw new Error('CDN template SPPKG unexpectedly embeds ClientSideAssets');
  }
  const componentXml = readComponentXmlDocuments(sppkgPath)
    .map(({ content }) => content)
    .join('\n');
  if (!componentXml.includes(CDN_TEMPLATE_SENTINEL)) {
    throw new Error(`CDN template SPPKG does not contain ${CDN_TEMPLATE_SENTINEL}`);
  }
}

async function verifyBundleManifest(bundleRoot, expected) {
  const manifest = await readJson(path.join(bundleRoot, MANIFEST_NAME));
  for (const [field, value] of Object.entries(expected)) {
    if (manifest[field] !== value) {
      throw new Error(`${expected.artifactType} manifest ${field} does not match the release`);
    }
  }
  const actualPayloadFiles = (await walkFiles(bundleRoot)).filter(
    (file) => file !== MANIFEST_NAME,
  );
  const manifestPaths = manifest.files.map((file) => file.path);
  if (
    JSON.stringify(manifestPaths) !== JSON.stringify([...manifestPaths].sort()) ||
    new Set(manifestPaths).size !== manifestPaths.length
  ) {
    throw new Error(`${expected.artifactType} manifest paths must be unique and sorted`);
  }
  if (JSON.stringify(actualPayloadFiles) !== JSON.stringify(manifestPaths)) {
    throw new Error(`${expected.artifactType} files do not exactly match RELEASE-MANIFEST.json`);
  }
  for (const entry of manifest.files) {
    const filePath = path.join(bundleRoot, ...entry.path.split('/'));
    const fileStat = await stat(filePath);
    if (fileStat.size !== entry.size || (await sha256(filePath)) !== entry.sha256) {
      throw new Error(`${expected.artifactType} manifest mismatch for ${entry.path}`);
    }
  }
  if (!Number.isInteger(manifest.sourceDateEpoch) || manifest.sourceDateEpoch < 315532800) {
    throw new Error(`${expected.artifactType} manifest has an invalid sourceDateEpoch`);
  }
  return manifest;
}

async function verifyCanonicalBundle(archivePath, bundleRoot, sourceDateEpoch, rebuiltPath) {
  await createDeterministicBundle(bundleRoot, rebuiltPath, sourceDateEpoch);
  if ((await sha256(archivePath)) !== (await sha256(rebuiltPath))) {
    throw new Error(`${path.basename(archivePath)} is not the canonical validated archive`);
  }
}

export async function prepareReleaseArtifacts({
  rootDir = process.cwd(),
  outputDir = path.join(process.cwd(), 'release-output'),
  tag,
  commit,
  sourceDateEpoch,
}) {
  const versions = await inspectVersions(rootDir);
  if (versions.errors.length > 0) {
    throw new Error(`Release versions are not synchronized:\n- ${versions.errors.join('\n- ')}`);
  }
  validateReleaseIdentity(tag, commit, versions.version);

  const epoch = Number(sourceDateEpoch);
  if (!Number.isInteger(epoch) || epoch < 315532800) {
    throw new Error(`--source-date-epoch must be an integer at or after 1980-01-01: ${sourceDateEpoch}`);
  }
  if (await exists(outputDir)) {
    throw new Error(`Output directory already exists: ${outputDir}`);
  }

  const releaseBuildDir = path.join(rootDir, 'release-build');
  const sourceStandalone = path.join(releaseBuildDir, 'standalone.sppkg');
  const sourceCdnTemplate = path.join(releaseBuildDir, 'cdn-template.sppkg');
  const generatedAssets = path.join(releaseBuildDir, 'cdn-assets');
  const materializerSource = path.join(rootDir, 'scripts', MATERIALIZER_NAME);
  for (const requiredPath of [sourceStandalone, sourceCdnTemplate, generatedAssets, materializerSource]) {
    if (!(await exists(requiredPath))) {
      throw new Error(`Release build input is missing: ${requiredPath}`);
    }
  }
  const sppkgIdentity = {
    expectedProductId: versions.solutionConfig.solution.id,
    expectedVersion: versions.spfxVersion,
  };
  const cdnFiles = await walkFiles(generatedAssets);
  if (cdnFiles.length === 0) {
    throw new Error('CDN deployment kit has no runtime assets');
  }
  assertFlatCdnPayload(cdnFiles);
  await validateEbGaramondAssets(generatedAssets);
  const cdnAssetHashes = new Map();
  for (const file of cdnFiles) {
    cdnAssetHashes.set(file, await sha256(path.join(generatedAssets, file)));
  }
  validateStandaloneSppkg(sourceStandalone, sppkgIdentity, cdnFiles, cdnAssetHashes);
  validateCdnTemplateSppkg(sourceCdnTemplate, sppkgIdentity);

  await mkdir(outputDir, { recursive: false });
  const standalonePackageName = `better-list-spfx-${versions.version}.sppkg`;
  const cdnTemplateName = `better-list-spfx-${versions.version}-cdn-template.sppkg`;
  const standaloneZipName = `better-list-spfx-standalone-${versions.version}.zip`;
  const cdnKitZipName = `better-list-spfx-cdn-kit-${versions.version}.zip`;
  const standaloneZipPath = path.join(outputDir, standaloneZipName);
  const cdnKitZipPath = path.join(outputDir, cdnKitZipName);
  const nodeVersion = (await readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim();

  const tempParent = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-'));
  try {
    const standaloneRoot = path.join(tempParent, 'standalone');
    await mkdir(standaloneRoot, { recursive: true });
    await canonicalizeZip(
      sourceStandalone,
      path.join(standaloneRoot, standalonePackageName),
      epoch,
    );
    await writeFile(
      path.join(standaloneRoot, INSTALL_NAME),
      standaloneInstallationText({
        packageName: standalonePackageName,
        version: versions.version,
      }),
    );
    await writeBundleManifest(standaloneRoot, {
      artifactType: 'standalone',
      commit,
      nodeVersion,
      productId: versions.solutionConfig.solution.id,
      sourceDateEpoch: epoch,
      spfxVersion: versions.spfxVersion,
      tag,
      version: versions.version,
    });
    await createDeterministicBundle(standaloneRoot, standaloneZipPath, epoch);

    const cdnKitRoot = path.join(tempParent, 'cdn-kit');
    await cp(generatedAssets, cdnKitRoot, { recursive: true });
    await canonicalizeZip(
      sourceCdnTemplate,
      path.join(cdnKitRoot, cdnTemplateName),
      epoch,
    );
    await copyFile(materializerSource, path.join(cdnKitRoot, MATERIALIZER_NAME));
    await writeFile(
      path.join(cdnKitRoot, INSTALL_NAME),
      cdnKitInstallationText({
        templateName: cdnTemplateName,
        version: versions.version,
      }),
    );
    await writeBundleManifest(cdnKitRoot, {
      artifactType: 'cdn-deployment-kit',
      cdnFiles,
      commit,
      nodeVersion,
      productId: versions.solutionConfig.solution.id,
      sourceDateEpoch: epoch,
      spfxVersion: versions.spfxVersion,
      tag,
      templateBasePath: CDN_TEMPLATE_SENTINEL,
      version: versions.version,
    });
    await createDeterministicBundle(cdnKitRoot, cdnKitZipPath, epoch);
  } finally {
    await rm(tempParent, { recursive: true, force: true });
  }

  return { cdnKitZipPath, standaloneZipPath };
}

export async function verifyReleaseArtifacts({
  rootDir = process.cwd(),
  outputDir = path.join(process.cwd(), 'release-output'),
  tag,
  commit,
}) {
  const versions = await inspectVersions(rootDir);
  if (versions.errors.length > 0) {
    throw new Error(`Release versions are not synchronized:\n- ${versions.errors.join('\n- ')}`);
  }
  validateReleaseIdentity(tag, commit, versions.version);

  const standalonePackageName = `better-list-spfx-${versions.version}.sppkg`;
  const cdnTemplateName = `better-list-spfx-${versions.version}-cdn-template.sppkg`;
  const standaloneZipName = `better-list-spfx-standalone-${versions.version}.zip`;
  const cdnKitZipName = `better-list-spfx-cdn-kit-${versions.version}.zip`;
  const standaloneZipPath = path.join(outputDir, standaloneZipName);
  const cdnKitZipPath = path.join(outputDir, cdnKitZipName);
  const outputFiles = (await readdir(outputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expectedOutputFiles = [standaloneZipName, cdnKitZipName].sort();
  if (JSON.stringify(outputFiles) !== JSON.stringify(expectedOutputFiles)) {
    throw new Error(`Unexpected release output files: ${outputFiles.join(', ')}`);
  }

  const sppkgIdentity = {
    expectedProductId: versions.solutionConfig.solution.id,
    expectedVersion: versions.spfxVersion,
  };
  const nodeVersion = (await readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim();
  const extractParent = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-verify-'));
  try {
    const standaloneRoot = path.join(extractParent, 'standalone');
    const cdnKitRoot = path.join(extractParent, 'cdn-kit');
    await Promise.all([
      mkdir(standaloneRoot, { recursive: true }),
      mkdir(cdnKitRoot, { recursive: true }),
    ]);
    for (const [archivePath, destination] of [
      [standaloneZipPath, standaloneRoot],
      [cdnKitZipPath, cdnKitRoot],
    ]) {
      run('unzip', ['-tq', archivePath], { capture: true });
      inspectArchiveEntries(archivePath, {
        maxArchiveBytes: 256 * 1024 * 1024,
        maxCompressionRatio: 500,
        maxEntries: 4096,
        maxEntryBytes: 128 * 1024 * 1024,
        maxUncompressedBytes: 512 * 1024 * 1024,
      });
      assertSafeArchiveEntries(listZipEntries(archivePath), path.basename(archivePath));
      run('unzip', ['-q', archivePath, '-d', destination]);
    }

    const standaloneManifest = await verifyBundleManifest(standaloneRoot, {
      artifactType: 'standalone',
      commit,
      nodeVersion,
      productId: versions.solutionConfig.solution.id,
      schemaVersion: 1,
      spfxVersion: versions.spfxVersion,
      tag,
      version: versions.version,
    });
    const cdnKitManifest = await verifyBundleManifest(cdnKitRoot, {
      artifactType: 'cdn-deployment-kit',
      commit,
      nodeVersion,
      productId: versions.solutionConfig.solution.id,
      schemaVersion: 1,
      spfxVersion: versions.spfxVersion,
      tag,
      templateBasePath: CDN_TEMPLATE_SENTINEL,
      version: versions.version,
    });
    await verifyCanonicalBundle(
      standaloneZipPath,
      standaloneRoot,
      standaloneManifest.sourceDateEpoch,
      path.join(extractParent, 'standalone-rebuilt.zip'),
    );
    await verifyCanonicalBundle(
      cdnKitZipPath,
      cdnKitRoot,
      cdnKitManifest.sourceDateEpoch,
      path.join(extractParent, 'cdn-kit-rebuilt.zip'),
    );
    if (!Array.isArray(cdnKitManifest.cdnFiles) || cdnKitManifest.cdnFiles.length === 0) {
      throw new Error('CDN deployment kit manifest does not list CDN files');
    }
    assertFlatCdnPayload(cdnKitManifest.cdnFiles);
    if (
      JSON.stringify(cdnKitManifest.cdnFiles) !==
        JSON.stringify([...cdnKitManifest.cdnFiles].sort()) ||
      new Set(cdnKitManifest.cdnFiles).size !== cdnKitManifest.cdnFiles.length
    ) {
      throw new Error('CDN deployment kit files must be unique and sorted');
    }
    const expectedCdnFiles = (await walkFiles(cdnKitRoot)).filter(
      (file) =>
        ![
          MANIFEST_NAME,
          INSTALL_NAME,
          MATERIALIZER_NAME,
          cdnTemplateName,
        ].includes(file),
    );
    if (JSON.stringify(cdnKitManifest.cdnFiles) !== JSON.stringify(expectedCdnFiles)) {
      throw new Error('CDN deployment kit manifest does not exactly list the runtime payload');
    }
    await validateEbGaramondAssets(cdnKitRoot);
    const cdnAssetHashes = new Map();
    for (const file of cdnKitManifest.cdnFiles) {
      cdnAssetHashes.set(file, await sha256(path.join(cdnKitRoot, file)));
    }
    validateStandaloneSppkg(
      path.join(standaloneRoot, standalonePackageName),
      sppkgIdentity,
      cdnKitManifest.cdnFiles,
      cdnAssetHashes,
    );
    validateCdnTemplateSppkg(path.join(cdnKitRoot, cdnTemplateName), sppkgIdentity);

    const materializedPackage = path.join(extractParent, 'materialized.sppkg');
    run(
      process.execPath,
      [
        path.join(cdnKitRoot, MATERIALIZER_NAME),
        '--template',
        path.join(cdnKitRoot, cdnTemplateName),
        '--cdn-base-path',
        'https://cdn.contoso.test/spfx/better-list/',
        '--output',
        materializedPackage,
      ],
      { capture: true },
    );
    validateSppkg(materializedPackage, sppkgIdentity);
    const materializedEntries = listZipEntries(materializedPackage);
    if (materializedEntries.some((entry) => entry.includes('ClientSideAssets/'))) {
      throw new Error('Materialized CDN SPPKG unexpectedly embeds ClientSideAssets');
    }
    const materializedXml = readComponentXmlDocuments(materializedPackage)
      .map(({ content }) => content)
      .join('\n');
    if (
      !materializedXml.includes('https://cdn.contoso.test/spfx/better-list/') ||
      materializedXml.includes(CDN_TEMPLATE_SENTINEL)
    ) {
      throw new Error('Materialized CDN SPPKG does not contain only the requested CDN base path');
    }
  } finally {
    await rm(extractParent, { recursive: true, force: true });
  }

  return { cdnKitZipPath, standaloneZipPath };
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outputDir = path.resolve(options.outputDir ?? path.join(rootDir, 'release-output'));
  if (command === 'prepare') {
    await prepareReleaseArtifacts({
      rootDir,
      outputDir,
      tag: options.tag,
      commit: options.commit,
      sourceDateEpoch: options.sourceDateEpoch,
    });
    console.log(`Prepared validated release assets in ${outputDir}`);
    return;
  }
  if (command === 'verify') {
    await verifyReleaseArtifacts({
      rootDir,
      outputDir,
      tag: options.tag,
      commit: options.commit,
    });
    console.log(`Verified self-contained and CDN deployment kit archives in ${outputDir}`);
    return;
  }
  throw new Error('Usage: release-artifacts.mjs <prepare|verify> [options]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
