'use client';

import { MapPin, ExternalLink } from 'lucide-react';

/**
 * Props for {@link LocationLink}.
 */
export interface LocationLinkProps {
  /** The location's display name. Rendered as the link's visible text. */
  name: string;
  /**
   * Text the Google Maps search runs on (built by the domain
   * `buildLocationSearchQuery`: keywords, else the name). Falls back to `name`
   * when omitted or blank.
   */
  searchQuery?: string | null;
  /**
   * Optional caller-supplied, already-localized accessible name for the
   * wrapping link. When omitted, no `aria-label` is set and the link falls
   * back to the browser's default accessible-name computation from its
   * visible text (`name`).
   */
  ariaLabel?: string;
}

/**
 * Reusable location link: a pin icon plus a location's name, wrapped in a
 * single `<a target="_blank" rel="noopener noreferrer">` that opens a Google
 * Maps text search in a new tab.
 *
 * The link is always a text search (`searchQuery`, else `name`) and never
 * points at coordinates, so a wrong or missing geocode cannot send anyone to
 * the wrong place. There is no confidence gate and one trailing `ExternalLink`
 * icon, so a low-confidence match looks identical to a confirmed one.
 *
 * Renders nothing (`null`) when `name` is empty or whitespace-only.
 *
 * Domain-agnostic: no `next-intl` import. Callers supply already-resolved
 * `name`/`searchQuery`/`ariaLabel` strings.
 */
export function LocationLink({ name, searchQuery, ariaLabel }: LocationLinkProps) {
  if (!name.trim()) {
    return null;
  }

  const query = searchQuery?.trim() || name;
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1"
    >
      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{name}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
