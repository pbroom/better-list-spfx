import { SourceEditorDiagnostic } from '../vendor/source-editor/sourceEditorCore';

export const betterListTemplateMaxBytes = 32 * 1024;

export type BetterListTemplateFragmentName = 'shell' | 'group' | 'list' | 'item';
export type BetterListTemplateSlotName = 'tabs' | 'search' | 'content' | 'heading' | 'body' | 'items' | 'title' | 'properties';

export interface IBetterListTemplateTextNode {
  type: 'text';
  value: string;
}

export interface IBetterListTemplateElementNode {
  type: 'element';
  tagName: string;
  attributes: Readonly<Record<string, string>>;
  children: readonly IBetterListTemplateNode[];
  slot?: BetterListTemplateSlotName;
}

export type IBetterListTemplateNode = IBetterListTemplateTextNode | IBetterListTemplateElementNode;

export interface IBetterListCompiledTemplate {
  source: string;
  fragments: Readonly<Record<BetterListTemplateFragmentName, IBetterListTemplateElementNode>>;
}

export interface IBetterListTemplateParseResult {
  diagnostics: readonly SourceEditorDiagnostic[];
  template?: IBetterListCompiledTemplate;
}

const fragmentNames: readonly BetterListTemplateFragmentName[] = ['shell', 'group', 'list', 'item'];

const slotsByFragment: Readonly<Record<BetterListTemplateFragmentName, readonly BetterListTemplateSlotName[]>> = {
  shell: ['tabs', 'search', 'content'],
  group: ['heading', 'body'],
  list: ['items'],
  item: ['title', 'properties']
};

const tokensByFragment: Readonly<Record<BetterListTemplateFragmentName, ReadonlySet<string>>> = {
  shell: new Set(['list.title', 'tab.label', 'results.count']),
  group: new Set(['group.title', 'group.count']),
  list: new Set(),
  item: new Set(['item.id', 'item.title', 'item.description'])
};

const allowedStructuralTags = new Set([
  'article',
  'aside',
  'dd',
  'div',
  'dl',
  'dt',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'span',
  'ul'
]);

const forbiddenAttributeNames = new Set([
  'action',
  'cite',
  'formaction',
  'href',
  'id',
  'poster',
  'src',
  'srcdoc',
  'style',
  'tabindex'
]);
const safeAriaAttributeNames = new Set(['aria-description', 'aria-label', 'aria-roledescription']);
const reservedDataAttributeNames = new Set([
  'data-active-tab',
  'data-breakpoint',
  'data-item-element',
  'data-item-element-kind',
  'data-selected-tab',
  'data-theme'
]);

