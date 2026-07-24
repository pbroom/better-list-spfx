#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CDN_TEMPLATE_SENTINEL = 'https://cdn.invalid/better-list-spfx/';

const MAX_TOOL_OUTPUT = 256 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 1024;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const RELEASE_MANIFEST_NAME = 'RELEASE-MANIFEST.json';
const REPRODUCIBLE_TIMESTAMP = new Date('1980-01-01T00:00:00.000Z');

function run(command, args, { capture = false, cwd, input } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: capture ? null : 'utf8',
    env: { ...process.env, TZ: 'UTC' },
    input,
    maxBuffer: MAX_TOOL_OUTPUT,
    stdio: capture ? 'pipe' : input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });
  if (result.error) {
    throw new Error(`Required command is unavailable: ${command}`, { cause: result.error });
  }
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : (result.stderr ?? '');
    const stdout = Buffer.isBuffer(result.stdout)
      ? result.stdout.toString('utf8')
      : (result.stdout ?? '');
    throw new Error(`${command} exited with status ${result.status}: ${stderr || stdout}`.trim());
  }
  return capture ? result.stdout : undefined;
}

export function requireZipTools() {
  run('zip', ['-v'], { capture: true });
  run('unzip', ['-v'], { capture: true });
}

export function normalizeCdnBasePath(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`CDN base path must be a valid HTTPS URL: ${value}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('CDN base path must use HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new Error('CDN base path may not contain credentials');
  }
  if (parsed.search || parsed.href.includes('?')) {
    throw new Error('CDN base path may not contain a query string');
  }
  if (parsed.hash || parsed.href.includes('#')) {
    throw new Error('CDN base path may not contain a fragment');
  }
  if (!parsed.hostname) {
    throw new Error('CDN base path must include a hostname');
  }
  parsed.pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return parsed.href;
}

function validateArchivePath(entryName) {
  if (
    !entryName ||
    entryName.includes('\0') ||
    /[\r\n]/.test(entryName) ||
    entryName.includes('\\') ||
    entryName.startsWith('/') ||
    /^[A-Za-z]:/.test(entryName)
  ) {
    throw new Error(`Unsafe ZIP entry path: ${JSON.stringify(entryName)}`);
  }
  const isDirectory = entryName.endsWith('/');
  const pathValue = isDirectory ? entryName.slice(0, -1) : entryName;
  const segments = pathValue.split('/');
  if (
    !pathValue ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe ZIP entry path: ${entryName}`);
  }
  return { isDirectory, segments };
}

function parseArchiveEntryMetadata(archivePath) {
  const details = run('unzip', ['-Z', '-l', archivePath], { capture: true }).toString('utf8');
  return details
    .split(/\r?\n/)
    .filter((line) => /^[-dl][rwx-]{5,}\s/.test(line))
    .map((line) => {
      const match =
        /^([-dl][rwx-]{5,})\s+\S+\s+\S+\s+(\d+)\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(
          line,
        );
      if (!match) {
        throw new Error('ZIP entry metadata is ambiguous or unsupported');
      }
      return {
        compressedSize: Number(match[3]),
        name: match[4],
        type: match[1][0],
        uncompressedSize: Number(match[2]),
      };
    });
}

export function inspectArchiveEntries(archivePath, {
  maxArchiveBytes = MAX_ARCHIVE_BYTES,
  maxCompressionRatio = MAX_COMPRESSION_RATIO,
  maxEntries = MAX_ARCHIVE_ENTRIES,
  maxEntryBytes = MAX_ENTRY_BYTES,
  maxUncompressedBytes = MAX_UNCOMPRESSED_BYTES,
} = {}) {
  const archiveSize = statSync(archivePath).size;
  if (archiveSize > maxArchiveBytes) {
    throw new Error(`ZIP archive exceeds ${maxArchiveBytes} bytes`);
  }
  const listing = run('unzip', ['-Z1', archivePath], { capture: true }).toString('utf8');
  const entryNames = listing.endsWith('\n')
    ? listing.slice(0, -1).split(/\r?\n/)
    : listing.split(/\r?\n/);
  const entryMetadata = parseArchiveEntryMetadata(archivePath);
  if (entryNames.length !== entryMetadata.length) {
    throw new Error('ZIP entry metadata is ambiguous or contains unsupported names');
  }
  if (entryNames.length > maxEntries) {
    throw new Error(`ZIP archive contains more than ${maxEntries} entries`);
  }

  const exactNames = new Set();
  const portableNames = new Set();
  let totalUncompressedSize = 0;
  return entryNames.map((name, index) => {
    const validated = validateArchivePath(name);
    const metadata = entryMetadata[index];
    const { compressedSize, type, uncompressedSize } = metadata;
    if (metadata.name !== name) {
      throw new Error('ZIP entry listings disagree about an entry name');
    }
    if (type !== '-' && type !== 'd') {
      throw new Error(`ZIP entry is not a regular file or directory: ${name}`);
    }
    if ((type === 'd') !== validated.isDirectory) {
      throw new Error(`ZIP entry type does not match its path: ${name}`);
    }
    if (exactNames.has(name)) {
      throw new Error(`Duplicate ZIP entry: ${name}`);
    }
    exactNames.add(name);
    const portableName = name.normalize('NFC').toLowerCase();
    if (portableNames.has(portableName)) {
      throw new Error(`ZIP entries collide on a portable filesystem: ${name}`);
    }
    portableNames.add(portableName);
    if (uncompressedSize > maxEntryBytes) {
      throw new Error(`ZIP entry exceeds ${maxEntryBytes} bytes: ${name}`);
    }
    totalUncompressedSize += uncompressedSize;
    if (totalUncompressedSize > maxUncompressedBytes) {
      throw new Error(`ZIP archive expands beyond ${maxUncompressedBytes} bytes`);
    }
    if (
      uncompressedSize > 0 &&
      uncompressedSize / Math.max(compressedSize, 1) > maxCompressionRatio
    ) {
      throw new Error(`ZIP entry has an excessive compression ratio: ${name}`);
    }
    if (
      validated.segments.some((segment) => segment.toLowerCase() === 'clientsideassets')
    ) {
      throw new Error(`CDN template may not contain embedded ClientSideAssets entries: ${name}`);
    }
    return { compressedSize, name, type, uncompressedSize, ...validated };
  });
}

