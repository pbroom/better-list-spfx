#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { compareStableVersions, parseStableVersion } from './sync-spfx-version.mjs';

const execFileAsync = promisify(execFile);
const FULL_SHA = /^[0-9a-f]{40}$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseReleaseTag(tag) {
  invariant(typeof tag === 'string' && tag.startsWith('v'), `Release tag must match vX.Y.Z: ${tag}`);
  const version = tag.slice(1);
  try {
    parseStableVersion(version);
  } catch {
    throw new Error(`Release tag must match vX.Y.Z: ${tag}`);
  }
  return {
    tag,
    version,
    branch: `release/${tag}`,
  };
}

export function compareReleaseTags(left, right) {
  return compareStableVersions(parseReleaseTag(left).version, parseReleaseTag(right).version);
}

export function expectedAssetNames(tag) {
  const { version } = parseReleaseTag(tag);
  return [
    `better-list-spfx-cdn-kit-${version}.zip`,
    `better-list-spfx-standalone-${version}.zip`,
  ];
}

export function selectLatestMode(currentTag, latestTag) {
  parseReleaseTag(currentTag);
  if (latestTag === null) return 'true';
  return compareReleaseTags(latestTag, currentTag) > 0 ? 'false' : 'true';
}

export function normalizeRelease(release) {
  invariant(release && typeof release === 'object', 'GitHub returned an invalid release');
  return {
    id: release.id ?? release.databaseId,
    tag: release.tag_name ?? release.tagName,
    target: release.target_commitish ?? release.targetCommitish,
    draft: release.draft ?? release.isDraft,
    name: release.name ?? '',
    body: release.body ?? '',
    url: release.html_url ?? release.url,
    assets: (release.assets ?? []).map((asset) => ({
      id: asset.id ?? asset.databaseId,
      name: asset.name,
      digest: asset.digest ?? null,
    })),
  };
}

export function validateRelease(releaseInput, { tag, sha, requireDraft = true, assets }) {
  const release = normalizeRelease(releaseInput);
  invariant(release.id !== undefined, 'Release is missing its database id');
  invariant(release.tag === tag, `Release identity changed to ${release.tag}, expected ${tag}`);
  invariant(release.target === sha, `Release target is ${release.target}, expected ${sha}`);
  invariant(release.draft === requireDraft, `${tag} must ${requireDraft ? 'remain a draft' : 'be published'}`);
  invariant(release.name.trim(), 'Release must have a title');
  invariant(release.body.trim(), 'Release must have a description');

  const expected = assets ? assets.map(({ name }) => name) : expectedAssetNames(tag);
  const actual = release.assets.map(({ name }) => name);
  invariant(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `Release assets must be exactly: ${expected.join(', ')}`,
  );

  if (assets) {
    for (const local of assets) {
      const remote = release.assets.find(({ name }) => name === local.name);
      invariant(remote.digest, `GitHub did not provide a digest for ${local.name}`);
      invariant(remote.digest === local.digest, `GitHub digest mismatch for ${local.name}`);
    }
  }
  return release;
}

