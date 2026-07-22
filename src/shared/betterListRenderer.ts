import { createDOMRenderer, GriffelRenderer } from '@griffel/react';

const renderers: WeakMap<Document, GriffelRenderer> = new WeakMap<Document, GriffelRenderer>();

/**
 * Creates the Better List Fluent renderer with an application-specific class hash.
 * SharePoint hosts its own Fluent v9 renderer in the same document, so using the
 * default hash can make unrelated host controls share Better List's atomic rules.
 */
export function getBetterListRenderer(targetDocument: Document): GriffelRenderer {
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
