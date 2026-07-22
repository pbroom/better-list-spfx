import { createDOMRenderer, GriffelRenderer } from '@griffel/react';

const renderers: WeakMap<Document, GriffelRenderer> = new WeakMap<Document, GriffelRenderer>();

export const betterListFluentSurfaceClassName = 'better-list-fluent-surface';
export const betterListFluentTooltipContentClassName = 'better-list-fluent-tooltip-content';

const runtimeStyleAttribute = 'data-better-list-runtime-styles';

const criticalRuntimeStyles = `
.${betterListFluentSurfaceClassName} {
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #d1d1d1;
  color: #242424;
  font-family: "Segoe UI", system-ui, sans-serif;
}
.${betterListFluentSurfaceClassName} *,
.${betterListFluentSurfaceClassName} *::before,
.${betterListFluentSurfaceClassName} *::after {
  box-sizing: border-box;
}
.${betterListFluentTooltipContentClassName} {
  display: block;
  margin: -6px -8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #242424;
  color: #ffffff;
  font: 12px/1.3 "Segoe UI", system-ui, sans-serif;
}
`;

/**
 * Installs small, namespaced first-paint defaults for Better List portal surfaces.
 * Fluent's atomic rules still own the final appearance. These rules only prevent
 * transparent/Times New Roman surfaces while a lazy Fluent chunk initializes.
 */
export function ensureBetterListRuntimeStyles(targetDocument: Document): HTMLStyleElement {
  const existing = targetDocument.head.querySelector<HTMLStyleElement>(`style[${runtimeStyleAttribute}]`);
  if (existing) {
    return existing;
  }

  const style = targetDocument.createElement('style');
  style.setAttribute(runtimeStyleAttribute, '');
  style.textContent = criticalRuntimeStyles;
  targetDocument.head.appendChild(style);
  return style;
}

/**
 * Creates the Better List Fluent renderer with an application-specific class hash.
 * SharePoint hosts its own Fluent v9 renderer in the same document, so using the
 * default hash can make unrelated host controls share Better List's atomic rules.
 */
export function getBetterListRenderer(targetDocument: Document): GriffelRenderer {
  ensureBetterListRuntimeStyles(targetDocument);
  const existing: GriffelRenderer | undefined = renderers.get(targetDocument);
  if (existing) {
    return existing;
  }
  const renderer: GriffelRenderer = createDOMRenderer(targetDocument, {
    classNameHashSalt: 'better-list-spfx',
    styleElementAttributes: { 'data-better-list-griffel': '' }
  });
  renderers.set(targetDocument, renderer);
  return renderer;
}
