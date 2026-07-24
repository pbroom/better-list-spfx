#!/usr/bin/env node

import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EB_GARAMOND_STYLESHEET = 'better-list-eb-garamond.css';
export const EB_GARAMOND_LICENSE = 'better-list-eb-garamond-OFL.txt';
export const EB_GARAMOND_FONT_FILES = [
  'better-list-eb-garamond-latin-wght-normal.woff2',
  'better-list-eb-garamond-latin-wght-italic.woff2',
];

const EXPECTED_FILES = [
  EB_GARAMOND_STYLESHEET,
  ...EB_GARAMOND_FONT_FILES,
  EB_GARAMOND_LICENSE,
].sort();
const EXPECTED_FONT_STYLES = ['normal', 'italic'];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assetPath(rootDir, fileName) {
  return path.join(rootDir, fileName);
}

export async function validateEbGaramondAssets(assetsRoot) {
  for (const file of EXPECTED_FILES) {
    if (!(await exists(assetPath(assetsRoot, file)))) {
      throw new Error(`Missing flat EB Garamond asset: ${file}`);
    }
  }

  const stylesheet = await readFile(assetPath(assetsRoot, EB_GARAMOND_STYLESHEET), 'utf8');
  if (/url\(\s*["']?(?:https?:|\/\/|data:|\/|\.\.\/)/i.test(stylesheet)) {
    throw new Error('EB Garamond stylesheet must use local, relative font URLs');
  }
  const faces = Array.from(stylesheet.matchAll(/@font-face\s*\{([\s\S]*?)\}/g), (match) => match[1]);
  if (faces.length !== EXPECTED_FONT_STYLES.length) {
    throw new Error(`Expected ${EXPECTED_FONT_STYLES.length} EB Garamond @font-face rules`);
  }
  for (const [index, style] of EXPECTED_FONT_STYLES.entries()) {
    const face = faces[index];
    const expectedFont = EB_GARAMOND_FONT_FILES[index];
    for (const required of [
      /font-family:\s*["']EB Garamond["']/,
      new RegExp(`font-style:\\s*${style}\\b`),
      /font-display:\s*swap\b/,
      /font-weight:\s*400\s+800\b/,
      new RegExp(`url\\(["']?\\./${expectedFont.replaceAll('.', '\\.')}["']?\\)`),
      /format\(["']woff2-variations["']\)/,
    ]) {
      if (!required.test(face)) {
        throw new Error(`Invalid EB Garamond ${style} @font-face declaration`);
      }
    }
  }

  for (const fontFile of EB_GARAMOND_FONT_FILES) {
    const font = await readFile(assetPath(assetsRoot, fontFile));
    if (font.length < 4 || font.subarray(0, 4).toString('ascii') !== 'wOF2') {
      throw new Error(`${fontFile} is not a WOFF2 font`);
    }
  }

  const license = await readFile(assetPath(assetsRoot, EB_GARAMOND_LICENSE), 'utf8');
  if (
    !license.includes('Copyright 2017 The EB Garamond Project Authors') ||
    !license.includes('SIL OPEN FONT LICENSE Version 1.1')
  ) {
    throw new Error('EB Garamond OFL.txt is missing its copyright or full OFL-1.1 notice');
  }
}

export async function copyEbGaramondAssets({ appDir = process.cwd() } = {}) {
  const rootDir = path.resolve(appDir);
  const appRequire = createRequire(path.join(rootDir, 'package.json'));
  const packageRoot = path.dirname(
    appRequire.resolve('@fontsource-variable/eb-garamond/package.json'),
  );
  const sourceRoot = path.join(rootDir, 'assets', 'fonts', 'eb-garamond');
  const targets = [
    path.join(rootDir, 'release', 'assets'),
    path.join(rootDir, 'temp', 'deploy'),
  ];

  for (const assetsRoot of targets) {
    await mkdir(assetsRoot, { recursive: true });
    const sourceStylesheet = await readFile(path.join(sourceRoot, 'eb-garamond.css'), 'utf8');
    await writeFile(
      assetPath(assetsRoot, EB_GARAMOND_STYLESHEET),
      sourceStylesheet
        .replaceAll('eb-garamond-latin-wght-normal.woff2', EB_GARAMOND_FONT_FILES[0])
        .replaceAll('eb-garamond-latin-wght-italic.woff2', EB_GARAMOND_FONT_FILES[1]),
    );
    for (const [index, fontFile] of EB_GARAMOND_FONT_FILES.entries()) {
      const sourceName = index === 0
        ? 'eb-garamond-latin-wght-normal.woff2'
        : 'eb-garamond-latin-wght-italic.woff2';
      await copyFile(path.join(packageRoot, 'files', sourceName), assetPath(assetsRoot, fontFile));
    }
    await copyFile(path.join(packageRoot, 'LICENSE'), assetPath(assetsRoot, EB_GARAMOND_LICENSE));
    await validateEbGaramondAssets(assetsRoot);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await copyEbGaramondAssets({
    appDir: process.argv.includes('--app')
      ? process.argv[process.argv.indexOf('--app') + 1]
      : '.',
  });
}
