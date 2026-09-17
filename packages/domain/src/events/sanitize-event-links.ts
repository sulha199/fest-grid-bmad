import { EventLink } from '@festgrid/shared-types';

const MAX_LINKS = 10;

/**
 * Sanitizes a raw Gemini-extracted `links` payload before it is persisted (Story 0.37, AC2).
 *
 * Rules:
 * - Drops any entry whose `url` does not parse as an absolute URL with an `http:`/`https:`
 *   protocol (guards against `javascript:`/`data:`/relative/malformed values ever reaching a
 *   rendered `href`).
 * - Trims `label`, treating an empty/whitespace-only label as absent.
 * - Caps the result at the first 10 *valid* entries, in source order.
 * - Returns `undefined` (never `[]`) when no valid entries remain, matching this file's
 *   existing absent-not-empty convention (see `contactInfo`'s discard-at-classification
 *   handling in `transform-gemini-response-to-event-info.ts`).
 */
export function sanitizeEventLinks(links: EventLink[] | undefined): EventLink[] | undefined {
  if (!links || links.length === 0) {
    return undefined;
  }

  const sanitized: EventLink[] = [];

  for (const link of links) {
    if (sanitized.length >= MAX_LINKS) {
      break;
    }

    if (!isAllowedHttpUrl(link?.url)) {
      continue;
    }

    const trimmedLabel = link.label?.trim();
    const sanitizedLink: EventLink = trimmedLabel
      ? { url: link.url, label: trimmedLabel }
      : { url: link.url };

    sanitized.push(sanitizedLink);
  }

  return sanitized.length > 0 ? sanitized : undefined;
}

function isAllowedHttpUrl(url: string | undefined | null): url is string {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
