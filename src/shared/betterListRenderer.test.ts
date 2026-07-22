import {
  betterListFluentSurfaceClassName,
  betterListFluentTooltipContentClassName,
  ensureBetterListRuntimeStyles,
  getBetterListRenderer
} from './betterListRenderer';

describe('Better List Griffel renderer', () => {
  it('uses a stable application salt and caches one renderer per document', () => {
    const first = getBetterListRenderer(document);
    const second = getBetterListRenderer(document);

    expect(first).toBe(second);
    expect(first.classNameHashSalt).toBe('better-list-spfx');
    expect(first.styleElementAttributes).toEqual({ 'data-better-list-griffel': '' });
  });

  it('installs namespaced first-paint portal styles once per document', () => {
    const first = ensureBetterListRuntimeStyles(document);
    const second = ensureBetterListRuntimeStyles(document);

    expect(first).toBe(second);
    expect(document.head.querySelectorAll('style[data-better-list-runtime-styles]')).toHaveLength(1);
    expect(first.textContent).toContain(`.${betterListFluentSurfaceClassName}`);
    expect(first.textContent).toContain(`.${betterListFluentTooltipContentClassName}`);
    expect(first.textContent).not.toContain('.fui-Button');
  });

  it('initializes independently for the first instance in every document', () => {
    const firstDocument = document.implementation.createHTMLDocument('first Better List host');
    const secondDocument = document.implementation.createHTMLDocument('second Better List host');

    const firstRenderer = getBetterListRenderer(firstDocument);
    const secondRenderer = getBetterListRenderer(secondDocument);

    expect(firstRenderer).not.toBe(secondRenderer);
    expect(firstDocument.head.querySelectorAll('style[data-better-list-runtime-styles]')).toHaveLength(1);
    expect(secondDocument.head.querySelectorAll('style[data-better-list-runtime-styles]')).toHaveLength(1);
    expect(firstRenderer.styleElementAttributes).toEqual({ 'data-better-list-griffel': '' });
    expect(secondRenderer.styleElementAttributes).toEqual({ 'data-better-list-griffel': '' });
  });

  it('restores critical portal styles when an instance is removed and later re-added', () => {
    const targetDocument = document.implementation.createHTMLDocument('recreated Better List host');
    const initialRenderer = getBetterListRenderer(targetDocument);
    const initialStyles = targetDocument.head.querySelector<HTMLStyleElement>('style[data-better-list-runtime-styles]');

    expect(initialStyles).not.toBeNull();
    initialStyles?.remove();
    expect(targetDocument.head.querySelector('style[data-better-list-runtime-styles]')).toBeNull();

    const reusedRenderer = getBetterListRenderer(targetDocument);

    expect(reusedRenderer).toBe(initialRenderer);
    expect(targetDocument.head.querySelectorAll('style[data-better-list-runtime-styles]')).toHaveLength(1);
  });
});