const tokenPattern = /\{\{\s*([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+)\s*\}\}/gi;

export const defaultBetterListHtmlTemplate = `<template data-bl-fragment="shell">
  <section>
    <div class="better-list__header">
      <div class="better-list__toolbar">
        <span data-bl-slot="tabs"></span>
        <span data-bl-slot="search"></span>
      </div>
    </div>
    <div data-bl-slot="content"></div>
  </section>
</template>

<template data-bl-fragment="group">
  <section>
    <h2 data-bl-slot="heading"></h2>
    <div data-bl-slot="body"></div>
  </section>
</template>

<template data-bl-fragment="list">
  <ul>
    <li data-bl-slot="items"></li>
  </ul>
</template>

<template data-bl-fragment="item">
  <li>
    <span data-bl-slot="title"></span>
    <div data-bl-slot="properties"></div>
  </li>
</template>`;

export function validateBetterListTemplate(source: string): SourceEditorDiagnostic[] {
  return parseBetterListTemplate(source).diagnostics.slice();
}

export function validateBetterListTemplateStructure(source: string): SourceEditorDiagnostic[] {
  return parseBetterListTemplate(source, false).diagnostics.slice();
}

export function parseBetterListTemplate(source: string, enforceByteLimit = true): IBetterListTemplateParseResult {
  const diagnostics: SourceEditorDiagnostic[] = [];
  if (enforceByteLimit && measureUtf8Bytes(source) > betterListTemplateMaxBytes) {
    diagnostics.push(error('Source is larger than the 32 KB limit.'));
  }
  if (!source.trim()) {
    diagnostics.push(error('Template source is empty.'));
    return { diagnostics };
  }
  if (typeof DOMParser === 'undefined') {
    diagnostics.push(error('HTML templates cannot be parsed in this environment.'));
    return { diagnostics };
  }
  const malformedMessage = findMalformedMarkup(source);
  if (malformedMessage) {
    diagnostics.push(error(malformedMessage));
    return { diagnostics };
  }

  const documentValue = new DOMParser().parseFromString(`<!doctype html><html><body>${source}</body></html>`, 'text/html');
  const fragments = {} as Record<BetterListTemplateFragmentName, IBetterListTemplateElementNode>;
  const seenFragments = new Set<string>();

  for (const child of Array.from(documentValue.body.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && !(child.textContent || '').trim()) {
      continue;
    }
    if (child.nodeType === Node.COMMENT_NODE) {
      continue;
    }
    if (!(child instanceof HTMLTemplateElement)) {
      diagnostics.push(error('Only top-level <template data-bl-fragment="…"> elements are allowed.'));
      continue;
    }
    if (child.attributes.length !== 1 || !child.hasAttribute('data-bl-fragment')) {
      diagnostics.push(error('Fragment templates may only declare data-bl-fragment.'));
    }
    const fragmentName = child.getAttribute('data-bl-fragment') || '';
    if (!isFragmentName(fragmentName)) {
      diagnostics.push(error(`Unknown fragment "${fragmentName || '(empty)'}".`));
      continue;
    }
    if (seenFragments.has(fragmentName)) {
      diagnostics.push(error(`Fragment "${fragmentName}" must be declared exactly once.`));
      continue;
    }
    seenFragments.add(fragmentName);

    const roots = Array.from(child.content.childNodes).filter(
      (node) => node.nodeType !== Node.COMMENT_NODE && !(node.nodeType === Node.TEXT_NODE && !(node.textContent || '').trim())
    );
    if (roots.length !== 1 || !(roots[0] instanceof HTMLElement)) {
      diagnostics.push(error(`Fragment "${fragmentName}" must contain exactly one root element.`));
      continue;
    }
    const slotCounts = new Map<BetterListTemplateSlotName, number>();
    const root = compileElement(roots[0], fragmentName, slotCounts, diagnostics);
    if (root) {
      if (root.slot) {
        diagnostics.push(error(`Fragment "${fragmentName}" root cannot be a slot.`));
      }
      for (const slot of slotsByFragment[fragmentName]) {
        if ((slotCounts.get(slot) || 0) !== 1) {
          diagnostics.push(error(`Fragment "${fragmentName}" must contain exactly one "${slot}" slot.`));
        }
      }
      fragments[fragmentName] = root;
    }
  }

  for (const fragmentName of fragmentNames) {
    if (!seenFragments.has(fragmentName)) {
      diagnostics.push(error(`Missing required "${fragmentName}" fragment.`));
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return { diagnostics };
  }
  return { diagnostics, template: { source, fragments } };
}

export function resolveBetterListTemplate(source: string | undefined): IBetterListCompiledTemplate {
  const selected = parseBetterListTemplate(source || defaultBetterListHtmlTemplate);
  if (selected.template) {
    return selected.template;
  }
  const fallback = parseBetterListTemplate(defaultBetterListHtmlTemplate);
  if (!fallback.template) {
    return createEmergencyBetterListTemplate();
  }
  return fallback.template;
}

export function substituteBetterListTokens(value: string, tokens: Readonly<Record<string, string | number | undefined>>): string {
  return value.replace(tokenPattern, (_match, tokenName: string) => {
    const tokenValue = tokens[tokenName.toLocaleLowerCase()];
    return tokenValue === undefined ? '' : String(tokenValue);
  });
}

function compileElement(
  element: HTMLElement,
  fragmentName: BetterListTemplateFragmentName,
  slotCounts: Map<BetterListTemplateSlotName, number>,
  diagnostics: SourceEditorDiagnostic[]
): IBetterListTemplateElementNode | undefined {
  const tagName = element.tagName.toLocaleLowerCase();
  if (!allowedStructuralTags.has(tagName)) {
    diagnostics.push(error(`Element <${tagName}> is not allowed in Better List templates.`));
    return undefined;
  }
  const attributes: Record<string, string> = {};
  let slot: BetterListTemplateSlotName | undefined;
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLocaleLowerCase();
    const value = attribute.value;
    if (name === 'data-bl-slot') {
      if (!isSlotName(value) || slotsByFragment[fragmentName].indexOf(value) < 0) {
        diagnostics.push(error(`Slot "${value || '(empty)'}" is not allowed in fragment "${fragmentName}".`));
        continue;
      }
      slot = value;
      slotCounts.set(value, (slotCounts.get(value) || 0) + 1);
      continue;
    }
    if (!isAllowedAttribute(name)) {
      diagnostics.push(error(`Attribute "${name}" is not allowed in Better List templates.`));
      continue;
    }
    if (name === 'class' && (value.includes('{{') || value.includes('}}'))) {
      diagnostics.push(error(`Tokens are not allowed in ${fragmentName} class attributes.`));
    } else {
      validateTokens(value, fragmentName, `attribute "${name}"`, diagnostics);
    }
    attributes[name] = value;
  }

  const children: IBetterListTemplateNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      continue;
    }
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent || '';
      if (!value.trim()) {
        continue;
      }
      validateTokens(value, fragmentName, 'text', diagnostics);
      children.push({ type: 'text', value });
      continue;
    }
    if (child instanceof HTMLElement) {
      const compiled = compileElement(child, fragmentName, slotCounts, diagnostics);
      if (compiled) {
        children.push(compiled);
      }
      continue;
    }
    diagnostics.push(error(`Unsupported node found in fragment "${fragmentName}".`));
  }
  if (slot && children.some((child) => child.type === 'element' || child.value.trim())) {
    diagnostics.push(error(`Slot "${slot}" must not contain authored child content.`));
  }
  return { type: 'element', tagName, attributes, children, slot };
}

