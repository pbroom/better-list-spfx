# Better List design QA

## Evidence

- Property-pane reference: `/var/folders/9b/7w9djy9j5dlfjn79khk4l92h0000gn/T/codex-clipboard-dfaf48dc-7522-4894-a8d9-9b13373f5e63.png`.
- Implemented item shape: `qa/property-pane-final.png`, captured at 1247 x 998 in the running SPFx lab.
- Implemented lookup disclosure: `qa/property-pane-nested-menu.png`, captured with Category and its default lookup column open.
- Side-by-side comparison: `qa/property-pane-comparison.png`.
- Existing responsive evidence remains in `qa/desktop-featured.png`, `qa/desktop-comparison.png`, `qa/mobile-viewport.png`, and `qa/mobile-comparison.png`.

## Property-pane findings

1. The information architecture matches the reference: list source, General, Tabs, Groups, Item properties, and Advanced appear in the intended order.
2. The initial item shape contains one required Title field. The add action lists only unused columns from the selected list.
3. Column types use Fluent icons for text, multiline text, hyperlink, number, yes/no, person, and lookup values.
4. Lookup columns use a second disclosure level. Selecting `Category -> Title` adds the nested value to the item shape and immediately updates the preview.
5. Optional fields can be added and removed without affecting the required Title field. Adding Description updates every visible item immediately.
6. The menu surface, dividers, spacing, typography, and restrained Fluent styling track the supplied examples while fitting the lab's fixed-width options panel.
7. Advanced remains progressively disclosed and continues to host the live CSS/SCSS editor. The reference's HTML mode is intentionally omitted because this web part currently exposes styling, not arbitrary markup authoring.
8. The lab shows `Services` instead of the empty source placeholder because the fixture list is already selected.
9. Section labels now own disclosure. The Tabs and Groups plus buttons open column pickers without expanding their sections, while Item properties retains its add-column action and General uses a disclosure chevron.
10. Selecting `Category -> Title` for Tabs generates category-value tabs; selecting Organization for Groups immediately regroups the active tab.
11. Lookup menu rows now show one trailing chevron. The duplicate Category chevron was removed.

## Runtime findings

1. Title-only, nested lookup, add, and remove interactions were exercised through the in-app browser at `http://127.0.0.1:5173/`.
2. The deployable SPFx package and the lab use the same item-property parser, formatter, field descriptors, and builder component.
3. The production build completed with 23 passing tests and no lint warnings.
4. The root lab build completed successfully. Its existing bundle-size advisory is unrelated to Better List.
5. The column-driven tabs were checked at the one-column and Mobile lab breakpoints. Tabs scroll within their own rail, the search control wraps below them, and Mobile groups render in one column.

## Final result

passed
