#!/usr/bin/env node
import path from 'node:path';
import { createRequire } from 'node:module';
import { cp, mkdir, rm } from 'node:fs/promises';

const appDir = path.resolve(process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : '.');
const appRequire = createRequire(path.join(appDir, 'package.json'));
const monacoPackagePath = appRequire.resolve('monaco-editor/package.json');
const monacoVsDir = path.join(path.dirname(monacoPackagePath), 'min', 'vs');
const targets = [path.join(appDir, 'release', 'assets', 'monaco-editor', 'min', 'vs')];
const tempDeploy = path.join(appDir, 'temp', 'deploy');
try {
  await mkdir(tempDeploy, { recursive: true });
  targets.push(path.join(tempDeploy, 'monaco-editor', 'min', 'vs'));
} catch {}
for (const target of targets) {
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(monacoVsDir, target, { recursive: true });
}
