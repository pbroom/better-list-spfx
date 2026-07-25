#!/usr/bin/env node

import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CDN_TEMPLATE_SENTINEL } from './materialize-cdn-package.mjs';

export const EMBEDDED_CDN_BASE_PATH = '<!-- PATH TO CDN -->';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

async function writeBuildMode({
  workspace,
  packageSolution,
  writeManifests,
  includeClientSideAssets,
  cdnBasePath,
}) {
  const nextPackageSolution = structuredClone(packageSolution);
  nextPackageSolution.solution.includeClientSideAssets = includeClientSideAssets;
  const nextWriteManifests = structuredClone(writeManifests);
  nextWriteManifests.cdnBasePath = cdnBasePath;
  await Promise.all([
    writeJson(path.join(workspace, 'config', 'package-solution.json'), nextPackageSolution),
    writeJson(path.join(workspace, 'config', 'write-manifests.json'), nextWriteManifests),
  ]);
}

const EXCLUDED_TOP_LEVEL_PATHS = new Set([
  '.git',
  '.heft',
  'coverage',
  'dist',
  'lib',
  'lib-commonjs',
  'node_modules',
  'release-build',
  'release-output',
  'temp',
]);

async function createBuildWorkspace(rootDir, parentDir, name) {
  const workspace = path.join(parentDir, name);
  await cp(rootDir, workspace, {
    recursive: true,
    filter(source) {
      const relativePath = path.relative(rootDir, source);
      if (!relativePath) return true;
      const normalized = relativePath.split(path.sep).join('/');
      const [topLevel] = normalized.split('/');
      if (EXCLUDED_TOP_LEVEL_PATHS.has(topLevel)) return false;
      if (normalized === 'release/assets' || normalized.startsWith('release/assets/')) {
        return false;
      }
      if (
        normalized === 'sharepoint/solution' ||
        normalized.startsWith('sharepoint/solution/')
      ) {
        return false;
      }
      return true;
    },
  });
  const dependencies = path.join(rootDir, 'node_modules');
  await access(dependencies);
  await symlink(dependencies, path.join(workspace, 'node_modules'), 'junction');
  return workspace;
}

export async function buildReleaseVariants({ rootDir = process.cwd() } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const packageSolutionPath = path.join(absoluteRoot, 'config', 'package-solution.json');
  const writeManifestsPath = path.join(absoluteRoot, 'config', 'write-manifests.json');
  const releaseBuildDir = path.join(absoluteRoot, 'release-build');
  const standalonePath = path.join(releaseBuildDir, 'standalone.sppkg');
  const cdnTemplatePath = path.join(releaseBuildDir, 'cdn-template.sppkg');
  const cdnAssetsPath = path.join(releaseBuildDir, 'cdn-assets');

  const [packageSolution, writeManifests] = await Promise.all([
    readJson(packageSolutionPath),
    readJson(writeManifestsPath),
  ]);

  if (
    packageSolution.solution?.includeClientSideAssets !== true ||
    writeManifests.cdnBasePath !== EMBEDDED_CDN_BASE_PATH
  ) {
    throw new Error(
      'Canonical release configuration must embed client-side assets and use the SPFx CDN placeholder.',
    );
  }

  await rm(releaseBuildDir, { recursive: true, force: true });
  await mkdir(releaseBuildDir, { recursive: true });

  const tempParent = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-build-'));
  try {
    const standaloneWorkspace = await createBuildWorkspace(
      absoluteRoot,
      tempParent,
      'standalone',
    );
    await writeBuildMode({
      workspace: standaloneWorkspace,
      packageSolution,
      writeManifests,
      includeClientSideAssets: true,
      cdnBasePath: EMBEDDED_CDN_BASE_PATH,
    });
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'ship'], {
      cwd: standaloneWorkspace,
    });
    await copyFile(await findGeneratedSppkg(standaloneWorkspace), standalonePath);

    const cdnWorkspace = await createBuildWorkspace(absoluteRoot, tempParent, 'cdn');
    await writeBuildMode({
      workspace: cdnWorkspace,
      packageSolution,
      writeManifests,
      includeClientSideAssets: false,
      cdnBasePath: CDN_TEMPLATE_SENTINEL,
    });
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'ship'], {
      cwd: cdnWorkspace,
    });
    await Promise.all([
      copyFile(await findGeneratedSppkg(cdnWorkspace), cdnTemplatePath),
      cp(path.join(cdnWorkspace, 'release', 'assets'), cdnAssetsPath, {
        recursive: true,
      }),
    ]);
  } finally {
    await rm(tempParent, { recursive: true, force: true });
  }

  return { cdnAssetsPath, cdnTemplatePath, standalonePath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildReleaseVariants()
    .then(({ cdnTemplatePath, standalonePath }) => {
      console.log(`Built self-contained package: ${standalonePath}`);
      console.log(`Built CDN package template: ${cdnTemplatePath}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
