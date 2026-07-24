const EB_GARAMOND_STYLESHEET_PATH = 'fonts/eb-garamond/eb-garamond.css';
const EB_GARAMOND_STYLESHEET_ATTRIBUTE = 'data-better-list-eb-garamond';

export function resolveEbGaramondStylesheetUrl(
  internalModuleBaseUrls: readonly string[],
): string | undefined {
  const baseUrl = internalModuleBaseUrls.find((candidate) => {
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  });
  return baseUrl
    ? new URL(EB_GARAMOND_STYLESHEET_PATH, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href
    : undefined;
}

export function ensureEbGaramondStylesheet(
  targetDocument: Document,
  internalModuleBaseUrls: readonly string[],
): HTMLLinkElement | undefined {
  const href = resolveEbGaramondStylesheetUrl(internalModuleBaseUrls);
  if (!href) {
    return undefined;
  }

  const existing = Array.from(
    targetDocument.querySelectorAll<HTMLLinkElement>(
      `link[${EB_GARAMOND_STYLESHEET_ATTRIBUTE}]`,
    ),
  ).find((link) => link.href === href);
  if (existing) {
    return existing;
  }

  const link = targetDocument.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(EB_GARAMOND_STYLESHEET_ATTRIBUTE, '');
  targetDocument.head.appendChild(link);
  return link;
}
