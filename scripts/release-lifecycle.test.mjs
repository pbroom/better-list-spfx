import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  compareReleaseTags,
  createGitHubClient,
  expectedAssetNames,
  inspectDraft,
  inspectLocalAssets,
  normalizeRelease,
  parseCommandOptions,
  parseReleaseTag,
  prepareRelease,
  publishRelease,
  selectLatestMode,
  validateRelease,
} from './release-lifecycle.mjs';

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const TAG = 'v1.2.3';

async function fixtureAssets(tag = TAG) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'release-lifecycle-test-'));
  const [cdn, standalone] = expectedAssetNames(tag);
  await writeFile(path.join(directory, cdn), 'cdn bytes');
  await writeFile(path.join(directory, standalone), 'standalone bytes');
  return directory;
}

function clone(value) {
  return value === null ? null : structuredClone(value);
}

class FakeGitHub {
  constructor({ release = null, tagSha = null, branchSha = SHA, latest = null } = {}) {
    this.release = clone(release);
    this.tagSha = tagSha;
    this.branchSha = branchSha;
    this.latest = clone(latest);
    this.events = [];
    this.nextAssetId = 100;
  }

  async getTagRef() {
    return this.tagSha;
  }

  async getBranchRef() {
    return this.branchSha;
  }

  async getReleaseByTag() {
    return clone(this.release);
  }

  async getRelease() {
    return clone(this.release);
  }

  async getLatestRelease() {
    return clone(this.latest);
  }

  async createDraft(_repo, { tag, target, title }) {
    this.events.push('create-draft');
    this.release = {
      id: 7,
      tag_name: tag,
      target_commitish: target,
      draft: true,
      name: title,
      body: 'Generated notes',
      html_url: 'https://example.test/draft',
      assets: [],
    };
    return clone(this.release);
  }

  async generateNotes() {
    this.events.push('generate-notes');
    return 'Fresh notes';
  }

  async deleteAsset(_repo, id) {
    this.events.push(`delete:${id}`);
    this.release.assets = this.release.assets.filter((asset) => asset.id !== id);
  }

  async updateDraft(_repo, _id, { tag, target, title, body }) {
    this.events.push('update-draft');
    Object.assign(this.release, {
      tag_name: tag,
      target_commitish: target,
      name: title,
      body,
      draft: true,
    });
    return clone(this.release);
  }

  async uploadAsset(_repo, _tag, file) {
    const bytes = await readFile(file);
    const { createHash } = await import('node:crypto');
    this.release.assets.push({
      id: this.nextAssetId++,
      name: path.basename(file),
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    });
    this.events.push(`upload:${path.basename(file)}`);
  }

  async downloadRelease(_repo, _tag, directory) {
    this.events.push('download');
    for (const asset of this.release.assets) {
      await writeFile(path.join(directory, asset.name), this.assetContents[asset.name]);
    }
  }

  async createTagRef(_repo, _tag, sha) {
    this.events.push('create-tag');
    this.tagSha = sha;
  }

  async resolveTag() {
    return this.tagSha;
  }

  async publishRelease(_repo, _id, latestMode) {
    this.events.push(`publish:${latestMode}`);
    this.release.draft = false;
  }
}

test('parses the canonical release identity and expected assets', () => {
  assert.deepEqual(parseReleaseTag(TAG), {
    tag: TAG,
    version: '1.2.3',
    branch: 'release/v1.2.3',
  });
  assert.deepEqual(expectedAssetNames(TAG), [
    'better-list-spfx-cdn-kit-1.2.3.zip',
    'better-list-spfx-standalone-1.2.3.zip',
  ]);
  for (const tag of ['1.2.3', 'v01.2.3', 'v1.2', 'v1.2.3-beta.1']) {
    assert.throws(() => parseReleaseTag(tag), /must match vX\.Y\.Z/);
  }
});

test('CLI options require local assets only for prepare and publish', () => {
  const env = { GH_REPO: 'owner/repo', RELEASE_TAG: TAG, SNAPSHOT_SHA: SHA };
  assert.equal(parseCommandOptions(['inspect'], env).options.assetsDirectory, undefined);
  assert.equal(parseCommandOptions(['prepare'], env).options.assetsDirectory, 'release-output');
  assert.equal(parseCommandOptions(['publish'], env).options.assetsDirectory, 'release-output');
  assert.equal(
    parseCommandOptions(['inspect', '--assets-dir', 'rebuilt'], env).options.assetsDirectory,
    'rebuilt',
  );
});

test('compares arbitrarily large stable versions without losing precision', () => {
  assert.equal(compareReleaseTags('v1.0.9007199254740992', 'v1.0.9007199254740993'), -1);
  assert.equal(compareReleaseTags('v999999999999999999.0.0', 'v2.999999999999999999.0'), 1);
  assert.equal(selectLatestMode(TAG, null), 'true');
  assert.equal(selectLatestMode(TAG, 'v1.2.4'), 'false');
  assert.equal(selectLatestMode(TAG, 'v1.2.2'), 'true');
});

