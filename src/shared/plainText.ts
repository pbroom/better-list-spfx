const BLOCK_ELEMENT_PATTERN = /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (match, entity: string): string => {
    if (entity[0] === '#') {
      const hexadecimal = entity[1]?.toLocaleLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return NAMED_ENTITIES[entity.toLocaleLowerCase()] ?? match;
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function containsEncodedOrLiteralMarkup(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value) || /&(?:lt|gt|#0*60|#x0*3c);/i.test(value);
}

function stripMarkupOnce(value: string): string {
  if (typeof DOMParser !== 'undefined') {
    const documentValue = new DOMParser().parseFromString(value, 'text/html');
    documentValue.querySelectorAll('script, style, noscript, template').forEach((element) => element.remove());
    documentValue.querySelectorAll('br').forEach((element) => element.replaceWith(' '));
    documentValue
      .querySelectorAll('address, article, aside, blockquote, dd, div, dl, dt, fieldset, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, tbody, td, tfoot, th, thead, tr, ul')
      .forEach((element) => element.append(' '));
    return normalizeWhitespace(documentValue.body.textContent || '');
  }

  return normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(BLOCK_ELEMENT_PATTERN, ' ')
        .replace(/<[^>]*>/g, '')
    )
  );
}

/** Converts SharePoint rich-text field output to safe, readable display text. */
export function toPlainText(value: string): string {
  if (!value) {
    return value;
  }

  let result = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = stripMarkupOnce(result);
    result = next;
    if (!containsEncodedOrLiteralMarkup(result)) {
      break;
    }
  }
  return result;
}
