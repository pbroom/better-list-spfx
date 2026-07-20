export const betterListStylePresetVersion = 1;

/**
 * The default Better List visual design lives in the author-editable SCSS field.
 * This is intentionally flat CSS, which is valid SCSS and can be injected without
 * shipping a Sass compiler to SharePoint.
 */
export const defaultBetterListScss = `/*
Better List CSS/SCSS targets
This starter stylesheet is flat CSS (and therefore valid SCSS).
Edit these rules in the web part's Monaco field to restyle this instance.
*/

.better-list {
  --better-list-heading: var(--better-list-host-heading, #071f44);
  --better-list-accent: var(--better-list-host-accent, #315d9c);
  --better-list-surface: var(--better-list-host-surface, var(--colorNeutralBackground1, #ffffff));
  --better-list-text: var(--better-list-host-text, var(--colorNeutralForeground1, #242424));
  --better-list-muted: var(--better-list-host-muted, var(--colorNeutralForeground3, #616161));
  --better-list-border: var(--better-list-host-border, var(--colorNeutralStroke2, #e0e0e0));
  --better-list-link: var(--better-list-host-link, var(--colorBrandForegroundLink, #245a8d));
  --better-list-focus: var(--better-list-host-focus, var(--colorStrokeFocus2, #000000));
  box-sizing: border-box;
  color: var(--better-list-heading);
  background: var(--better-list-surface);
  font-family: "Segoe UI", sans-serif;
  padding: 28px 30px 38px;
}

.better-list__toolbar {
  column-gap: 40px;
  row-gap: 20px;
  flex-wrap: wrap;
}

.better-list__tabs {
  max-width: 100%;
  overflow-x: auto;
}

.better-list__tab {
  color: var(--better-list-muted);
  font-size: 1rem;
  font-weight: 600;
  padding: 0 20px;
}

.better-list__search {
  border-color: var(--better-list-border);
  border-radius: 4px;
}

.better-list__search-icon {
  color: var(--better-list-heading);
  font-size: 22px;
}

.better-list__content {
  margin-top: 34px;
}

.better-list__grid {
  display: flex;
  flex-direction: column;
  row-gap: 36px;
}

.better-list__group {
  width: 100%;
  border-bottom: 1px solid var(--better-list-border);
}

.better-list__items {
  display: grid;
  grid-template-columns: repeat(var(--better-list-columns, 2), minmax(0, 1fr));
  column-gap: 72px;
}

.better-list__group-static-heading {
  color: var(--better-list-heading);
  column-gap: 16px;
  font-size: 1.25rem;
  font-weight: 600;
  padding: 10px 8px;
}

.better-list__group-button {
  color: var(--better-list-heading);
  font-size: 1.25rem;
  font-weight: 600;
  padding: 10px 8px;
  border-radius: 4px;
}

.better-list__group-button-content {
  column-gap: 16px;
}

.better-list__group-icon {
  color: var(--better-list-accent);
  font-size: 34px;
}

.better-list__chevron {
  font-size: 22px;
}

.better-list__item {
  color: var(--better-list-text);
  padding: 16px 0;
}

.better-list__item--compact {
  padding: 12px 0;
}

.better-list__item-title {
  color: var(--better-list-link);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.375rem;
  text-decoration: none;
}

.better-list__item-title--text {
  color: var(--better-list-heading);
}

.better-list__metadata {
  color: var(--better-list-muted);
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-top: 8px;
}

.better-list__metadata-part:not(:last-child)::after {
  color: var(--better-list-muted);
  content: "|";
  margin: 0 11px;
}

.better-list__item-description {
  color: var(--better-list-text);
  font-size: 0.875rem;
  line-height: 1.375rem;
  margin-top: 12px;
}

.better-list__state {
  color: var(--better-list-muted);
  padding: 36px;
}

.better-list__state-icon {
  color: var(--better-list-accent);
  font-size: 30px;
}

.better-list__group-button:focus-visible,
.better-list__item-title:focus-visible {
  outline: 2px solid var(--better-list-focus);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .better-list__items {
    column-gap: 38px;
  }
}

@media (max-width: 760px) {
  .better-list {
    padding: 22px 16px 30px;
  }

  .better-list__items {
    grid-template-columns: minmax(0, 1fr);
  }

  .better-list__item {
    padding: 16px 0;
  }
}`;

export function scopeBetterListStyles(source: string, scope: string): string {
  const normalizedScope = scope.trim();
  if (!normalizedScope || !source.trim()) {
    return source;
  }
  return source.replace(/\.better-list(?=$|__|[\s,{:#.\[])/g, `${normalizedScope} .better-list`);
}
