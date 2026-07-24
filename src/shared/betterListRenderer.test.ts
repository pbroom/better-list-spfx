import * as React from 'react';
import * as ReactDom from 'react-dom';
import {
  Button,
  FluentProvider,
  resetIdsForTests,
  webLightTheme
} from '@fluentui/react-components';

import {
  BetterListFluentRoot,
  betterListFluentIdPrefix,
  betterListFluentSurfaceClassName,
  betterListFluentTooltipContentClassName,
  betterListPortalMountNodeProps,
  createBetterListPortalPositioning,
  ensureBetterListRuntimeStyles,
  getBetterListPortalMountNode,
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
    expect(first.textContent).toContain('z-index: 1000000');
    expect(first.textContent).toContain('border: 1px solid transparent');
    expect(first.textContent).not.toContain('border: 1px solid #d1d1d1');
    expect(first.textContent).not.toContain('.fui-Button');
  });

  it('lets Fluent create a themed portal wrapper inside the supplied portal root', () => {
    expect(betterListPortalMountNodeProps).toEqual({ className: 'better-list-portal' });
    expect(betterListPortalMountNodeProps).not.toHaveProperty('element');
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

  it('preserves an existing host Fluent provider stylesheet while inserting isolated theme rules', () => {
    resetIdsForTests();
    const targetDocument = document;
    const hostStyle = targetDocument.createElement('style');
    hostStyle.id = 'fui-FluentProvider1';
    hostStyle.textContent = '.sharepoint-publish { color: white; }';
    targetDocument.head.appendChild(hostStyle);
    const originalHostRuleCount = hostStyle.sheet?.cssRules.length;
    const originalHostRule = hostStyle.sheet?.cssRules[0]?.cssText;
    const observer = new MutationObserver(() => undefined);
    observer.observe(targetDocument.head, { childList: true });
    const mountNode = targetDocument.createElement('div');
    targetDocument.body.appendChild(mountNode);

    const renderer = getBetterListRenderer(targetDocument);
    const renderWithTheme = (theme: typeof webLightTheme): void => {
      ReactDom.render(
        React.createElement(
          BetterListFluentRoot,
          { renderer, targetDocument },
          React.createElement(
            FluentProvider,
            { targetDocument, theme },
            React.createElement(Button, undefined, 'Better List')
          )
        ),
        mountNode
      );
    };
    const isolatedThemeSelector =
      `style[data-better-list-griffel][id^="${betterListFluentIdPrefix}fui-FluentProvider"]`;

    renderWithTheme(webLightTheme);
    const isolatedThemeStyles = targetDocument.head.querySelectorAll<HTMLStyleElement>(
      isolatedThemeSelector
    );

    expect(isolatedThemeStyles).toHaveLength(1);
    expect(isolatedThemeStyles[0]).not.toBe(hostStyle);
    expect(isolatedThemeStyles[0].id).toContain(`${betterListFluentIdPrefix}fui-FluentProvider`);
    expect(isolatedThemeStyles[0].sheet?.cssRules.length).toBeGreaterThan(0);
    expect(
      targetDocument.head.querySelectorAll(
        'style[data-make-styles-bucket]:not([data-better-list-griffel])'
      )
    ).toHaveLength(0);

    renderWithTheme({
      ...webLightTheme,
      colorNeutralForeground1: '#123456'
    });

    expect(targetDocument.getElementById('fui-FluentProvider1')).toBe(hostStyle);
    expect(hostStyle.sheet?.cssRules.length).toBe(originalHostRuleCount);
    expect(hostStyle.sheet?.cssRules[0]?.cssText).toBe(originalHostRule);
    expect(targetDocument.head.querySelectorAll(isolatedThemeSelector)).toHaveLength(1);

    ReactDom.unmountComponentAtNode(mountNode);
    const headMutations = observer.takeRecords();
    const removedNodes = headMutations.reduce<Node[]>(
      (nodes, record) => nodes.concat(Array.from(record.removedNodes)),
      []
    );

    expect(targetDocument.getElementById('fui-FluentProvider1')).toBe(hostStyle);
    expect(hostStyle.textContent).toBe('.sharepoint-publish { color: white; }');
    expect(hostStyle.sheet?.cssRules.length).toBe(originalHostRuleCount);
    expect(hostStyle.sheet?.cssRules[0]?.cssText).toBe(originalHostRule);
    expect(removedNodes).not.toContain(hostStyle);
    expect(targetDocument.head.querySelectorAll('style[id="fui-FluentProvider1"]')).toHaveLength(1);
    observer.disconnect();
    hostStyle.remove();
    mountNode.remove();
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

  it('owns portals and viewport boundaries in the supplied document', () => {
    const root = createBetterListPortalPositioning(document);
    const submenu = createBetterListPortalPositioning(document, 'submenu');

    expect(getBetterListPortalMountNode(document)).toBe(document.body);
    expect(root).toEqual(expect.objectContaining({
      align: 'start',
      autoSize: 'height',
      overflowBoundary: document.documentElement,
      overflowBoundaryPadding: 8,
      position: 'below',
      strategy: 'fixed'
    }));
    expect(root.fallbackPositions).toContain('above-start');
    expect(submenu).toEqual(expect.objectContaining({
      align: 'top',
      overflowBoundary: document.documentElement,
      position: 'after',
      strategy: 'fixed'
    }));
    expect(submenu.fallbackPositions).toContain('before-top');
  });
});
