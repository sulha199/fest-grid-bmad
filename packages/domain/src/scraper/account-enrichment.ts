/**
 * A handle as compared for identity: trimmed, leading `@` removed, lower-cased (Instagram
 * handles are case-insensitive). Returns '' for an absent or blank handle.
 */
export function normalizeHandle(handle: string | null | undefined): string {
  return (handle ?? '').trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Whether a profile's `account_id` is the platform's numeric ID (discovered / publisher rows)
 * rather than the handle a user typed when subscribing (handle-keyed rows). See
 * `_bmad-output/specs/spec-profile-identity-unification/DESIGN.md` section 1.
 */
export function isNumericAccountId(accountId: string): boolean {
  return /^\d+$/.test(accountId.trim());
}

type ProfileIdentity = { accountId: string; username: string };
type PostOwner = { ownerId?: string; ownerUsername?: string };

/**
 * Whether a scraped post was published by the profile's OWN account -- as opposed to a repost,
 * collab or curator-feed post whose owner is someone else. A scrape of a profile returns both.
 *
 * - Handle-keyed profile (`account_id` is the handle): the owner's username must equal it.
 * - Numeric-keyed profile (`account_id` is the platform ID): the owner's `ownerId` must equal it.
 *   When the post also names an owner username and the profile already carries a real one that
 *   disagrees, the row's label no longer matches the ID the vendor sees: that is an identity
 *   conflict a human must settle, so the post does not count as the profile's own.
 *
 * `username` is never used to prove ownership of a handle-keyed row: it is the field this check
 * exists to protect (BUG-081).
 */
export function isPostOwnedByProfile(profile: ProfileIdentity, post: PostOwner): boolean {
  const accountId = profile.accountId.trim();

  if (!isNumericAccountId(accountId)) {
    const ownerHandle = normalizeHandle(post.ownerUsername);
    return ownerHandle !== '' && ownerHandle === normalizeHandle(accountId);
  }

  if (post.ownerId?.trim() !== accountId) {
    return false;
  }
  const currentHandle = normalizeHandle(profile.username);
  const ownerHandle = normalizeHandle(post.ownerUsername);
  return ownerHandle === '' || currentHandle === '' || currentHandle === accountId || ownerHandle === currentHandle;
}

/**
 * The first scraped post that is the profile's own AND carries owner data to backfill from.
 * Never "the first post with an owner": a curator or collab feed's first post usually belongs to
 * someone else (BUG-081).
 */
export function selectOwnPostForBackfill<T extends PostOwner & { ownerDisplayName?: string }>(
  profile: ProfileIdentity,
  posts: readonly T[]
): T | null {
  for (const post of posts) {
    if ((post.ownerDisplayName || post.ownerUsername) && isPostOwnedByProfile(profile, post)) {
      return post;
    }
  }
  return null;
}

/**
 * The handle a scrape must be addressed with (`https://www.instagram.com/<handle>/`, the Apify
 * `username` input). A handle-keyed profile is scraped by its `account_id` -- the handle the
 * subscriber typed and the row's identity -- never by the mutable `username`, so a relabelled
 * `username` can no longer redirect the batch to another account. A numeric-keyed profile has no
 * handle in `account_id`, so its `username` is the only handle there is.
 */
export function resolveScrapeHandle(profile: ProfileIdentity): string {
  const accountId = profile.accountId.trim();
  const handle = accountId.replace(/^@+/, '');
  if (handle && !isNumericAccountId(accountId)) {
    return handle;
  }
  return profile.username;
}

/**
 * The profile fields a scraped owner may update. Only call this with a post that
 * `isPostOwnedByProfile` accepted.
 *
 * - `displayName` follows the owner's current display name.
 * - `username` is filled when empty (or, on a numeric-keyed row, still the numeric ID placeholder),
 *   or corrected when only its case differs. A different handle never overwrites a set one: once set, `username` is the
 *   field the scraper builds its target from.
 */
export function computeProfileBackfillPatch(
  current: { accountId: string; displayName: string; username: string },
  scraped: { ownerDisplayName?: string; ownerUsername?: string }
): { displayName?: string; username?: string } | null {
  const patch: { displayName?: string; username?: string } = {};

  if (scraped.ownerDisplayName) {
    const trimmedDisplay = scraped.ownerDisplayName.trim();
    if (trimmedDisplay && trimmedDisplay !== current.displayName) {
      patch.displayName = trimmedDisplay;
    }
  }

  if (scraped.ownerUsername) {
    const trimmedUser = scraped.ownerUsername.trim();
    if (trimmedUser && trimmedUser !== current.username) {
      const currentHandle = normalizeHandle(current.username);
      const isUnset =
        currentHandle === '' ||
        (isNumericAccountId(current.accountId) && current.username.trim() === current.accountId.trim());
      if (isUnset || normalizeHandle(trimmedUser) === currentHandle) {
        patch.username = trimmedUser;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }

  return patch;
}

export const locationInferenceResponseSchema = {
  type: 'OBJECT',
  properties: {
    locationFound: { type: 'BOOLEAN' },
    placeDescription: { type: 'STRING' },
    confidence: { type: 'NUMBER' }
  },
  required: ['locationFound']
} as const;

export function buildLocationInferenceRequest(
  post: {
    locationName?: string;
    content?: string;
    ownerDisplayName?: string;
    ownerUsername?: string;
  }
): {
  systemInstruction: string;
  contents: string;
  responseMimeType: 'application/json';
  responseSchema: typeof locationInferenceResponseSchema;
} | null {
  const locationNameTrimmed = post.locationName?.trim() || '';
  const contentTrimmed = post.content?.trim() || '';

  if (!locationNameTrimmed && !contentTrimmed) {
    return null;
  }

  const accountNameMetadataTrimmed = (post.ownerDisplayName?.trim() || post.ownerUsername?.trim() || '');

  const systemInstruction =
    `You are an AI assistant designed to extract or infer a general geographic location or venue description from a social media post.\n` +
    `Your goal is to identify a place, city, neighborhood, or specific venue where the post's events or activities take place.\n` +
    `CRITICAL INSTRUCTIONS:\n` +
    `1. Scrutinize the provided post content and location metadata carefully.\n` +
    `2. Infer a description of the venue or location based ONLY on clues, names, addresses, or references in the post. Do not fabricate any information.\n` +
    `3. If you can confidently identify or infer a location description, set 'locationFound' to true and provide the location in 'placeDescription'.\n` +
    `4. If the post content and metadata do not contain enough specific information to confidently identify or infer a location description, you MUST set 'locationFound' to false and omit 'placeDescription' (or set it to null).\n` +
    `5. When 'locationFound' is true, also set 'confidence' to a number from 0.0 to 1.0 reflecting how certain you are that 'placeDescription' correctly identifies the real-world venue -- lower it when the only signal is a generic or ambiguous term (e.g. a single common word with no city/region qualifier), and raise it when the post and location metadata agree on a specific, unambiguous place.\n` +
    `6. Use the provided account name metadata as a general-purpose disambiguation signal (representing the profile that published the post) to help resolve ambiguous or generic place references in the post content.\n` +
    `7. Return the result strictly in the JSON format matching the specified response schema.`;

  const contents = `Account Name Metadata: "${accountNameMetadataTrimmed}"\nLocation Name Metadata: "${locationNameTrimmed}"\nPost Content text:\n"${contentTrimmed}"`;

  return {
    systemInstruction,
    contents,
    responseMimeType: 'application/json',
    responseSchema: locationInferenceResponseSchema
  };
}

export interface LocationInferenceResult {
  placeDescription: string;
  /**
   * The AI's confidence in this inference, 0.0-1.0. Defaults to 0 (treated as
   * low-confidence, gated to AWAITING_APPROVAL) when the model omits it,
   * rather than assuming a confident result it never actually claimed.
   */
  confidence: number;
}

export function parseLocationInferenceResponse(rawText: string): LocationInferenceResult | null {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object' && parsed.locationFound === true) {
      const place = parsed.placeDescription;
      if (typeof place === 'string') {
        const trimmed = place.trim();
        if (trimmed) {
          const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? Math.min(1, Math.max(0, parsed.confidence))
            : 0;
          return { placeDescription: trimmed, confidence };
        }
      }
    }
  } catch {
    // Gracefully handle parsing failures, never throw
  }
  return null;
}

/**
 * Resolves the display name / username to persist for a discovered (publisher or
 * coauthor) identity, per Story 3.14 AC3's fallback chain:
 * - username: the identity's own username, or the raw accountId if absent/blank.
 * - displayName: the identity's own displayName, else its username, else the raw
 *   accountId -- Apify's coauthorProducers never supplies a full name, so coauthor
 *   identities always fall through to username here.
 * Whitespace-only values are treated as absent (trimmed to empty, falls through).
 */
export function resolveDiscoveredIdentityNames(identity: {
  accountId: string;
  username?: string;
  displayName?: string;
}): { displayName: string; username: string } {
  const username = identity.username?.trim() || identity.accountId;
  const displayName = identity.displayName?.trim() || identity.username?.trim() || identity.accountId;
  return { displayName, username };
}