test('normalizes both REST and gh release view field names', () => {
  assert.deepEqual(
    normalizeRelease({
      databaseId: 2,
      tagName: TAG,
      targetCommitish: SHA,
      isDraft: true,
      name: 'Title',
      body: 'Body',
      url: 'url',
      assets: [{ databaseId: 9, name: 'file.zip', digest: 'sha256:abc' }],
    }),
    {
      id: 2,
      tag: TAG,
      target: SHA,
      draft: true,
      name: 'Title',
      body: 'Body',
      url: 'url',
      assets: [{ id: 9, name: 'file.zip', digest: 'sha256:abc' }],
    },
  );
});

test('local asset inspection requires exactly the canonical two-file contract', async () => {
  const directory = await fixtureAssets();
  const assets = await inspectLocalAssets(directory, TAG);
  assert.deepEqual(assets.map(({ name }) => name), expectedAssetNames(TAG));
  await writeFile(path.join(directory, 'surprise.zip'), 'unexpected');
  await assert.rejects(inspectLocalAssets(directory, TAG), /Expected exactly the two/);
});

test('release validation checks identity, review metadata, names, and digests', async () => {
  const directory = await fixtureAssets();
  const assets = await inspectLocalAssets(directory, TAG);
  const release = {
    id: 1,
    tag_name: TAG,
    target_commitish: SHA,
    draft: true,
    name: 'Better List',
    body: 'Notes',
    assets: assets.map(({ name, digest }, id) => ({ id, name, digest })),
  };
  assert.equal(validateRelease(release, { tag: TAG, sha: SHA, assets }).id, 1);
  assert.throws(
    () => validateRelease({ ...release, target_commitish: OTHER_SHA }, { tag: TAG, sha: SHA, assets }),
    /Release target/,
  );
  assert.throws(
    () => validateRelease({ ...release, body: '' }, { tag: TAG, sha: SHA, assets }),
    /description/,
  );
  const wrongDigest = structuredClone(release);
  wrongDigest.assets[0].digest = 'sha256:bad';
  assert.throws(() => validateRelease(wrongDigest, { tag: TAG, sha: SHA, assets }), /digest mismatch/);
});

test('prepare creates a pinned draft and uploads only the canonical assets', async () => {
  const directory = await fixtureAssets();
  const github = new FakeGitHub();
  const release = await prepareRelease(
    { repo: 'owner/repo', tag: TAG, sha: SHA, assetsDirectory: directory },
    github,
  );
  assert.equal(release.target, SHA);
  assert.deepEqual(release.assets.map(({ name }) => name).sort(), expectedAssetNames(TAG));
  assert.deepEqual(github.events, [
    'create-draft',
    `upload:${expectedAssetNames(TAG)[0]}`,
    `upload:${expectedAssetNames(TAG)[1]}`,
  ]);
});

test('prepare refuses drift unless replacement was explicitly requested', async () => {
  const directory = await fixtureAssets();
  const github = new FakeGitHub({
    release: {
      id: 7,
      tag_name: TAG,
      target_commitish: OTHER_SHA,
      draft: true,
      name: 'Old title',
      body: 'Old notes',
      assets: [{ id: 3, name: 'unexpected.zip', digest: 'sha256:old' }],
    },
  });
  await assert.rejects(
    prepareRelease({ repo: 'owner/repo', tag: TAG, sha: SHA, assetsDirectory: directory }, github),
    /rerun with replace enabled/,
  );
  const converged = await prepareRelease(
    {
      repo: 'owner/repo',
      tag: TAG,
      sha: SHA,
      assetsDirectory: directory,
      title: 'Reviewed title',
      replace: true,
    },
    github,
  );
  assert.equal(converged.name, 'Reviewed title');
  assert.deepEqual(github.events, [
    'generate-notes',
    'delete:3',
    'update-draft',
    `upload:${expectedAssetNames(TAG)[0]}`,
    `upload:${expectedAssetNames(TAG)[1]}`,
  ]);
});

test('inspect returns the release id without mutating GitHub', async () => {
  const names = expectedAssetNames(TAG);
  const github = new FakeGitHub({
    release: {
      id: 91,
      tag_name: TAG,
      target_commitish: SHA,
      draft: true,
      name: 'Title',
      body: 'Notes',
      assets: names.map((name, id) => ({ id, name, digest: `sha256:${id}` })),
    },
  });
  assert.equal((await inspectDraft({ repo: 'owner/repo', tag: TAG, sha: SHA }, github)).id, 91);
  assert.deepEqual(github.events, []);
});

