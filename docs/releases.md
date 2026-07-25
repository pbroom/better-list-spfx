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
the real two-mode production build. Nothing is uploaded if build, provenance,
package-mode, archive, materialization, or checksum validation fails.

## Release assets

Every successful GitHub Release has exactly two assets:

- `better-list-spfx-standalone-X.Y.Z.zip` — an upload-ready `.sppkg` with its
  client-side assets embedded, plus `INSTALL.md` and `RELEASE-MANIFEST.json`.
- `better-list-spfx-cdn-kit-X.Y.Z.zip` — flat CDN runtime files, a deliberately
  non-deployable `.sppkg` template, `materialize-cdn-package.mjs`, `INSTALL.md`,
  and `RELEASE-MANIFEST.json`.

`RELEASE-MANIFEST.json` records the release version, four-part SPFx version,
SharePoint product ID, tag, full commit SHA, Node version, artifact type, and
the size and SHA-256 hash of every payload file. The CDN kit manifest also records its exact flat
`cdnFiles` list and reserved template URL. The workflow verifies both ZIP
archives, proves the standalone package embeds every runtime file, proves the
CDN template embeds none, and materializes a test package with a real-looking
HTTPS URL before upload. After upload, it also requires GitHub's SHA-256 digest
for each of the two release assets to match the locally validated archive.

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

Monaco is bundled by the SPFx production build into the `chunk.source-editor-monaco_*.js`
runtime chunk and its companion root-level assets (such as `codicon_*.ttf`). It does not
load `monaco-editor/min/vs` from a separate public CDN. Those hashed, flat files are included
in `cdnFiles`; upload them with the rest of the payload. The production ship check verifies
the Monaco chunk is present in `release/assets` before artifacts are packaged.

## Manual recovery

If the tag publication workflow fails after Release Please has already created
the tag and GitHub Release, run **Publish release artifacts** manually from the
`main` workflow definition and enter the existing `vX.Y.Z` tag. Dispatches
selected from another branch fail before checkout or publication.

The recovery path does not accept branches, arbitrary SHAs, or untagged refs.
It verifies that the tag exists, the matching GitHub Release exists, the tag
version matches the checked-in version files, and the tag commit is an ancestor
of current `origin/main`. It then performs the same clean install, production
build, validation, and upload. Existing assets are replaced only after the
entire rebuilt set passes validation.

Do not manually create or move a release tag to recover a failed build.

## Repository prerequisites

Before enabling the first release:

1. Add a repository Actions secret named `RELEASE_PLEASE_TOKEN`. Use a
   fine-grained personal access token or GitHub App token that can write
   repository contents and pull requests (and issues, if release labels need
   it). The token must be allowed to push Release Please branches and create
   `v*` tags.
2. In **Settings → Actions → General**, allow Actions to create pull requests
   and grant workflows read/write access, or grant equivalent rights through
   the configured token.
3. Ensure branch rules allow the release bot to update its pull request while
   keeping normal `main` review and CI requirements. If `v*` tags are
   protected, explicitly allow the release identity to create them and prevent
   later movement or deletion.

The repository keeps the SPFx `<!-- PATH TO CDN -->` build placeholder for its
self-contained package and uses a reserved `.invalid` sentinel only inside the
CDN template build. No production CDN URL or CDN credential is a repository
prerequisite. The publication workflow uses the scoped `GITHUB_TOKEN` only to
read the matching release and upload validated assets; it publishes neither an
npm package nor a live CDN deployment.
