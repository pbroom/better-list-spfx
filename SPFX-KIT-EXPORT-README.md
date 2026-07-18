# better-list-spfx Repo Export

This folder is a portable SPFx source repo. It is not the upload artifact itself.

Build deployment artifacts:

1. Run `npm ci`.
2. Run `npm run ship`.
3. Upload generated .sppkg files from `sharepoint/solution/` to the SharePoint tenant app catalog under Apps for SharePoint.
4. If the package uses CDN assets, upload generated files from `release/assets/` to the CDN base path in `config/write-manifests.json`.
5. Deploy or trust the SharePoint package, then add or update the app on the target SharePoint site.
