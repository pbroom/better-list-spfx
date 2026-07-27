#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function parseStableVersion(value) {
  const match = SEMVER_PATTERN.exec(value ?? '');
  if (!match) {
    throw new Error(`Version must be stable SemVer (x.y.z), received: ${value}`);
  }
  return match.slice(1).map(Number);
}

export function compareStableVersions(left, right) {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }
  return 0;
}

export function nextPatchVersion(version) {
  const [major, minor, patch] = parseStableVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

export async function readPackageVersion(stream = process.stdin) {
  let text = '';
  for await (const chunk of stream) {
    text += chunk;
  }
  const version = JSON.parse(text).version;
  parseStableVersion(version);
  return version;
}

export async function inspectVersions(rootDir = process.cwd()) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageLockPath = path.join(rootDir, 'package-lock.json');
  const solutionPath = path.join(rootDir, 'config', 'package-solution.json');
  const [packageJson, packageLock, solutionConfig] = await Promise.all([
    readJson(packageJsonPath),
    readJson(packageLockPath),
    readJson(solutionPath),
  ]);

  const version = packageJson.version;
  parseStableVersion(version);

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
    packageJsonPath,
    packageLock,
    packageLockPath,
    solutionConfig,
    solutionPath,
    spfxVersion,
    version,
  };
}

export async function synchronizeVersion(version, rootDir = process.cwd()) {
  parseStableVersion(version);
  const state = await inspectVersions(rootDir);
  const spfxVersion = `${version}.0`;
  state.packageJson.version = version;
  state.packageLock.version = version;
  if (!state.packageLock.packages?.['']) {
    throw new Error('package-lock.json is missing its root package entry');
  }
  state.packageLock.packages[''].version = version;
  state.solutionConfig.solution.version = spfxVersion;
  for (const feature of state.solutionConfig.solution.features ?? []) {
    feature.version = spfxVersion;
  }
  await Promise.all([
    writeJson(state.packageJsonPath, state.packageJson),
    writeJson(state.packageLockPath, state.packageLock),
    writeJson(state.solutionPath, state.solutionConfig),
  ]);
  return inspectVersions(rootDir);
}

export async function syncSpfxVersion(rootDir = process.cwd()) {
  const state = await inspectVersions(rootDir);
  const nonSpfxErrors = state.errors.filter(
    (error) => !error.startsWith('config/package-solution.json'),
  );
  if (nonSpfxErrors.length > 0) {
    throw new Error(`Canonical version files are inconsistent:\n- ${nonSpfxErrors.join('\n- ')}`);
  }

  state.solutionConfig.solution.version = state.spfxVersion;
  for (const feature of state.solutionConfig.solution.features ?? []) {
    feature.version = state.spfxVersion;
  }
  await writeJson(state.solutionPath, state.solutionConfig);
  return inspectVersions(rootDir);
}

export async function setNewerVersion(version, rootDir = process.cwd()) {
  const state = await inspectVersions(rootDir);
  if (state.errors.length > 0) {
    throw new Error(`Cannot set a version from inconsistent files:\n- ${state.errors.join('\n- ')}`);
  }
  if (compareStableVersions(version, state.version) <= 0) {
    throw new Error(`${version} must be newer than ${state.version}`);
  }
  return synchronizeVersion(version, rootDir);
}

export async function bumpPatchVersion(rootDir = process.cwd()) {
  const state = await inspectVersions(rootDir);
  if (state.errors.length > 0) {
    throw new Error(`Cannot bump inconsistent versions:\n- ${state.errors.join('\n- ')}`);
  }
  return synchronizeVersion(nextPatchVersion(state.version), rootDir);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--print-package-version') {
    console.log(await readPackageVersion());
    return;
  }

  let state;
  if (args.length === 1 && args[0] === '--check') {
    state = await inspectVersions();
  } else if (args.length === 1 && args[0] === '--bump-patch') {
    state = await bumpPatchVersion();
  } else if (args.length === 2 && args[0] === '--set') {
    state = await setNewerVersion(args[1]);
  } else if (args.length === 2 && args[0] === '--assert-newer-than') {
    state = await inspectVersions();
    if (compareStableVersions(state.version, args[1]) <= 0) {
      throw new Error(`${state.version} must be newer than ${args[1]}`);
    }
  } else {
    throw new Error(
      'Usage: sync-spfx-version.mjs --check | --bump-patch | --set X.Y.Z | --assert-newer-than X.Y.Z | --print-package-version',
    );
  }
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
