# better-list-spfx CDN Handoff

Tagged GitHub Releases publish a URL-agnostic
`better-list-spfx-cdn-kit-X.Y.Z.zip`. Its `.sppkg` template is intentionally
non-deployable until the final CDN URL is supplied.

After extracting the kit, run:

```bash
node materialize-cdn-package.mjs \
  --template better-list-spfx-X.Y.Z-cdn-template.sppkg \
  --cdn-base-path https://cdn.contoso.example/spfx/better-list/X.Y.Z/
```

Upload the flat runtime files listed under `cdnFiles` in
`RELEASE-MANIFEST.json` without renaming them, serve them from that exact URL,
and upload the generated `.sppkg` to the App Catalog. Verify the package against
the generated `.sha256` file first. The materializer authenticates the template
and kit payload against `RELEASE-MANIFEST.json` before rewriting it; GitHub's
release-asset digest authenticates the downloaded kit ZIP. CDN upload remains
intentionally manual.