test('publish revalidates bytes, pins the tag, and does not regress Latest', async () => {
  const directory = await fixtureAssets();
  const assets = await inspectLocalAssets(directory, TAG);
  const github = new FakeGitHub({
    release: {
      id: 7,
      tag_name: TAG,
      target_commitish: SHA,
      draft: true,
      name: 'Reviewed',
      body: 'Reviewed notes',
      assets: assets.map(({ name, digest }, id) => ({ id, name, digest })),
    },
    latest: {
      id: 8,
      tag_name: 'v2.0.0',
      target_commitish: OTHER_SHA,
      draft: false,
      name: 'Newer',
      body: 'Notes',
      assets: [],
    },
  });
  github.assetContents = Object.fromEntries(
    await Promise.all(assets.map(async ({ name, file }) => [name, await readFile(file)])),
  );
  const published = await publishRelease(
    { repo: 'owner/repo', tag: TAG, sha: SHA, releaseId: 7, assetsDirectory: directory },
    github,
  );
  assert.equal(published.draft, false);
  assert.deepEqual(github.events, ['download', 'create-tag', 'publish:false']);
});

test('publish stops before mutation when the branch or downloaded bytes drift', async () => {
  const directory = await fixtureAssets();
  const assets = await inspectLocalAssets(directory, TAG);
  const release = {
    id: 7,
    tag_name: TAG,
    target_commitish: SHA,
    draft: true,
    name: 'Reviewed',
    body: 'Reviewed notes',
    assets: assets.map(({ name, digest }, id) => ({ id, name, digest })),
  };
  const moved = new FakeGitHub({ release, branchSha: OTHER_SHA });
  await assert.rejects(
    publishRelease(
      { repo: 'owner/repo', tag: TAG, sha: SHA, releaseId: 7, assetsDirectory: directory },
      moved,
    ),
    /moved after validation/,
  );
  const changed = new FakeGitHub({ release });
  changed.assetContents = Object.fromEntries(assets.map(({ name }) => [name, Buffer.from('changed')]));
  await assert.rejects(
    publishRelease(
      { repo: 'owner/repo', tag: TAG, sha: SHA, releaseId: 7, assetsDirectory: directory },
      changed,
    ),
    /Downloaded draft bytes differ/,
  );
  assert.deepEqual(changed.events, ['download']);
});

test('GitHub client treats only HTTP 404 as absence', async () => {
  const missing = createGitHubClient(async () => {
    const error = new Error('gh failed');
    error.stderr = 'gh: Not Found (HTTP 404)';
    throw error;
  });
  assert.equal(await missing.getLatestRelease('owner/repo'), null);

  const unavailable = createGitHubClient(async () => {
    const error = new Error('gh failed');
    error.stderr = 'gh: API rate limit exceeded (HTTP 403)';
    throw error;
  });
  await assert.rejects(unavailable.getLatestRelease('owner/repo'), /gh failed/);
});

test('GitHub client discovers an untagged draft through the paginated release listing', async () => {
  const calls = [];
  const draft = {
    id: 42,
    tag_name: TAG,
    target_commitish: SHA,
    draft: true,
    name: 'Existing draft',
    body: 'Review me',
    assets: [],
  };
  const client = createGitHubClient(async (args) => {
    calls.push(args);
    if (args[1].includes('/releases/tags/')) {
      const error = new Error('gh failed');
      error.stderr = 'gh: Not Found (HTTP 404)';
      throw error;
    }
    return { stdout: JSON.stringify([[{ ...draft, tag_name: 'v1.2.2' }], [draft]]) };
  });

  assert.deepEqual(await client.getReleaseByTag('owner/repo', TAG), draft);
  assert.deepEqual(calls[1], [
    'api',
    'repos/owner/repo/releases?per_page=100',
    '--paginate',
    '--slurp',
  ]);
});

test('GitHub client emits REST mutations with explicit release policy fields', async () => {
  const calls = [];
  const client = createGitHubClient(async (args) => {
    calls.push(args);
    return { stdout: JSON.stringify({ id: 1, draft: args.includes('draft=false') ? false : true }) };
  });
  await client.createDraft('owner/repo', { tag: TAG, target: SHA, title: 'Title' });
  await client.publishRelease('owner/repo', 1, 'false');
  assert.deepEqual(calls[0], [
    'api',
    'repos/owner/repo/releases',
    '--method',
    'POST',
    '-f',
    `tag_name=${TAG}`,
    '-f',
    `target_commitish=${SHA}`,
    '-f',
    'name=Title',
    '-F',
    'draft=true',
    '-F',
    'generate_release_notes=true',
  ]);
  assert.ok(calls[1].includes('draft=false'));
  assert.ok(calls[1].includes('make_latest=false'));
  assert.equal(calls[1][calls[1].indexOf('draft=false') - 1], '-F');
  assert.equal(calls[1][calls[1].indexOf('make_latest=false') - 1], '-f');
});

test('fixture helper creates no hidden directories that weaken the asset contract', async () => {
  const directory = await fixtureAssets();
  await mkdir(path.join(directory, 'nested'));
  await assert.rejects(inspectLocalAssets(directory, TAG), /Expected exactly the two/);
});