function decodeXmlAttribute(value) {
  return value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|quot|apos|lt|gt|amp);/gi,
    (entity, body) => {
      const normalized = body.toLowerCase();
      if (normalized === 'quot') return '"';
      if (normalized === 'apos') return "'";
      if (normalized === 'lt') return '<';
      if (normalized === 'gt') return '>';
      if (normalized === 'amp') return '&';
      const codePoint = normalized.startsWith('#x')
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        throw new Error(`Invalid XML character reference: ${entity}`);
      }
    },
  );
}

function encodeXmlAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function rewriteComponentManifests(xml, cdnBasePath) {
  let componentCount = 0;
  let replacementCount = 0;
  const rewritten = xml.replace(
    /<(?:[A-Za-z_][\w.-]*:)?ClientSideComponent\b[^>]*>/g,
    (element) => {
      componentCount += 1;
      const attributes = Array.from(
        element.matchAll(/\bComponentManifest\s*=\s*(["'])([\s\S]*?)\1/g),
      );
      if (attributes.length !== 1) {
        throw new Error(
          `ClientSideComponent must contain exactly one ComponentManifest attribute; found ${attributes.length}`,
        );
      }
      const attribute = attributes[0];
      let manifest;
      try {
        manifest = JSON.parse(decodeXmlAttribute(attribute[2]));
      } catch (error) {
        throw new Error('ClientSideComponent ComponentManifest is not valid JSON', {
          cause: error,
        });
      }
      const baseUrls = manifest?.loaderConfig?.internalModuleBaseUrls;
      if (
        !Array.isArray(baseUrls) ||
        baseUrls.length !== 1 ||
        baseUrls[0] !== CDN_TEMPLATE_SENTINEL
      ) {
        throw new Error(
          `ClientSideComponent must contain exactly one template CDN base URL (${CDN_TEMPLATE_SENTINEL})`,
        );
      }
      manifest.loaderConfig.internalModuleBaseUrls = [cdnBasePath];
      replacementCount += 1;
      const encodedManifest = encodeXmlAttribute(JSON.stringify(manifest));
      const attributeStart = attribute.index;
      const attributeEnd = attributeStart + attribute[0].length;
      const quote = attribute[1];
      return (
        `${element.slice(0, attributeStart)}ComponentManifest=${quote}` +
        `${encodedManifest}${quote}${element.slice(attributeEnd)}`
      );
    },
  );
  return { componentCount, replacementCount, xml: rewritten };
}

async function walkRegularFiles(rootDir, relativeDir = '') {
  const absoluteDir = path.join(rootDir, ...relativeDir.split('/').filter(Boolean));
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const absolutePath = path.join(rootDir, ...relativePath.split('/'));
    const fileStat = await lstat(absolutePath);
    if (fileStat.isSymbolicLink()) {
      throw new Error(`Extracted package contains a symbolic link: ${relativePath}`);
    }
    if (fileStat.isDirectory()) {
      files.push(...(await walkRegularFiles(rootDir, relativePath)));
    } else if (fileStat.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Extracted package contains a non-regular entry: ${relativePath}`);
    }
  }
  return files.sort();
}

async function normalizeFiles(rootDir, files) {
  for (const relativePath of files) {
    const absolutePath = path.join(rootDir, ...relativePath.split('/'));
    await chmod(absolutePath, 0o644);
    await utimes(absolutePath, REPRODUCIBLE_TIMESTAMP, REPRODUCIBLE_TIMESTAMP);
  }
}

function defaultOutputPath(templatePath) {
  const parsed = path.parse(templatePath);
  const baseName = parsed.ext.toLowerCase() === '.sppkg' ? parsed.name : parsed.base;
  return path.join(parsed.dir, `${baseName}-materialized.sppkg`);
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function readXmlAttribute(xml, attribute) {
  return new RegExp(`\\b${attribute}="([^"]+)"`).exec(xml)?.[1];
}

function validateManifestPath(relativePath) {
  const validated = validateArchivePath(relativePath);
  if (validated.isDirectory) {
    throw new Error(`Release manifest may only list files: ${relativePath}`);
  }
  return validated;
}

async function validateReleaseManifest(manifestPath, templatePath) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${RELEASE_MANIFEST_NAME}: ${manifestPath}`, { cause: error });
  }
  if (
    manifest.schemaVersion !== 1 ||
    manifest.artifactType !== 'cdn-deployment-kit' ||
    manifest.templateBasePath !== CDN_TEMPLATE_SENTINEL
  ) {
    throw new Error(`${RELEASE_MANIFEST_NAME} is not a supported CDN deployment kit manifest`);
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      manifest.productId ?? '',
    )
  ) {
    throw new Error(`${RELEASE_MANIFEST_NAME} has an invalid productId`);
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(manifest.spfxVersion ?? '')) {
    throw new Error(`${RELEASE_MANIFEST_NAME} has an invalid spfxVersion`);
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`${RELEASE_MANIFEST_NAME} has no payload checksums`);
  }
  const paths = manifest.files.map((entry) => entry?.path);
  if (
    paths.some((entry) => typeof entry !== 'string') ||
    JSON.stringify(paths) !== JSON.stringify([...paths].sort()) ||
    new Set(paths).size !== paths.length
  ) {
    throw new Error(`${RELEASE_MANIFEST_NAME} payload paths must be unique and sorted`);
  }

  const manifestRoot = path.dirname(manifestPath);
  let templateRecord;
  for (const entry of manifest.files) {
    const validated = validateManifestPath(entry.path);
    if (
      !Number.isInteger(entry.size) ||
      entry.size < 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')
    ) {
      throw new Error(`${RELEASE_MANIFEST_NAME} has invalid metadata for ${entry.path}`);
    }
    const filePath = path.join(manifestRoot, ...validated.segments);
    const fileStat = await lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new Error(`${RELEASE_MANIFEST_NAME} payload is not a regular file: ${entry.path}`);
    }
    if (fileStat.size !== entry.size || (await sha256(filePath)) !== entry.sha256) {
      throw new Error(`${RELEASE_MANIFEST_NAME} checksum mismatch for ${entry.path}`);
    }
    if (realpathSync(filePath) === realpathSync(templatePath)) {
      templateRecord = entry;
    }
  }
  if (!templateRecord) {
    throw new Error(`${RELEASE_MANIFEST_NAME} does not authenticate the selected template`);
  }

  const appManifest = run('unzip', ['-p', templatePath, 'AppManifest.xml'], {
    capture: true,
  }).toString('utf8');
  const productId = readXmlAttribute(appManifest, 'ProductID');
  const version = readXmlAttribute(appManifest, 'Version');
  if (productId?.toLowerCase() !== manifest.productId.toLowerCase()) {
    throw new Error(`Template ProductID ${productId} does not match ${RELEASE_MANIFEST_NAME}`);
  }
  if (version !== manifest.spfxVersion) {
    throw new Error(`Template version ${version} does not match ${RELEASE_MANIFEST_NAME}`);
  }
  return manifest;
}

async function assertDestinationAvailable(filePath) {
  try {
    await lstat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Refusing to overwrite existing output: ${filePath}`);
}