async function sha256(file) {
  return `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
}

export async function inspectLocalAssets(directory, tag) {
  const names = (await readdir(directory)).sort();
  const expected = expectedAssetNames(tag);
  invariant(
    JSON.stringify(names) === JSON.stringify(expected),
    `Expected exactly the two versioned ZIP assets in ${directory}: ${expected.join(', ')}`,
  );
  return Promise.all(
    names.map(async (name) => {
      const file = path.join(directory, name);
      invariant((await stat(file)).isFile(), `Release asset is not a regular file: ${file}`);
      return { name, file, digest: await sha256(file) };
    }),
  );
}

function assertIdentity(tag, sha) {
  parseReleaseTag(tag);
  invariant(FULL_SHA.test(sha ?? ''), `Snapshot must be a full lowercase commit SHA: ${sha}`);
}

export async function prepareRelease(
  { repo, tag, sha, assetsDirectory, title, replace = false },
  github,
) {
  assertIdentity(tag, sha);
  const assets = await inspectLocalAssets(assetsDirectory, tag);
  invariant(!(await github.getTagRef(repo, tag)), `Tag ${tag} already exists; published versions cannot be rebuilt`);

  let release = await github.getReleaseByTag(repo, tag);
  if (!release) {
    release = await github.createDraft(repo, {
      tag,
      target: sha,
      title: title || `Better List ${tag}`,
    });
  } else {
    const current = normalizeRelease(release);
    invariant(current.draft, `${tag} is already published and cannot be replaced`);
    const expected = new Set(assets.map(({ name }) => name));
    const unexpected = current.assets.filter(({ name }) => !expected.has(name));
    const conflicting = current.assets.filter(({ name, digest }) => {
      const local = assets.find((asset) => asset.name === name);
      return local && digest !== local.digest;
    });
    const identityChanged = current.target !== sha;

    if (identityChanged || unexpected.length || conflicting.length) {
      invariant(
        replace,
        `Existing draft differs from the validated candidate; review it and rerun with replace enabled`,
      );
      const notes = await github.generateNotes(repo, { tag, target: sha });
      for (const asset of current.assets) await github.deleteAsset(repo, asset.id);
      release = await github.updateDraft(repo, current.id, {
        tag,
        target: sha,
        title: title || `Better List ${tag}`,
        body: notes,
      });
    }
  }

  let current = normalizeRelease(await github.getRelease(repo, normalizeRelease(release).id));
  for (const asset of assets) {
    const remote = current.assets.find(({ name }) => name === asset.name);
    if (!remote) await github.uploadAsset(repo, tag, asset.file);
  }

  current = validateRelease(await github.getRelease(repo, current.id), {
    tag,
    sha,
    assets,
  });
  invariant(!(await github.getTagRef(repo, tag)), 'Preparing a draft must not create the release tag');
  return current;
}

export async function inspectDraft({ repo, tag, sha, releaseId, assetsDirectory }, github) {
  assertIdentity(tag, sha);
  const raw = releaseId
    ? await github.getRelease(repo, releaseId)
    : await github.getReleaseByTag(repo, tag);
  invariant(raw, `Draft release ${tag} does not exist`);
  const assets = assetsDirectory ? await inspectLocalAssets(assetsDirectory, tag) : undefined;
  return validateRelease(raw, { tag, sha, assets });
}

async function compareDownloadedAssets(directory, assets) {
  const downloaded = await readdir(directory);
  invariant(
    JSON.stringify(downloaded.sort()) === JSON.stringify(assets.map(({ name }) => name).sort()),
    'Downloaded draft assets do not match the rebuilt asset set',
  );
  for (const asset of assets) {
    invariant(
      (await sha256(path.join(directory, asset.name))) === asset.digest,
      `Downloaded draft bytes differ for ${asset.name}`,
    );
  }
}

export async function publishRelease(
  { repo, tag, sha, releaseId, assetsDirectory },
  github,
) {
  assertIdentity(tag, sha);
  const assets = await inspectLocalAssets(assetsDirectory, tag);
  const branch = parseReleaseTag(tag).branch;
  invariant((await github.getBranchRef(repo, branch)) === sha, `${branch} moved after validation`);
  let release = validateRelease(await github.getRelease(repo, releaseId), { tag, sha, assets });

  const downloadDirectory = await mkdtemp(path.join(os.tmpdir(), 'better-list-release-'));
  try {
    await github.downloadRelease(repo, tag, downloadDirectory);
    await compareDownloadedAssets(downloadDirectory, assets);
  } finally {
    await rm(downloadDirectory, { recursive: true, force: true });
  }
  invariant((await github.getBranchRef(repo, branch)) === sha, `${branch} moved while assets were verified`);

  const tagSha = await github.getTagRef(repo, tag);
  if (tagSha === null) await github.createTagRef(repo, tag, sha);
  invariant((await github.resolveTag(repo, tag)) === sha, `${tag} does not point to the reviewed snapshot`);

  // Pinning the tag is a mutation boundary. Re-read every reviewed invariant afterward.
  release = validateRelease(await github.getRelease(repo, releaseId), { tag, sha, assets });
  invariant((await github.getBranchRef(repo, branch)) === sha, `${branch} moved while the tag was pinned`);
  const latest = await github.getLatestRelease(repo);
  const latestMode = selectLatestMode(tag, latest ? normalizeRelease(latest).tag : null);
  await github.publishRelease(repo, release.id, latestMode);
  return validateRelease(await github.getRelease(repo, release.id), {
    tag,
    sha,
    requireDraft: false,
    assets,
  });
}

function encodeRef(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

function statusFromError(error) {
  const text = `${error.stderr ?? ''}\n${error.stdout ?? ''}\n${error.message ?? ''}`;
  const match = text.match(/(?:HTTP|status(?: code)?)\D*(\d{3})/i);
  return match ? Number(match[1]) : null;
}

export function createGitHubClient(run = async (args) => execFileAsync('gh', args)) {
  const invoke = async (args) => {
    const result = await run(args);
    return typeof result === 'string' ? result : result.stdout;
  };
  const json = async (args) => JSON.parse(await invoke(args));
  const maybe = async (args) => {
    try {
      return await json(args);
    } catch (error) {
      if (statusFromError(error) === 404) return null;
      throw error;
    }
  };
  const api = (repo, endpoint, ...args) => ['api', `repos/${repo}/${endpoint}`, ...args];
  const field = (name, value) => ['-f', `${name}=${value}`];
  const typedField = (name, value) => ['-F', `${name}=${value}`];
  const patchRelease = (repo, id, values, typedValues = {}) =>
    json([
      ...api(repo, `releases/${id}`, '--method', 'PATCH'),
      ...Object.entries(values).flatMap(([name, value]) => field(name, String(value))),
      ...Object.entries(typedValues).flatMap(([name, value]) => typedField(name, String(value))),
    ]);

  return {
    async getTagRef(repo, tag) {
      const ref = await maybe(api(repo, `git/ref/tags/${encodeRef(tag)}`));
      return ref?.object?.sha ?? null;
    },
    async getBranchRef(repo, branch) {
      const ref = await maybe(api(repo, `git/ref/heads/${encodeRef(branch)}`));
      return ref?.object?.sha ?? null;
    },
    async getReleaseByTag(repo, tag) {
      const release = await maybe(api(repo, `releases/tags/${encodeURIComponent(tag)}`));
      if (release) return release;

      // GitHub's tag endpoint does not reliably expose an untagged draft. The
      // authenticated releases collection includes drafts visible to the token.
      const pages = await json(api(repo, 'releases?per_page=100', '--paginate', '--slurp'));
      const releases = Array.isArray(pages[0]) ? pages.flat() : pages;
      return releases.find((candidate) => candidate.tag_name === tag) ?? null;
    },
    getRelease: (repo, id) => json(api(repo, `releases/${id}`)),
    getLatestRelease: (repo) => maybe(api(repo, 'releases/latest')),
    createDraft: (repo, { tag, target, title }) =>
      json([
        ...api(repo, 'releases', '--method', 'POST'),
        ...field('tag_name', tag),
        ...field('target_commitish', target),
        ...field('name', title),
        ...typedField('draft', true),
        ...typedField('generate_release_notes', true),
      ]),
    async generateNotes(repo, { tag, target }) {
      const notes = await json([
        ...api(repo, 'releases/generate-notes', '--method', 'POST'),
        ...field('tag_name', tag),
        ...field('target_commitish', target),
      ]);
      return notes.body;
    },
    updateDraft: (repo, id, { tag, target, title, body }) =>
      patchRelease(
        repo,
        id,
        { tag_name: tag, target_commitish: target, name: title, body },
        { draft: true },
      ),
    async deleteAsset(repo, id) {
      await invoke(api(repo, `releases/assets/${id}`, '--method', 'DELETE'));
    },
    async uploadAsset(repo, tag, file) {
      await invoke(['release', 'upload', tag, file, '--repo', repo]);
    },
    async downloadRelease(repo, tag, directory) {
      await invoke(['release', 'download', tag, '--repo', repo, '--dir', directory]);
    },
    async createTagRef(repo, tag, sha) {
      await json([
        ...api(repo, 'git/refs', '--method', 'POST'),
        ...field('ref', `refs/tags/${tag}`),
        ...field('sha', sha),
      ]);
    },
    async resolveTag(repo, tag) {
      const commit = await json(api(repo, `commits/${encodeURIComponent(tag)}`));
      return commit.sha;
    },
    publishRelease: (repo, id, makeLatest) =>
      patchRelease(repo, id, { make_latest: makeLatest }, { draft: false }),
  };
}

function parseArguments(argv) {
  const command = argv.shift();
  const values = {};
  while (argv.length) {
    const key = argv.shift();
    invariant(key.startsWith('--') && argv.length, `Invalid argument: ${key}`);
    values[key.slice(2).replaceAll('-', '_')] = argv.shift();
  }
  return { command, values };
}

export function parseCommandOptions(argv, env = process.env) {
  const { command, values } = parseArguments([...argv]);
  const options = {
    repo: values.repo ?? env.GH_REPO,
    tag: values.tag ?? env.RELEASE_TAG,
    sha: values.sha ?? env.SNAPSHOT_SHA,
    releaseId: values.release_id ?? env.RELEASE_ID,
    assetsDirectory:
      values.assets_dir ?? (command === 'inspect' ? undefined : 'release-output'),
    title: values.title ?? env.REQUESTED_TITLE,
    replace: (values.replace ?? env.REPLACE_EXISTING_DRAFT) === 'true',
  };
  invariant(options.repo, 'Repository is required through --repo or GH_REPO');
  return { command, options };
}

async function main() {
  const { command, options } = parseCommandOptions(process.argv.slice(2));
  const github = createGitHubClient();
  let release;
  if (command === 'prepare') release = await prepareRelease(options, github);
  else if (command === 'inspect') release = await inspectDraft(options, github);
  else if (command === 'publish') release = await publishRelease(options, github);
  else {
    throw new Error(
      'Usage: release-lifecycle.mjs prepare|inspect|publish --repo OWNER/REPO --tag vX.Y.Z --sha FULL_SHA [--release-id ID] [--assets-dir DIR] [--title TITLE] [--replace true]',
    );
  }
  console.log(JSON.stringify(release));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
