# better-list-spfx SPFx Project Rules

- Use Node >=22.14.0 <23.0.0, npm 10, SPFx 1.23.2, React 17, TypeScript 5.8, and Heft.
- Keep production-consumed code under src/.
- CDN production packages use includeClientSideAssets=false and https://cdn.example.com/spfx/better-list-spfx/.
- Provision SharePoint lists manually; do not add hidden PnP provisioning.
- Keep Better List Fluent UI styles on a dedicated RendererProvider with its stable classNameHashSalt; never share the host page's Griffel class-name namespace.
- Contain every persisted author stylesheet with the instance-rooted runtime @scope boundary. Editor validation alone is not sufficient protection against host-page CSS contamination.
- Resolve typed same-origin SharePoint list URLs to list metadata and persist the stable list GUID and title. Reject cross-origin or unmatched URLs without replacing the current selection.
