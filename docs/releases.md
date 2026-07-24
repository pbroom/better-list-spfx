# Releasing Better List

Better List uses Release Please to turn Conventional Commits on `main` into a
reviewable release pull request. Product changes merge frequently without
changing versions. Stable artifacts are built only after the release pull
request is reviewed and merged.

## Commit and version workflow

Use a Conventional Commit title when merging a pull request:

- `fix: ...` produces a patch candidate.
- `feat: ...` produces a minor candidate.
- `feat!: ...`, `fix!: ...`, or a `BREAKING CHANGE:` footer produces a major
  candidate.
- `docs:`, `test:`, `chore:`, and similar maintenance commits do not normally
  produce a release by themselves.

Do not manually bump `package.json`, `package-lock.json`, or
`config/package-solution.json` in feature pull requests.

On every push to `main`, `.github/workflows/release-please.yml` creates or
updates one release pull request. Release Please owns the SemVer version,
lockfile, and changelog. The same workflow synchronizes that version to the
four-part SPFx solution and feature versions (`x.y.z.0`) and commits the result
to the release branch. CI rejects any version mismatch.

Merging the release pull request causes Release Please to create the immutable
`vX.Y.Z` tag and matching GitHub Release. The tag starts
`.github/workflows/release.yml`, which checks out the tag, proves that its
commit is reachable from `main`, installs with the repository lockfile, and runs
the real `npm run ship` production build. Nothing is uploaded if build,
provenance, package, archive, or checksum validation fails.

## Release assets

Every successful GitHub Release has three assets:

- `better-list-spfx-X.Y.Z.sppkg` — the SharePoint package produced by the tag
  build.
- `better-list-spfx-cdn-X.Y.Z.zip` — the same `.sppkg` plus the exact generated
  `assets/` and `manifests/` trees, `INSTALL.md`, and
  `RELEASE-MANIFEST.json`.
- `SHA256SUMS` — SHA-256 hashes for the standalone package and CDN ZIP.

`RELEASE-MANIFEST.json` records the release version, four-part SPFx version,
tag, full commit SHA, Node version, configured CDN base path, and the size and
SHA-256 hash of every payload file. The workflow tests both ZIP archives and
recomputes all checksums before upload. The package inside the CDN ZIP must be
byte-identical to the standalone asset.

## Install the standalone package

Use the standalone `.sppkg` when the files from the matching version are
already hosted at the `cdnBasePath` in `config/write-manifests.json`.

1. Verify the `.sppkg` against `SHA256SUMS`.
2. Upload it to the SharePoint tenant App Catalog.
3. Deploy the app, approve any tenant prompts, and add Better List to a modern
   page.

This project uses `includeClientSideAssets: false`, so the `.sppkg` still
expects its matching CDN files to exist. It is a standalone download, not a
self-contained package.

## Install from the CDN bundle

Use the CDN ZIP to deploy a version from scratch.

1. Verify the ZIP against `SHA256SUMS`, then extract it.
2. Upload every file under `assets/` and `manifests/` without renaming or
   flattening paths. Serve them from the base URL recorded in
   `RELEASE-MANIFEST.json`.
3. Upload the package under `sharepoint/` to the tenant App Catalog.
4. Deploy the app, approve any tenant prompts, and add Better List to a modern
   page.

Retain CDN files for every package version still installed by a tenant.

## Manual recovery

If the tag publication workflow fails after Release Please has already created
the tag and GitHub Release, run **Publish release artifacts** manually and enter
the existing `vX.Y.Z` tag.

The recovery path does not accept branches, arbitrary SHAs, or untagged refs.
It verifies that the tag exists, the matching GitHub Release exists, the tag
version matches the checked-in version files, and the tag commit is an ancestor
of current `origin/main`. It then performs the same clean install, production
build, validation, and upload. Existing assets are replaced only after the
entire rebuilt set passes validation.

Do not manually create or move a release tag to recover a failed build.

## Repository prerequisites

Before enabling the first release:

1. Replace the placeholder `https://cdn.example.com/...` value in
   `config/write-manifests.json` with the production HTTPS CDN base path. The
   publication script rejects the placeholder.
2. Add a repository Actions secret named `RELEASE_PLEASE_TOKEN`. Use a
   fine-grained personal access token or GitHub App token that can write
   repository contents and pull requests (and issues, if release labels need
   it). The token must be allowed to push Release Please branches and create
   `v*` tags.
3. In **Settings → Actions → General**, allow Actions to create pull requests
   and grant workflows read/write access, or grant equivalent rights through
   the configured token.
4. Ensure branch rules allow the release bot to update its pull request while
   keeping normal `main` review and CI requirements. If `v*` tags are
   protected, explicitly allow the release identity to create them and prevent
   later movement or deletion.

The publication workflow uses the scoped `GITHUB_TOKEN` only to read the
matching release and upload validated assets. No npm registry or CDN write
credential is required because this repository publishes downloadable files,
not an npm package or a live CDN deployment.
