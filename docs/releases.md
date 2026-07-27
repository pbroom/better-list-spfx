# Releasing Better List

Better List keeps every merged `main` state versioned and releasable. Preparing
a release captures one exact `main` commit, runs a separate release-candidate
build, and saves a draft GitHub Release for human review. Publication is a
different command.

## Versioning main

`package.json` is the SemVer authority. The root versions in
`package-lock.json` and the solution and feature versions in
`config/package-solution.json` must match it; SPFx uses `x.y.z.0`.
`npm run version:check` rejects any drift.

On every `main` update (normally one pull-request merge),
`.github/workflows/version-main.yml` does one of two things:

- If the merged pull request already advanced all synchronized versions, it
  verifies that the new version is strictly greater and leaves it unchanged.
  Use this for an intentional minor or major jump.
- Otherwise, it patch-increments the latest `main`, validates the result, and
  pushes one version-only commit with a `Version-Bump-For` trailer.

Version jobs use optimistic retries, so closely spaced merge pushes are
processed individually even if their jobs overlap. A single unusual push that
contains several commits still represents one `main` update and gets one
increment. The trailer makes a rerun idempotent. The scoped `GITHUB_TOKEN` push
does not start another workflow run, preventing a bump loop.

Do not cut a release while **Version main** is still running. The cut workflow
also rejects a snapshot whose version did not advance from its first parent, so
an unversioned merge cannot be released during that short window.

To set a reviewed version intentionally:

```bash
npm run version:set -- 0.3.0
npm run version:check
```

Commit all three changed files together:

- `package.json`
- `package-lock.json`
- `config/package-solution.json`

Because the automatic patch commit updates these same lines after every merge,
rebase an intentional minor or major version pull request onto current `main`
immediately before merging it.

## Cut a release candidate

Run the workflow from the current `main` workflow definition:

```bash
gh workflow run prepare-release.yml --ref main
```

The dispatch event records the exact `main` SHA at command time. To prepare an
older reviewed point that is still reachable from `main`, provide its full SHA:

```bash
gh workflow run prepare-release.yml \
  --ref main \
  -f commit_sha=0123456789abcdef0123456789abcdef01234567
```

The workflow:

1. proves that SHA is reachable from `main` and carries a synchronized,
   newly-advanced version;
2. creates `release/vX.Y.Z` at exactly that SHA, or confirms an existing branch
   already points there;
3. installs from the lockfile and reruns the release tooling tests;
4. performs both real production builds;
5. constructs and verifies the deterministic standalone and CDN-kit ZIPs;
6. creates a draft `vX.Y.Z` GitHub Release targeted to the full snapshot SHA;
7. adds a title, generated release notes, and exactly the two validated assets;
8. verifies the remote SHA-256 digest of both assets; and
9. confirms that no Git tag was created while the release remains a draft.

The snapshot branch is a provenance anchor. It is deliberately retained after
publication.

### Existing draft safety

The workflow never changes a published release. It also stops when a draft for
the same version targets another commit or contains a different asset set.
Review that draft before explicitly reconciling it:

```bash
gh workflow run prepare-release.yml \
  --ref main \
  -f replace_existing_draft=true
```

That explicit option retargets the draft, regenerates its notes, removes its old
assets, and replaces them with the two newly validated ZIPs. A matching draft
for the same snapshot can be rerun without this option; its reviewed title and
description are preserved.

## Review the draft

Before publication, confirm:

- the title and description are complete;
- the version and snapshot SHA are the intended point on `main`;
- the Files section contains only the standalone and CDN-kit versioned ZIPs;
- the **Cut release candidate** run passed; and
- any product-specific smoke test or tenant validation required for this
  release is complete.

Draft metadata remains editable in GitHub. Editing the attached files is not
part of review; rebuild the candidate if an asset must change.

## Publish on command

Publish only the reviewed draft:

```bash
gh workflow run publish-release.yml \
  --ref main \
  -f release_tag=v0.2.0
```

`.github/workflows/publish-release.yml` revalidates the draft, snapshot branch,
version, and `main` ancestry. It then performs a clean install, reruns the
release tests and both production builds, reconstructs the archives
deterministically, and compares them byte for byte with the reviewed downloads
and their GitHub digests.

Only after those checks pass does the workflow atomically create `vX.Y.Z` at
the already-reviewed snapshot SHA, verify the tag, recheck the draft and asset
digests, and publish the draft. It marks the release as Latest unless a newer
stable release is already published.

The publish job uses the `release` environment. Configure a required reviewer
for that environment when the repository should require an approval click in
addition to the explicit publish command.

## Release assets

Every release published by this workflow has exactly two assets (`v0.2.0`
predates this flow and retains its two legacy `.tar.gz` files):

