import { mapFilterLeaves } from './map-filter-leaves.js';
import type { FilterNode } from './filter-node.js';
import { normalize } from './normalize-filter-node.js';

export interface DropUnsupportedVenueTypesResult {
  expression: FilterNode;
  caveats: string[];
}

/**
 * Filtering by venue type is not offered through the AI filter yet (BACKLOG: venue-type design --
 * closed vocabulary, Geoapify vs AI classification, indoor/outdoor semantics). The model is no
 * longer given a `venueType` field, so a word like "outdoor" or "cafe" arrives as one of its own
 * caveats; this is the safety net for any `venueType` leaf that still gets through (the legacy
 * flat response shape, a stray model emission). Each is dropped -- never applied: a free-text
 * `eq` against a value nothing guarantees exists silently empties the feed -- and reported as a
 * caveat so the user sees the rest of the filter still applies.
 */
export function dropUnsupportedVenueTypes(expression: FilterNode): DropUnsupportedVenueTypesResult {
  const caveats: string[] = [];

  const mapped = mapFilterLeaves(expression, (leaf) => {
    if (leaf.field !== 'venueType') {
      return leaf;
    }
    const caveat = `Ignored the venue type "${leaf.value}": filtering by venue type isn't supported yet.`;
    if (!caveats.includes(caveat)) {
      caveats.push(caveat);
    }
    return undefined;
  });

  return {
    expression: mapped === undefined ? { op: 'AND', children: [] } : normalize(mapped),
    caveats,
  };
}
