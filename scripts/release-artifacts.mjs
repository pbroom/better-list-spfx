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

const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const MANIFEST_NAME = 'RELEASE-MANIFEST.json';

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
    if (name === 'allow-placeholder-cdn') {
      options.allowPlaceholderCdn = true;
      continue;
    }
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
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    input: options.input,
    stdio: options.capture ? 'pipe' : options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
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

async function readCdnBasePath(rootDir, allowPlaceholderCdn) {
  const config = await readJson(path.join(rootDir, 'config', 'write-manifests.json'));
  let parsed;
  try {
    parsed = new URL(config.cdnBasePath);
  } catch {
    throw new Error(`config/write-manifests.json has an invalid cdnBasePath: ${config.cdnBasePath}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('CDN base path must use HTTPS');
  }
  const isPlaceholder =
    parsed.hostname === 'example.com' || parsed.hostname.endsWith('.example.com');
  if (isPlaceholder && !allowPlaceholderCdn) {
    throw new Error(
      'Refusing to publish assets for the placeholder example.com CDN. Configure config/write-manifests.json first.',
    );
  }
  return config.cdnBasePath;
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

function installationText({ cdnBasePath, packageName, version }) {
  return `# Better List ${version} installation

This bundle was built from the matching immutable GitHub release tag.

## CDN deployment

1. Upload every file under \`assets/\` and \`manifests/\` without renaming or flattening paths.
2. Serve those paths from \`${cdnBasePath}\`.
3. Upload \`sharepoint/${packageName}\` to the SharePoint tenant App Catalog.
4. Deploy the app, approve any tenant prompts, and add Better List to a modern page.

Keep the CDN files in place while this package version is installed. The separately downloadable
\`${packageName}\` is byte-identical to the package included here.
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
    cdnBasePath: metadata.cdnBasePath,
    nodeVersion: metadata.nodeVersion,
    files,
  };
}

export async function prepareReleaseArtifacts({
  rootDir = process.cwd(),
  outputDir = path.join(process.cwd(), 'release-output'),
  tag,
  commit,
  sourceDateEpoch,
  allowPlaceholderCdn = false,
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

  const cdnBasePath = await readCdnBasePath(rootDir, allowPlaceholderCdn);
  const solutionDir = path.join(rootDir, 'sharepoint', 'solution');
  const solutionEntries = await readdir(solutionDir, { withFileTypes: true });
  const sppkgFiles = solutionEntries.filter(
    (entry) => entry.isFile() && entry.name.endsWith('.sppkg'),
  );
  if (sppkgFiles.length !== 1) {
    throw new Error(`Expected exactly one generated SPPKG, found ${sppkgFiles.length}`);
  }
  const sourceSppkg = path.join(solutionDir, sppkgFiles[0].name);
  const sppkgIdentity = {
    expectedProductId: versions.solutionConfig.solution.id,
    expectedVersion: versions.spfxVersion,
  };
  validateSppkg(sourceSppkg, sppkgIdentity);

  const generatedAssets = path.join(rootDir, 'release', 'assets');
  const generatedManifests = path.join(rootDir, 'release', 'manifests');
  for (const [label, directory] of [
    ['assets', generatedAssets],
    ['manifests', generatedManifests],
  ]) {
    if (!(await exists(directory)) || (await walkFiles(directory)).length === 0) {
      throw new Error(`Production build did not generate release/${label}`);
    }
  }

  await mkdir(outputDir, { recursive: false });
  const standaloneName = `better-list-spfx-${versions.version}.sppkg`;
  const zipName = `better-list-spfx-cdn-${versions.version}.zip`;
  const standalonePath = path.join(outputDir, standaloneName);
  const zipPath = path.join(outputDir, zipName);
  const checksumsPath = path.join(outputDir, 'SHA256SUMS');
  await canonicalizeZip(sourceSppkg, standalonePath, epoch);
  validateSppkg(standalonePath, sppkgIdentity);

  const tempParent = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-'));
  const bundleName = `better-list-spfx-${versions.version}`;
  const bundleRoot = path.join(tempParent, bundleName);
  try {
    await mkdir(path.join(bundleRoot, 'sharepoint'), { recursive: true });
    await cp(generatedAssets, path.join(bundleRoot, 'assets'), { recursive: true });
    await cp(generatedManifests, path.join(bundleRoot, 'manifests'), { recursive: true });
    await copyFile(standalonePath, path.join(bundleRoot, 'sharepoint', standaloneName));
    await writeFile(
      path.join(bundleRoot, 'INSTALL.md'),
      installationText({
        cdnBasePath,
        packageName: standaloneName,
        version: versions.version,
      }),
    );

    const manifest = await buildManifest(bundleRoot, {
      cdnBasePath,
      commit,
      nodeVersion: (await readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim(),
      spfxVersion: versions.spfxVersion,
      tag,
      version: versions.version,
    });
    await writeFile(
      path.join(bundleRoot, MANIFEST_NAME),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await normalizeTimes(bundleRoot, epoch);

    const archiveFiles = (await walkFiles(bundleRoot)).map((file) =>
      path.posix.join(bundleName, file),
    );
    run('zip', ['-0', '-X', '-q', zipPath, '-@'], {
      cwd: tempParent,
      env: { TZ: 'UTC' },
      input: `${archiveFiles.join('\n')}\n`,
    });
  } finally {
    await rm(tempParent, { recursive: true, force: true });
  }

  const releaseAssets = [standaloneName, zipName].sort();
  const checksumLines = [];
  for (const assetName of releaseAssets) {
    checksumLines.push(`${await sha256(path.join(outputDir, assetName))}  ${assetName}`);
  }
  await writeFile(checksumsPath, `${checksumLines.join('\n')}\n`);

  return { checksumsPath, standalonePath, zipPath };
}

function parseChecksums(content) {
  const checksums = new Map();
  for (const line of content.trim().split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})  ([^/\\]+)$/.exec(line);
    if (!match) {
      throw new Error(`Invalid SHA256SUMS line: ${line}`);
    }
    if (checksums.has(match[2])) {
      throw new Error(`Duplicate SHA256SUMS entry: ${match[2]}`);
    }
    checksums.set(match[2], match[1]);
  }
  return checksums;
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

  const standaloneName = `better-list-spfx-${versions.version}.sppkg`;
  const zipName = `better-list-spfx-cdn-${versions.version}.zip`;
  const standalonePath = path.join(outputDir, standaloneName);
  const zipPath = path.join(outputDir, zipName);
  const checksumsPath = path.join(outputDir, 'SHA256SUMS');
  const outputFiles = (await readdir(outputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expectedOutputFiles = ['SHA256SUMS', standaloneName, zipName].sort();
  if (JSON.stringify(outputFiles) !== JSON.stringify(expectedOutputFiles)) {
    throw new Error(`Unexpected release output files: ${outputFiles.join(', ')}`);
  }

  const checksums = parseChecksums(await readFile(checksumsPath, 'utf8'));
  if (
    checksums.size !== 2 ||
    !checksums.has(standaloneName) ||
    !checksums.has(zipName)
  ) {
    throw new Error('SHA256SUMS must contain exactly the standalone SPPKG and CDN ZIP');
  }
  for (const [assetName, expectedHash] of checksums) {
    const actualHash = await sha256(path.join(outputDir, assetName));
    if (actualHash !== expectedHash) {
      throw new Error(`Checksum mismatch for ${assetName}`);
    }
  }

  const sppkgIdentity = {
    expectedProductId: versions.solutionConfig.solution.id,
    expectedVersion: versions.spfxVersion,
  };
  validateSppkg(standalonePath, sppkgIdentity);
  run('unzip', ['-tq', zipPath], { capture: true });
  const zipEntries = listZipEntries(zipPath);
  const bundleName = `better-list-spfx-${versions.version}`;
  if (!zipEntries.every((entry) => entry.startsWith(`${bundleName}/`))) {
    throw new Error(`CDN ZIP contains entries outside ${bundleName}/`);
  }

  const extractParent = await mkdtemp(path.join(os.tmpdir(), 'better-list-verify-'));
  try {
    run('unzip', ['-q', zipPath, '-d', extractParent]);
    const bundleRoot = path.join(extractParent, bundleName);
    const manifest = await readJson(path.join(bundleRoot, MANIFEST_NAME));
    if (
      manifest.schemaVersion !== 1 ||
      manifest.version !== versions.version ||
      manifest.spfxVersion !== versions.spfxVersion ||
      manifest.tag !== tag ||
      manifest.commit !== commit ||
      manifest.cdnBasePath !==
        (await readJson(path.join(rootDir, 'config', 'write-manifests.json'))).cdnBasePath ||
      manifest.nodeVersion !== (await readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim()
    ) {
      throw new Error('CDN bundle manifest release identity does not match the requested release');
    }

    const actualPayloadFiles = (await walkFiles(bundleRoot)).filter(
      (file) => file !== MANIFEST_NAME,
    );
    const manifestPaths = manifest.files.map((file) => file.path);
    if (
      JSON.stringify(manifestPaths) !== JSON.stringify([...manifestPaths].sort()) ||
      new Set(manifestPaths).size !== manifestPaths.length
    ) {
      throw new Error('CDN bundle manifest paths must be unique and sorted');
    }
    if (JSON.stringify(actualPayloadFiles) !== JSON.stringify(manifestPaths)) {
      throw new Error('CDN bundle files do not exactly match RELEASE-MANIFEST.json');
    }
    if (!manifestPaths.some((file) => file.startsWith('assets/'))) {
      throw new Error('CDN bundle does not contain generated assets');
    }
    if (!manifestPaths.some((file) => file.startsWith('manifests/'))) {
      throw new Error('CDN bundle does not contain generated manifests');
    }

    for (const entry of manifest.files) {
      const filePath = path.join(bundleRoot, ...entry.path.split('/'));
      const fileStat = await stat(filePath);
      if (fileStat.size !== entry.size || (await sha256(filePath)) !== entry.sha256) {
        throw new Error(`CDN bundle manifest mismatch for ${entry.path}`);
      }
    }

    const bundledSppkg = path.join(bundleRoot, 'sharepoint', standaloneName);
    validateSppkg(bundledSppkg, sppkgIdentity);
    if ((await sha256(bundledSppkg)) !== (await sha256(standalonePath))) {
      throw new Error('Bundled SPPKG is not byte-identical to the standalone release asset');
    }
  } finally {
    await rm(extractParent, { recursive: true, force: true });
  }

  return { standalonePath, zipPath, checksumsPath };
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
      allowPlaceholderCdn: options.allowPlaceholderCdn,
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
    console.log(`Verified release checksums and archive integrity in ${outputDir}`);
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