- `better-list-spfx-standalone-X.Y.Z.zip` — an upload-ready `.sppkg` with its
  client-side assets embedded, plus `INSTALL.md` and
  `RELEASE-MANIFEST.json`.
- `better-list-spfx-cdn-kit-X.Y.Z.zip` — flat CDN runtime files, a deliberately
  non-deployable `.sppkg` template, `materialize-cdn-package.mjs`,
  `INSTALL.md`, and `RELEASE-MANIFEST.json`.

`RELEASE-MANIFEST.json` records the release version, four-part SPFx version,
SharePoint product ID, tag, full commit SHA, Node version, artifact type, and
the size and SHA-256 hash of every payload file. The CDN kit also records its
exact flat `cdnFiles` list and reserved template URL.

Validation proves that the standalone package embeds every runtime file, the
CDN template embeds none, and a test package can be materialized with a valid
HTTPS URL. Both ZIPs are normalized using the snapshot commit time so the
publish workflow can reproduce the exact reviewed bytes.

## Install the standalone package

Use the standalone archive when Better List should be deployed entirely through
the SharePoint App Catalog.

1. Extract the ZIP and retain `RELEASE-MANIFEST.json` as its provenance and
   checksum record.
2. Upload the included `.sppkg` to the SharePoint tenant App Catalog.
3. Deploy the app, approve any tenant prompts, and add Better List to a modern
   page.

The package is built with `includeClientSideAssets: true`; SharePoint hosts its
embedded JavaScript, CSS, font, and Monaco runtime files. No external CDN URL is
required.

## Install from the CDN deployment kit

The CDN kit is portable across tenants and CDN providers because it does not
contain a customer URL. Its template `.sppkg` uses the reserved
`https://cdn.invalid/better-list-spfx/` sentinel and must not be uploaded.

1. Extract the ZIP on a machine with Node.js 22, `zip`, and `unzip`.
2. Choose the final version-specific HTTPS CDN base URL.
3. Run:

   ```bash
   node materialize-cdn-package.mjs \
     --template better-list-spfx-X.Y.Z-cdn-template.sppkg \
     --cdn-base-path https://cdn.contoso.example/spfx/better-list/X.Y.Z/
   ```

4. Upload the flat file names listed under `cdnFiles` in
   `RELEASE-MANIFEST.json`, without renaming, and serve them from that exact
   base URL.
5. Verify the generated `.sppkg` against its generated `.sha256` file, upload
   it to the tenant App Catalog, and deploy Better List.

Retain CDN files for every package version still installed by a tenant. Use a
distinct flat CDN base path per version. The materializer rejects non-HTTPS
URLs, credentials, query strings, fragments, unsafe package entries, embedded
client assets, ZIPs outside conservative size and compression limits, and
templates whose sentinel, release-manifest checksum, product ID, or version is
missing or inconsistent. It never overwrites an existing package or checksum.

### Monaco editor runtime

Monaco is bundled into the SPFx production output and its companion root-level
assets are included in the CDN kit. It does not load
`monaco-editor/min/vs` from a separate public CDN. The production ship check
requires the Monaco chunk before artifacts are packaged.

## Recovery and invariants

- If **Version main** fails because the previous `main` tip is unavailable,
  rerun it from the current `main` workflow definition:

  ```bash
  gh workflow run version-main.yml --ref main
  ```

  The manual run compares the current `main` tip with its first parent, and the
  existing trailer and concurrency guards keep the recovery idempotent.
- Rerun **Cut release candidate** for the same dispatch snapshot to recover a
  failed draft upload. A snapshot branch that points elsewhere is never moved.
- Published versions are immutable. Neither workflow overwrites an existing
  tag or published release.
- Rerun **Publish reviewed release** only while the release is a draft. A
  failure before the final step leaves the draft unpublished. If publication
  fails after the workflow pins the correct tag, rerun the publish workflow; it
  accepts that tag only when it still resolves to the reviewed snapshot.
- If the final post-publish verification fails, inspect the release and tag
  before taking any corrective action; do not move or recreate the tag.
- Never manually retarget a snapshot branch or release tag.

## Repository prerequisites

1. Grant Actions read/write repository access. The workflows request only
   `contents: write`; no personal access token is required.
2. Ensure the `github-actions[bot]` identity can push the version-only commit to
   `main`. If branch rules are added later, preserve that narrow allowance.
3. Keep pull-request CI required before merge.
4. Create a `release` environment and add required reviewers when publication
   needs an approval gate.
5. Protect `v*` tags from movement or deletion after creation.

No production CDN URL or credential is stored in the repository. The
standalone archive is self-contained, and the CDN kit is bound to a deployment
URL only after download.