export async function materializeCdnPackage({
  template,
  cdnBasePath,
  output,
  manifest,
}) {
  if (!template) {
    throw new Error('--template is required');
  }
  if (!cdnBasePath) {
    throw new Error('--cdn-base-path is required');
  }
  requireZipTools();

  const templatePath = path.resolve(template);
  const outputPath = path.resolve(output ?? defaultOutputPath(templatePath));
  const manifestPath = path.resolve(
    manifest ?? path.join(path.dirname(templatePath), RELEASE_MANIFEST_NAME),
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  const canonicalOutputPath = path.join(
    realpathSync(path.dirname(outputPath)),
    path.basename(outputPath),
  );
  if (realpathSync(templatePath) === canonicalOutputPath) {
    throw new Error('Output path must differ from the template path');
  }
  const checksumPath = `${outputPath}.sha256`;
  await Promise.all([
    assertDestinationAvailable(outputPath),
    assertDestinationAvailable(checksumPath),
  ]);
  const normalizedCdnBasePath = normalizeCdnBasePath(cdnBasePath);
  const entries = inspectArchiveEntries(templatePath);
  if (!entries.some((entry) => entry.type === '-')) {
    throw new Error('CDN template contains no regular files');
  }
  const entryNames = new Set(entries.map((entry) => entry.name));
  for (const requiredEntry of ['[Content_Types].xml', '_rels/.rels', 'AppManifest.xml']) {
    if (!entryNames.has(requiredEntry)) {
      throw new Error(`CDN template is missing required OPC entry: ${requiredEntry}`);
    }
  }
  await validateReleaseManifest(manifestPath, templatePath);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'better-list-cdn-materialize-'));
  const extractRoot = path.join(tempRoot, 'package');
  const tempOutput = path.join(tempRoot, 'materialized.sppkg');
  try {
    await mkdir(extractRoot);
    run('unzip', ['-qq', templatePath, '-d', extractRoot]);

    for (const entry of entries) {
      const absolutePath = path.join(extractRoot, ...entry.segments);
      const entryStat = await lstat(absolutePath);
      if (entry.type === '-' && !entryStat.isFile()) {
        throw new Error(`Extracted ZIP entry is not a regular file: ${entry.name}`);
      }
      if (entry.type === 'd' && !entryStat.isDirectory()) {
        throw new Error(`Extracted ZIP entry is not a directory: ${entry.name}`);
      }
    }

    const extractedFiles = await walkRegularFiles(extractRoot);
    let replacementCount = 0;
    for (const relativePath of extractedFiles.filter((file) => file.toLowerCase().endsWith('.xml'))) {
      const absolutePath = path.join(extractRoot, ...relativePath.split('/'));
      const source = await readFile(absolutePath, 'utf8');
      if (!/<(?:[A-Za-z_][\w.-]*:)?ClientSideComponent\b/.test(source)) {
        continue;
      }
      const rewritten = rewriteComponentManifests(source, normalizedCdnBasePath);
      replacementCount += rewritten.replacementCount;
      await writeFile(absolutePath, rewritten.xml);
    }
    if (replacementCount === 0) {
      throw new Error('CDN template contains no replaceable ClientSideComponent manifests');
    }

    for (const relativePath of extractedFiles) {
      const content = await readFile(path.join(extractRoot, ...relativePath.split('/')));
      if (content.includes(Buffer.from(CDN_TEMPLATE_SENTINEL))) {
        throw new Error(`Template CDN sentinel remains after materialization: ${relativePath}`);
      }
    }

    await normalizeFiles(extractRoot, extractedFiles);
    run('zip', ['-0', '-X', '-q', tempOutput, '-@'], {
      cwd: extractRoot,
      input: `${extractedFiles.join('\n')}\n`,
    });
    run('unzip', ['-tq', tempOutput], { capture: true });
    inspectArchiveEntries(tempOutput);

    const digest = await sha256(tempOutput);
    const publishRoot = await mkdtemp(
      path.join(path.dirname(outputPath), '.better-list-materialize-'),
    );
    const stagedOutput = path.join(publishRoot, path.basename(outputPath));
    const stagedChecksum = path.join(publishRoot, `${path.basename(outputPath)}.sha256`);
    let checksumPublished = false;
    let outputPublished = false;
    try {
      await copyFile(tempOutput, stagedOutput);
      await writeFile(stagedChecksum, `${digest}  ${path.basename(outputPath)}\n`, {
        flag: 'wx',
      });
      await link(stagedChecksum, checksumPath);
      checksumPublished = true;
      await link(stagedOutput, outputPath);
      outputPublished = true;
    } catch (error) {
      if (outputPublished) {
        await rm(outputPath, { force: true });
      }
      if (checksumPublished) {
        await rm(checksumPath, { force: true });
      }
      throw error;
    } finally {
      await rm(publishRoot, { recursive: true, force: true });
    }
    return {
      cdnBasePath: normalizedCdnBasePath,
      checksumPath,
      outputPath,
      replacementCount,
      sha256: digest,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export function parseArguments(argv) {
  const options = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--template', '--cdn-base-path', '--output', '--manifest'].includes(argument)) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    if (seen.has(argument)) {
      throw new Error(`Duplicate argument: ${argument}`);
    }
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    if (argument === '--template') options.template = value;
    if (argument === '--cdn-base-path') options.cdnBasePath = value;
    if (argument === '--output') options.output = value;
    if (argument === '--manifest') options.manifest = value;
    index += 1;
  }
  return options;
}

async function main() {
  const result = await materializeCdnPackage(parseArguments(process.argv.slice(2)));
  console.log(`Materialized CDN package: ${result.outputPath}`);
  console.log(`SHA-256: ${result.sha256}`);
}

if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
