import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const scriptPath = fileURLToPath(new URL('./verify-shared-foundation-monaco-contract.mjs', import.meta.url));
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');

test('rejects a coordinated vendored-source and provenance edit', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'better-list-monaco-contract-'));
  try {
    const sourcePath = path.join(fixtureRoot, 'src/vendor/shared-foundation/monacoResources.ts');
    const provenancePath = path.join(fixtureRoot, 'src/vendor/shared-foundation/monacoResources.provenance.json');
    await mkdir(path.dirname(sourcePath), { recursive: true });
    const source = `${await readFile(path.join(repositoryRoot, 'src/vendor/shared-foundation/monacoResources.ts'), 'utf8')}\n// coordinated tamper\n`;
    const provenance = JSON.parse(
      await readFile(path.join(repositoryRoot, 'src/vendor/shared-foundation/monacoResources.provenance.json'), 'utf8')
    );
    provenance.upstreamSourceSha256 = createHash('sha256').update(source).digest('hex');
    await Promise.all([
      writeFile(sourcePath, source),
      writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`),
      writeFile(
        path.join(fixtureRoot, 'package.json'),
        JSON.stringify({ dependencies: { 'monaco-editor': '0.55.1' } })
      )
    ]);

    await assert.rejects(
      run(process.execPath, [scriptPath], { cwd: fixtureRoot }),
      /provenance differs from the independently pinned contract/
    );
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});
