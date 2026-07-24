# better-list-spfx CDN Handoff

Upload the contents of `assets/` to:

`https://cdn.example.com/spfx/better-list-spfx/`

The SharePoint package in `sharepoint/solution` references this CDN path through `config/write-manifests.json`.
CDN upload is intentionally manual for v1.

Tagged GitHub Releases package these generated files, the matching `.sppkg`, a
checksum manifest, and installation instructions in the
`better-list-spfx-cdn-X.Y.Z.zip` asset. Configure the real `cdnBasePath` before
the first release; publication intentionally rejects the example.com
placeholder.
