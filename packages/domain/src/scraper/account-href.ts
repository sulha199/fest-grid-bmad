import type { ScrapablePlatform } from "../subscriptions/platforms.js";
import { getPlatformSlug } from "./platform-registry.js";

/** Lower-case, trimmed, no leading `@`: how a username is compared and written into a URL. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/**
 * The one builder of an account page path (Architecture Spine AD-35 Rules 1-2).
 *
 * The URL carries the normalized `username`, never the platform's numeric `account_id`. An empty
 * username yields `null` (the caller renders an unlinked card); there is deliberately no
 * numeric-ID fallback link.
 */
export function buildAccountHref(
  platform: ScrapablePlatform,
  username: string | null | undefined
): string | null {
  const normalized = normalizeUsername(username ?? "");
  if (normalized === "") return null;
  return `/${getPlatformSlug(platform)}/${encodeURIComponent(normalized)}`;
}
