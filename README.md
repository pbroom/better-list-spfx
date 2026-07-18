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

## HTML Templates

The Advanced property pane includes a valid-only HTML editor. A template is a
maximum 32 KB HTML source containing exactly four
`<template data-bl-fragment>` elements:

- `shell` with one `tabs`, `search`, and `content` slot
- `group` with one `heading` and `body` slot
- `list` with one `items` slot
- `item` with one `title` and `properties` slot

Declare slots with `data-bl-slot`, for example
`<span data-bl-slot="title"></span>`. The runtime still owns links, tabs,
search, repetition, collapse controls, list states, configured properties, and
ARIA relationships.

Escaped display tokens are limited by context: shell supports `{{list.title}}`,
`{{tab.label}}`, and `{{results.count}}`; group supports `{{group.title}}` and
`{{group.count}}`; item supports `{{item.id}}`, `{{item.title}}`, and
`{{item.description}}`. Tokens may appear in text, `title`, safe `aria-*`, or
non-reserved `data-*` attributes.

Only structural HTML is accepted. Scripts, styles, forms, interactive or media
elements, SVG/MathML, inline styles, event handlers, IDs, URL attributes,
`tabindex`, and runtime-reserved attributes are rejected. Invalid drafts are
not saved, and invalid persisted values fall back to the built-in template.
