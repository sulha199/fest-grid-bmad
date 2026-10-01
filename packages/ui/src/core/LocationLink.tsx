'use client';

import { MapPin, ExternalLink, Search } from 'lucide-react';
import { isLocationTrustworthy } from '@festgrid/domain/geolocation';

/**
 * Props for {@link LocationLink}.
 *
 * `coordinates`/`confidence`/`matchType` are shaped to match
 * `isLocationTrustworthy`'s own `LocationConfidenceSignal` type so both a
 * GraphQL-codegen result (`T | null`) and a plain object literal
 * (`T | undefined`) can be passed straight through without adapting.
 */
export interface LocationLinkProps {
  /** The location's display name. Rendered as the link's visible text. */
  name: string;
  /**
   * Resolved geocoordinates for this location, when known. Required (along
   * with a trustworthy `confidence`/`matchType`) to link directly to the
   * coordinate rather than falling back to a text search.
   */
  coordinates?: { lat: number; lng: number } | null;
  /**
   * Geocoding confidence score for this location, on the same scale as
   * `isLocationTrustworthy`'s `MIN_TRUSTWORTHY_CONFIDENCE` threshold.
   */
  confidence?: number | null;
  /** Geocoding match type, compared against `isLocationTrustworthy`'s `TRUSTWORTHY_MATCH_TYPE`. */
  matchType?: string | null;
  /**
   * Optional caller-supplied, already-localized accessible name for the
   * wrapping link. When omitted, no `aria-label` is set and the link falls
   * back to the browser's default accessible-name computation from its
   * visible text (`name`) — this component introduces no new accessible-naming
   * mechanism beyond what a caller opts into here.
   */
  ariaLabel?: string;
}

/**
 * Reusable location link: renders a pin icon plus a location's name, always
 * wrapped in a single `<a target="_blank" rel="noopener noreferrer">` that
 * opens a Google Maps search in a new tab.
 *
 * The link target and trailing icon are gated by `isLocationTrustworthy`
 * (imported from `@festgrid/domain/geolocation`, the same predicate/threshold
 * already used by the event-detail map link):
 * - Trustworthy coordinates → links directly to the coordinate, trailing
 *   `ExternalLink` icon.
 * - Untrustworthy or absent coordinates → links to a text search built from
 *   `name`, trailing `Search` icon instead — a low-confidence match is never
 *   presented identically to a confirmed one.
 *
 * Renders nothing (`null`) when `name` is empty or whitespace-only, so a
 * caller passing an absent/blank location never produces an empty, unlabeled
 * `<a target="_blank">`.
 *
 * Domain-agnostic: no `next-intl` import, no FestGrid-specific business
 * logic. Callers supply already-resolved/localized `name`/`ariaLabel` strings.
 */
export function LocationLink({ name, coordinates, confidence, matchType, ariaLabel }: LocationLinkProps) {
  if (!name.trim()) {
    return null;
  }

  const trustworthy = !!coordinates && isLocationTrustworthy({ confidence, matchType });

  const href = trustworthy
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates!.lat},${coordinates!.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

  const TrailingIcon = trustworthy ? ExternalLink : Search;

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
      <TrailingIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
