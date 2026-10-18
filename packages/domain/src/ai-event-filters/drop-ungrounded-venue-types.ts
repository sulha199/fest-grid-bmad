import { mapFilterLeaves } from './map-filter-leaves.js';
import type { FilterNode } from './filter-node.js';
import { normalize } from './normalize-filter-node.js';

/**
 * Indonesian/alternate spellings of venue values Gemini emits in English. Keyed by the lowercased,
 * space-separated venue value. Extend when a real prompt is wrongly rejected.
 */
const VENUE_TYPE_ALIASES: Record<string, readonly string[]> = {
  cafe: ['kafe', 'coffee shop', 'kedai kopi'],
  mall: ['mal'],
  stadium: ['stadion'],
  hall: ['gedung', 'aula'],
  park: ['taman'],
  campus: ['kampus'],
};

export interface DropUngroundedVenueTypesResult {
  expression: FilterNode;
  caveats: string[];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function mentions(promptText: string, promptTokens: Set<string>, term: string): boolean {
  if (term.includes(' ')) {
    return promptText.includes(term);
  }
  return promptTokens.has(term) || promptTokens.has(`${term}s`);
}

/**
 * `venueType` is free text matched with `eq`, so a value the user never mentioned silently
 * filters the feed down to nothing. The lite Gemini tiers fill it as a placeholder when a prompt
 * has no mappable condition (e.g. "exciting events for kids" -> `venueType: "kids"`). Drops every
 * `venueType` leaf whose value (or a known alias) does not appear as a word in `prompt`, and
 * reports each drop as a caveat instead of applying a guessed filter.
 */
export function dropUngroundedVenueTypes(expression: FilterNode, prompt: string): DropUngroundedVenueTypesResult {
  const promptText = prompt.toLowerCase();
  const promptTokens = new Set(tokenize(prompt));
  const caveats: string[] = [];

  const mapped = mapFilterLeaves(expression, (leaf) => {
    if (leaf.field !== 'venueType') {
      return leaf;
    }
    const value = leaf.value.toLowerCase().replace(/_/g, ' ').trim();
    const terms = [value, ...(VENUE_TYPE_ALIASES[value] ?? [])];
    if (terms.some((term) => mentions(promptText, promptTokens, term))) {
      return leaf;
    }
    const caveat = `Ignored the venue type "${leaf.value}" because your prompt did not mention a place.`;
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
