#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  EB_GARAMOND_ASSET_DIRECTORY,
  EB_GARAMOND_FONT_FILES,
  EB_GARAMOND_LICENSE,
  EB_GARAMOND_STYLESHEET,
  validateEbGaramondAssets,
} from './copy-eb-garamond-assets.mjs';

const STYLESHEET_PATH = `${EB_GARAMOND_ASSET_DIRECTORY}/${EB_GARAMOND_STYLESHEET}`;
const FORBIDDEN_FONT_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/i;

async function walkFiles(rootDir, relativeDir = '') {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function listZipEntries(archivePath) {
  const result = spawnSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Could not inspect ${archivePath}: ${result.stderr || result.stdout}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function verifyRuntimeReference(assetsRoot) {
  const textFiles = (await walkFiles(assetsRoot)).filter((file) => /\.(?:css|js|json)$/i.test(file));
  const contents = await Promise.all(
    textFiles.map(async (file) => ({
      file,
      content: await readFile(path.join(assetsRoot, file), 'utf8'),
    })),
  );
  if (!contents.some(({ content }) => content.includes(STYLESHEET_PATH))) {
    throw new Error(`Production assets do not reference ${STYLESHEET_PATH}`);
  }
  const forbiddenReference = contents.find(({ content }) => FORBIDDEN_FONT_HOSTS.test(content));
  if (forbiddenReference) {
    throw new Error(`Production font assets reference a third-party font host in ${forbiddenReference.file}`);
  }
}

async function findGeneratedSppkg(rootDir) {
  const solutionDir = path.join(rootDir, 'sharepoint', 'solution');
  const packages = (await readdir(solutionDir))
    .filter((file) => file.endsWith('.sppkg'))
    .sort();
  if (packages.length !== 1) {
    throw new Error(`Expected exactly one generated SPPKG, found ${packages.length}`);
  }
  return path.join(solutionDir, packages[0]);
}

export async function verifyEbGaramondBuild({ appDir = process.cwd() } = {}) {
  const rootDir = path.resolve(appDir);
  const releaseAssets = path.join(rootDir, 'release', 'assets');
  const deployAssets = path.join(rootDir, 'temp', 'deploy');
  await validateEbGaramondAssets(releaseAssets);
  await validateEbGaramondAssets(deployAssets);
  await verifyRuntimeReference(releaseAssets);

  const packageSolution = JSON.parse(
    await readFile(path.join(rootDir, 'config', 'package-solution.json'), 'utf8'),
  );
  const sppkgPath = await findGeneratedSppkg(rootDir);
  const sppkgEntries = listZipEntries(sppkgPath);
  const expectedAssetFiles = [
    EB_GARAMOND_STYLESHEET,
    ...EB_GARAMOND_FONT_FILES,
    EB_GARAMOND_LICENSE,
  ].map((file) => `${EB_GARAMOND_ASSET_DIRECTORY}/${file}`);
  const embeddedAssetFiles = expectedAssetFiles.filter((expected) =>
    sppkgEntries.some((entry) => entry.replaceAll('\\', '/').endsWith(expected)),
  );

  if (packageSolution.solution.includeClientSideAssets === true) {
    if (embeddedAssetFiles.length !== expectedAssetFiles.length) {
      throw new Error(
        `Embedded SPPKG is missing EB Garamond assets: ${expectedAssetFiles
          .filter((file) => !embeddedAssetFiles.includes(file))
          .join(', ')}`,
      );
    }
  } else if (embeddedAssetFiles.length > 0) {
    throw new Error('CDN SPPKG unexpectedly embeds EB Garamond client-side assets');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyEbGaramondBuild({
    appDir: process.argv.includes('--app')
      ? process.argv[process.argv.indexOf('--app') + 1]
      : '.',
  });
}
