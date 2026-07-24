import * as React from 'react';
import {
  createDOMRenderer,
  IdPrefixProvider,
  RendererProvider
} from '@fluentui/react-components';
import type {
  GriffelRenderer,
  PortalProps,
  PositioningProps
} from '@fluentui/react-components';

const renderers: WeakMap<Document, GriffelRenderer> = new WeakMap<Document, GriffelRenderer>();

const FluentIdPrefixProvider = IdPrefixProvider as unknown as React.ComponentType<{
  value: string;
}>;
const FluentRendererProvider = RendererProvider as unknown as React.ComponentType<{
  renderer: GriffelRenderer;
  targetDocument: Document;
}>;

export interface IBetterListFluentRootProps {
  children?: React.ReactNode;
  renderer: GriffelRenderer;
  targetDocument: Document;
}

export const betterListFluentIdPrefix = 'better-list-';
export const betterListFluentSurfaceClassName = 'better-list-fluent-surface';
export const betterListFluentTooltipContentClassName = 'better-list-fluent-tooltip-content';
export const betterListPortalMountNodeProps: PortalProps['mountNode'] = {
  className: 'better-list-portal'
};

/**
 * Keeps both Fluent's renderer context and generated element IDs in Better
 * List's namespace. SharePoint hosts a separate Fluent root whose provider IDs
 * begin at `fui-FluentProvider1`; reusing that ID makes Fluent adopt and later
 * remove the host's theme stylesheet.
 */
export function BetterListFluentRoot(props: IBetterListFluentRootProps): React.ReactElement {
  return React.createElement(
    FluentIdPrefixProvider,
    { value: betterListFluentIdPrefix },
    React.createElement(
      FluentRendererProvider,
      { renderer: props.renderer, targetDocument: props.targetDocument },
      props.children
    )
  );
}

const runtimeStyleAttribute = 'data-better-list-runtime-styles';

const criticalRuntimeStyles = `
.${betterListFluentSurfaceClassName} {
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid transparent;
  color: #242424;
  font-family: "Segoe UI", system-ui, sans-serif;
  z-index: 1000000;
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

export type BetterListPortalPlacement = 'root-menu' | 'submenu';

/**
 * Resolves the document-owned portal root used by Better List authoring surfaces.
 * SharePoint can render a property pane in a document other than the global one,
 * so callers must never implicitly mount menus into `window.document.body`.
 */
export function getBetterListPortalMountNode(
  targetDocument: Document | undefined
): HTMLElement | undefined {
  return targetDocument?.body;
}

/**
 * Keeps authoring menus inside the owning document's viewport. Fluent handles
 * flipping and shifting from these preferred positions; the explicit boundary
 * prevents a long relationship menu from being measured against another frame.
 */
export function createBetterListPortalPositioning(
  targetDocument: Document | undefined,
  placement: BetterListPortalPlacement = 'root-menu'
): PositioningProps {
  const boundary = targetDocument?.documentElement;
  if (placement === 'submenu') {
    return {
      align: 'top',
      autoSize: 'height',
      fallbackPositions: ['before-top', 'after-bottom', 'before-bottom'],
      overflowBoundary: boundary,
      overflowBoundaryPadding: 8,
      position: 'after',
      strategy: 'fixed'
    };
  }
  return {
    align: 'start',
    autoSize: 'height',
    fallbackPositions: ['above-start', 'below-end', 'above-end'],
    overflowBoundary: boundary,
    overflowBoundaryPadding: 8,
    position: 'below',
    strategy: 'fixed'
  };
}

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
