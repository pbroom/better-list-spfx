# Better List

SPFx 1.23.2 Heft web part project managed by SPFx Kit.

## Install And Build

Run `npm install` once to create the app-local lockfile. Commit that lockfile
in the deployment repository and use `npm ci` for repeatable installs.

Use `npm run build` for a production build and `npm run ship` to produce the
configured package under `sharepoint/solution/`.

## Debug On SharePoint

Set `SPFX_SERVE_TENANT_DOMAIN` to a development tenant and site path, such as
`contoso.sharepoint.com/sites/team-a`, then run `npm run serve`. The generated
`config/serve.json` opens a modern page with the local manifest parameters.
Accept the prompt to load debug scripts and use the SPFx Debug Toolbar. Replace
the page path when the site's editable development page is not
`/SitePages/Home.aspx`.
