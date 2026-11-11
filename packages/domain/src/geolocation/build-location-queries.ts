import type { LocationResolution } from '@festgrid/shared-types';
import type { CountryHint } from './resolve-country-hint.js';

/** A ladder step that can resolve a location (the other two `LocationResolution` values, `none` and `skipped`, are outcomes). */
export type LocationLadderStepName = Exclude<LocationResolution, 'none' | 'skipped'>;

export interface LocationLadderStep {
  step: LocationLadderStepName;
  query: string;
}

/** One lookup to try, in execution order: a ladder step, searched inside a country (hard filter) or everywhere. */
export interface LocationLookupAttempt extends LocationLadderStep {
  /** ISO code to hard-filter on (the client lower-cases it); absent = search everywhere. */
  countryFilter?: string;
}

/**
 * Keywords ladder (most specific first): step 1 = all keywords joined with ", "; step 2 = without the most specific one, only with
 * two or more keywords. The caller runs step 2 only when step 1 ended in "not found".
 */
export function buildKeywordQueries(keywords: readonly string[]): LocationLadderStep[] {
  const usable = keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword !== '');
  if (usable.length === 0) return [];
  const steps: LocationLadderStep[] = [{ step: 'kw1', query: usable.join(', ') }];
  if (usable.length >= 2) steps.push({ step: 'kw2', query: usable.slice(1).join(', ') });
  return steps;
}

// Floor/level/unit/RT/RW/street-number words that make a venue text a poor geocoder query (Indonesian and English), only WITH their
// number ("Lt. 3", "Lantai 3", "Level 2", "No. 28"): a bare "Level" (Level Up Cafe) or "Lt." (Lt. Jend. S. Parman) is part of a name.
// "Blok" counts as noise only when a block code with a digit follows ("Blok A3"): "Blok M" is a place name. `(?![a-z0-9])` ends the
// match so the "." of "Lt." goes with the word.
const UNIT_NOISE =
  /\b(?:ground floor|(?:lantai|lt|floor|level|ug|lg)\b\.?\s*\d+[a-z]?|blok [a-z]?\d+[a-z0-9]*|rt\.?\s*\d+|rw\.?\s*\d+|no\.?\s*\d+[a-z]?)(?![a-z0-9])/gi;

function countryNameOf(countryCode: string | undefined): string | undefined {
  if (!countryCode) return undefined;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase());
  } catch {
    // An unknown or malformed region code: just no country name to strip.
    return undefined;
  }
}

/**
 * Fallback ladder for a text WITHOUT keywords (old rows, a failed keywords call): step 1 = the text with parentheticals,
 * floor/level/unit/RT/RW/street-number noise and the hint country's name (or code) removed, comma segments kept; step 2 = its last
 * two segments of all of them, only with three or more. Measured on 54 labelled real locations: 38 correct against 29 for the raw text.
 */
export function buildFallbackLocationQueries(text: string, countryCode?: string): LocationLadderStep[] {
  const countryName = countryNameOf(countryCode)?.toLowerCase();
  const country = countryCode?.toLowerCase();
  const segments = text
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;|]/)
    .map((segment) => segment.replace(UNIT_NOISE, ' ').replace(/\s+/g, ' ').trim())
    .filter((segment) => segment.length > 1 && /[a-z]/i.test(segment) && !/^\d+[\s\d-]*$/.test(segment))
    .filter((segment) => {
      const lower = segment.toLowerCase();
      return lower !== countryName && lower !== country;
    });
  if (segments.length === 0) return [];
  // Step 1 keeps the first 5 segments (a bounded query); step 2 is the LAST two of all of them, which carry the city and province.
  const steps: LocationLadderStep[] = [{ step: 'fb1', query: segments.slice(0, 5).join(', ') }];
  if (segments.length >= 3) steps.push({ step: 'fb2', query: segments.slice(-2).join(', ') });
  return steps;
}

/**
 * The lookups for one text, in execution order. A trusted string/consensus code is a hard filter with no unfiltered pass after it
 * (it returned foreign look-alikes in the POC); the platform default is a guess, so its filtered pass is followed by one
 * unfiltered pass; with no hint there is only the unfiltered pass. The caller stops at the first lookup that finds a plausible
 * place, skips to the next on "not found", and gives up (no ladder) on an outage.
 */
export function planLocationLookups(steps: readonly LocationLadderStep[], hint: CountryHint): LocationLookupAttempt[] {
  const filtered: LocationLookupAttempt[] = hint.code ? steps.map((step) => ({ ...step, countryFilter: hint.code })) : [];
  const unfiltered: LocationLookupAttempt[] = steps.map((step) => ({ ...step }));
  if (hint.source === 'string') return filtered;
  if (hint.source === 'platform') return [...filtered, ...unfiltered];
  return unfiltered;
}
