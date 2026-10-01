/**
 * Derives a post's platform-native post id and real permalink type ('p', 'reel', 'reels', ...)
 * from its scraped URL(s), captured once at scrape time (AD-16 Rule 2) rather than assumed or
 * re-parsed later. Prefers `originalPostUrl` (the real source link, when derivable) over `postUrl`
 * (the post as actually scraped, which may be a proxy/mirror site) -- see epics.md's own semantics
 * for these two fields.
 *
 * Matching is shape-based on the URL path, not hostname-based: `postUrl` may be a non-Instagram-domain
 * proxy/mirror that still mirrors Instagram's own `/p/`, `/reel/`, `/reels/` path convention, so gating
 * on hostname (e.g. via `detectPlatformFromUrl()`) would wrongly null out exactly the proxy case this
 * function exists to still capture correctly. The permalink type is captured verbatim (`reel` and
 * `reels` are NOT normalized to one value) -- never assumed.
 *
 * Returns `{ platformPostId: null, platformPostType: null }` when neither URL is parseable or neither
 * matches the `/p//reel//reels/` path shape -- never a guessed value.
 */

const PERMALINK_PATH_REGEX = /\/(p|reel|reels)\/([^/?#]+)/;

function matchPermalink(url: string | null | undefined): { platformPostId: string; platformPostType: string } | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const match = PERMALINK_PATH_REGEX.exec(parsedUrl.pathname);
    if (!match) {
      return null;
    }

    return {
      platformPostType: match[1],
      platformPostId: match[2],
    };
  } catch {
    return null;
  }
}

export function parsePlatformPostIdentity(urls: {
  postUrl?: string | null;
  originalPostUrl?: string | null;
}): { platformPostId: string | null; platformPostType: string | null } {
  const match = matchPermalink(urls.originalPostUrl) ?? matchPermalink(urls.postUrl);

  if (!match) {
    return { platformPostId: null, platformPostType: null };
  }

  return match;
}