function isAllowedAttribute(name: string): boolean {
  if (
    forbiddenAttributeNames.has(name) ||
    name.startsWith('on') ||
    name.startsWith('data-bl-') ||
    reservedDataAttributeNames.has(name)
  ) {
    return false;
  }
  if (name === 'class' || name === 'title') {
    return true;
  }
  if (name.startsWith('aria-')) {
    return safeAriaAttributeNames.has(name);
  }
  return name.startsWith('data-');
}

function validateTokens(
  value: string,
  fragmentName: BetterListTemplateFragmentName,
  location: string,
  diagnostics: SourceEditorDiagnostic[]
): void {
  const allowedTokens = tokensByFragment[fragmentName];
  let residue = value;
  let match: RegExpExecArray | null;
  tokenPattern.lastIndex = 0;
  while ((match = tokenPattern.exec(value))) {
    const token = match[1].toLocaleLowerCase();
    residue = residue.replace(match[0], '');
    if (!allowedTokens.has(token)) {
      diagnostics.push(error(`Token "{{${token}}}" is not allowed in ${fragmentName} ${location}.`));
    }
  }
  if (residue.includes('{{') || residue.includes('}}')) {
    diagnostics.push(error(`Malformed token syntax in ${fragmentName} ${location}.`));
  }
}

function findMalformedMarkup(source: string): string | undefined {
  const stack: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor);
    if (start < 0) {
      break;
    }
    const marker = source[start + 1] || '';
    if (!/[!/a-z]/i.test(marker)) {
      cursor = start + 1;
      continue;
    }
    if (source.startsWith('<!--', start)) {
      const commentEnd = source.indexOf('-->', start + 4);
      if (commentEnd < 0) {
        return 'Malformed HTML: unterminated comment.';
      }
      cursor = commentEnd + 3;
      continue;
    }
    const tagEnd = findTagEnd(source, start + 1);
    if (tagEnd < 0) {
      return 'Malformed HTML: unterminated tag.';
    }
    const raw = source.slice(start, tagEnd + 1);
    if (/^<!/i.test(raw)) {
      cursor = tagEnd + 1;
      continue;
    }
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)\b/i.exec(raw);
    if (!match) {
      return 'Malformed HTML: invalid tag.';
    }
    const closing = Boolean(match[1]);
    const tag = match[2].toLocaleLowerCase();
    if (closing) {
      const open = stack.pop();
      if (open !== tag) {
        return `Malformed HTML: expected </${open || 'none'}> before </${tag}>.`;
      }
    } else if (!/\/\s*>$/.test(raw)) {
      stack.push(tag);
    }
    cursor = tagEnd + 1;
  }
  if (stack.length) {
    return `Malformed HTML: missing closing tag for <${stack[stack.length - 1]}>.`;
  }
  return undefined;
}

function findTagEnd(source: string, start: number): number {
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    } else if (character === '<') {
      return -1;
    }
  }
  return -1;
}

function isFragmentName(value: string): value is BetterListTemplateFragmentName {
  return fragmentNames.indexOf(value as BetterListTemplateFragmentName) >= 0;
}

function isSlotName(value: string): value is BetterListTemplateSlotName {
  return fragmentNames.some((fragmentName) => slotsByFragment[fragmentName].indexOf(value as BetterListTemplateSlotName) >= 0);
}

function error(message: string): SourceEditorDiagnostic {
  return { level: 'error', message };
}

function measureUtf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function createEmergencyBetterListTemplate(): IBetterListCompiledTemplate {
  const element = (
    tagName: string,
    children: readonly IBetterListTemplateNode[],
    slot?: BetterListTemplateSlotName,
    className?: string
  ): IBetterListTemplateElementNode => ({
    type: 'element',
    tagName,
    attributes: className ? { class: className } : {},
    children,
    slot
  });
  return {
    source: defaultBetterListHtmlTemplate,
    fragments: {
      shell: element('section', [
        element(
          'div',
          [element('div', [element('span', [], 'tabs'), element('span', [], 'search')], undefined, 'better-list__toolbar')],
          undefined,
          'better-list__header'
        ),
        element('div', [], 'content')
      ]),
      group: element('section', [element('h2', [], 'heading'), element('div', [], 'body')]),
      list: element('ul', [element('li', [], 'items')]),
      item: element('li', [element('span', [], 'title'), element('div', [], 'properties')])
    }
  };
}
