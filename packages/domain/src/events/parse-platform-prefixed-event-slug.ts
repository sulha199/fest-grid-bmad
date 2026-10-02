import { getPlatformByCode } from "../scraper/platform-registry.js";
import type { ScrapablePlatform } from "../subscriptions/platforms.js";

/**
 * The parsed shape of a platform-prefixed event slug (e.g. `ig_p_Cx9uWttkSN`), built exclusively
 * from `packages/domain/src/events/build-event-insert-values.ts`'s `buildPlatformPrefixedSlug()`.
 */
export interface ParsedPlatformPrefixedEventSlug {
  platform: ScrapablePlatform;
  platformPostType: string;
  platformPostId: string;
}

/**
 * Reverses `buildPlatformPrefixedSlug()` (`{platformSlug}_{postType}_{platformPostId}`, optionally
 * suffixed `~{ordinal}` per Architecture Spine AD-16 Rule 9), per AD-16 Rule 1 ("parsing splits on
 * the first two `_` occurrences only") and Rule 9 ("split the remainder at the **last** `~`; no `~`
 * means ordinal 0").
 *
 * The ordinal suffix (if present) is parsed and discarded, never returned or used -- AD-16 Rule 6
 * "ignores the ordinal" by construction, not by special-casing it later (Story 3.7h AC1/AC4).
 *
 * Returns `null` -- never a guessed value -- for: a legacy hex slug (no `_` at all, so fewer than
 * two `_` indices exist), any other malformed slug with fewer than two `_` occurrences, or a
 * `platformSlugSegment` that doesn't resolve to a known platform via `getPlatformByCode()`.
 *
 * Deliberately platform-agnostic: a recognized non-Instagram platform (e.g. `x_status_123`) still
 * parses successfully here -- rejecting non-Instagram platforms is the caller's (the
 * `Query.instagramEmbedBySlug` resolver's) concern, not this pure parser's.
 *
 * Deliberately does not validate `platformPostType` against the known `'p'|'reel'|'reels'` set --
 * any value reaching this parser was either produced validly by the slug-construction side, or is
 * attacker/garbage input that the caller's own downstream handling (e.g. a rejected oEmbed request)
 * safely handles without a separate rejection path here.
 */
export function parsePlatformPrefixedEventSlug(slug: string): ParsedPlatformPrefixedEventSlug | null {
  const firstUnderscoreIndex = slug.indexOf("_");
  if (firstUnderscoreIndex === -1) {
    return null;
  }

  const secondUnderscoreIndex = slug.indexOf("_", firstUnderscoreIndex + 1);
  if (secondUnderscoreIndex === -1) {
    return null;
  }

  const platformSlugSegment = slug.slice(0, firstUnderscoreIndex);
  const postTypeSegment = slug.slice(firstUnderscoreIndex + 1, secondUnderscoreIndex);
  const remainder = slug.slice(secondUnderscoreIndex + 1);

  const lastTildeIndex = remainder.lastIndexOf("~");
  const platformPostId = lastTildeIndex === -1 ? remainder : remainder.slice(0, lastTildeIndex);

  const platform = getPlatformByCode(platformSlugSegment);
  if (!platform) {
    return null;
  }

  return {
    platform,
    platformPostType: postTypeSegment,
    platformPostId,
  };
}
