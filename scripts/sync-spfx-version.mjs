#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function inspectVersions(rootDir = process.cwd()) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageLockPath = path.join(rootDir, 'package-lock.json');
  const solutionPath = path.join(rootDir, 'config', 'package-solution.json');
  const releaseManifestPath = path.join(rootDir, '.release-please-manifest.json');
  const [packageJson, packageLock, solutionConfig, releaseManifest] = await Promise.all([
    readJson(packageJsonPath),
    readJson(packageLockPath),
    readJson(solutionPath),
    readJson(releaseManifestPath),
  ]);

  const version = packageJson.version;
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`package.json version must be stable SemVer (x.y.z), received: ${version}`);
  }

  const spfxVersion = `${version}.0`;
  const errors = [];
  if (packageLock.version !== version) {
    errors.push(`package-lock.json version is ${packageLock.version}; expected ${version}`);
  }
  if (packageLock.packages?.['']?.version !== version) {
    errors.push(
      `package-lock.json root package version is ${packageLock.packages?.['']?.version}; expected ${version}`,
    );
  }
  if (releaseManifest['.'] !== version) {
    errors.push(`.release-please-manifest.json version is ${releaseManifest['.']}; expected ${version}`);
  }
  if (solutionConfig.solution?.version !== spfxVersion) {
    errors.push(
      `config/package-solution.json solution version is ${solutionConfig.solution?.version}; expected ${spfxVersion}`,
    );
  }

  const features = solutionConfig.solution?.features ?? [];
  for (const [index, feature] of features.entries()) {
    if (feature.version !== spfxVersion) {
      errors.push(
        `config/package-solution.json feature ${index} version is ${feature.version}; expected ${spfxVersion}`,
      );
    }
  }

  return {
    errors,
    packageJson,
    packageLock,
    releaseManifest,
    solutionConfig,
    solutionPath,
    spfxVersion,
    version,
  };
}

export async function syncSpfxVersion(rootDir = process.cwd()) {
  const state = await inspectVersions(rootDir);
  const nonSpfxErrors = state.errors.filter(
    (error) => !error.startsWith('config/package-solution.json'),
  );
  if (nonSpfxErrors.length > 0) {
    throw new Error(
      `Release Please version files are inconsistent:\n- ${nonSpfxErrors.join('\n- ')}`,
    );
  }

  state.solutionConfig.solution.version = state.spfxVersion;
  for (const feature of state.solutionConfig.solution.features ?? []) {
    feature.version = state.spfxVersion;
  }
  await writeFile(state.solutionPath, `${JSON.stringify(state.solutionConfig, null, 2)}\n`);
  return inspectVersions(rootDir);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const state = checkOnly ? await inspectVersions() : await syncSpfxVersion();
  if (state.errors.length > 0) {
    throw new Error(`Release versions are not synchronized:\n- ${state.errors.join('\n- ')}`);
  }
  console.log(`Release versions are synchronized at ${state.version} (SPFx ${state.spfxVersion}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
