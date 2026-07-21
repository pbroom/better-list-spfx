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

## Source Lists

The Source list combobox accepts either a list discovered by the current
SharePoint context or a pasted same-origin SharePoint list URL. URLs are
resolved to SharePoint list metadata before the list GUID and title are saved;
invalid, unmatched, or cross-origin URLs do not replace the current selection.

## CSS Isolation

Better List previously contaminated host-page styles because its Griffel rules
shared the host's class-name namespace and author CSS was injected into the
document without a containment boundary. The runtime prevents both paths: a
dedicated `RendererProvider` uses a Better List `classNameHashSalt`, and saved
author CSS is contained by an instance-rooted `@scope` rule.

Both protections are required. The renderer salt isolates generated Fluent UI
classes, while `@scope` keeps arbitrary persisted selectors inside this web
part. Changes to rendering or CSS authoring must retain regression coverage for
class-name collisions and selectors outside the Better List instance.

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
