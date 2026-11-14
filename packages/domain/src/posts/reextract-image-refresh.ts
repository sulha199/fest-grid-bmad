import { parseImageUrlExpiry } from "../scraper/parse-image-url-expiry.js";
import { isImageUrlExpired, postImagesNeedRefresh, type StoredPostImages } from "./post-images-need-refresh.js";

// Story 10.6 (PRD 3.9.3 FR125; Architecture Spine AD-40 Rule 5, AD-53 Rule 17) -- the pure rules of the moderator re-extract's image
// refresh: WHEN a stored post's images are refreshed, WHAT of a vendor's answer is saved to `posts`, and the report a job keeps of
// what happened. No DB, Node-only or AWS import: the Scraper Lambda's handler applies them, the API reads the report.

/** The cover or a slide counts as low resolution when its `stp` size token is this many pixels or smaller (Bright Data's 640 px images). */
export const REEXTRACT_LOW_RESOLUTION_MAX_PX = 640;

/**
 * The larger side of the `s<W>x<H>` size token in an Instagram image URL's `stp` query parameter (for example
 * `stp=dst-jpg_e35_s640x640_sh0.08_tt6` gives 640), or null when the URL has no such token (a full-size image carries none).
 */
export function readImageStpMaxSide(url: string | null | undefined): number | null {
  if (!url) return null;
  let stp: string | null;
  try {
    stp = new URL(url).searchParams.get("stp");
  } catch {
    return null;
  }
  if (!stp) return null;
  for (const token of stp.split("_")) {
    const match = /^s(\d+)x(\d+)$/.exec(token);
    if (match) return Math.max(Number(match[1]), Number(match[2]));
  }
  return null;
}

/** True when the image URL is known to be a low-resolution copy (`s640x640` or smaller in `stp`). */
export function isLowResolutionImageUrl(url: string | null | undefined): boolean {
  const side = readImageStpMaxSide(url);
  return side !== null && side <= REEXTRACT_LOW_RESOLUTION_MAX_PX;
}

/** Why a refresh is due (FR125). Every reason that applies is reported. */
export const REEXTRACT_REFRESH_REASONS = [
  "CAPTION_MISSING",
  "COVER_EXPIRED",
  "COVER_MISSING",
  "SLIDES_EXPIRED",
  "COVER_LOW_RESOLUTION",
  "SLIDES_UNKNOWN",
] as const;
export type ReextractRefreshReason = (typeof REEXTRACT_REFRESH_REASONS)[number];

/** What the refresh rule reads of a stored post. `platformPostType` is the permalink type (`p`, `reel`), null on a legacy row. */
export interface StoredPostImageFacts extends StoredPostImages {
  platformPostType?: string | null;
}

/**
 * The reasons a stored post's images must be refreshed before a re-extract preview (design decision 5): the cover link has
 * expired (or slides are listed with no cover), a slide link has expired, the cover is low resolution, or slides are missing or
 * unknown (no post type and no slide list were ever stored), or, with `captionMissing`, the caption itself is needed. Empty means
 * nothing to refresh.
 */
export function reextractRefreshReasons(
  post: StoredPostImageFacts,
  now: Date,
  options: { captionMissing?: boolean } = {}
): ReextractRefreshReason[] {
  const reasons: ReextractRefreshReason[] = [];
  // The post has no stored caption (a curator post's is cleared on purpose, or the URL is not in the database): the fetch is
  // needed for the caption itself, whatever state the images are in.
  if (options.captionMissing) reasons.push("CAPTION_MISSING");
  const slides = post.additionalImageUrls ?? [];
  if (!post.imageUrl) {
    if (slides.length > 0) reasons.push("COVER_MISSING");
  } else if (postImagesNeedRefresh({ imageUrl: post.imageUrl, imageUrlExpiresAt: post.imageUrlExpiresAt }, now)) {
    reasons.push("COVER_EXPIRED");
  }
  if (slides.some((url) => isImageUrlExpired(url, now))) reasons.push("SLIDES_EXPIRED");
  if (isLowResolutionImageUrl(post.imageUrl)) reasons.push("COVER_LOW_RESOLUTION");
  if (!post.platformPostType && post.additionalImageUrls == null) reasons.push("SLIDES_UNKNOWN");
  return reasons;
}

/** How many of the post's stored image links (cover and slides) have expired, for the report. */
export function countExpiredImageLinks(post: StoredPostImages, now: Date): number {
  const cover = post.imageUrl && postImagesNeedRefresh({ imageUrl: post.imageUrl, imageUrlExpiresAt: post.imageUrlExpiresAt }, now) ? 1 : 0;
  return cover + (post.additionalImageUrls ?? []).filter((url) => isImageUrlExpired(url, now)).length;
}

/** The image links a vendor answered with. */
export interface FreshImageLinks {
  imageUrl?: string | null;
  additionalImageUrls?: readonly string[] | null;
}

/** The columns of `posts` a refresh may write; only the fields that change are present. Never the caption. */
export interface FreshImagesToSave {
  imageUrl?: string;
  imageUrlExpiresAt?: Date | null;
  additionalImageUrls?: string[];
}

function coverIsUsable(post: StoredPostImages, now: Date): boolean {
  return Boolean(post.imageUrl) && !postImagesNeedRefresh({ imageUrl: post.imageUrl, imageUrlExpiresAt: post.imageUrlExpiresAt }, now);
}

/**
 * What to save of a vendor's fresh image links over the stored ones (design decision 6): a fresh cover replaces the stored one,
 * with its own expiry, unless it is the same link, already expired, or a low-resolution copy that would replace a full-size cover
 * still valid; fresh slides replace the stored list unless they are empty or shorter than it (never a shorter list over a longer one,
 * so never an empty list over a non-empty one), the same list, or low-resolution ones that would replace a full-size list still valid. Returns null when nothing should be written.
 */
export function decideFreshImagesToSave(input: {
  stored: StoredPostImages;
  fresh: FreshImageLinks;
  now: Date;
}): FreshImagesToSave | null {
  const { stored, fresh, now } = input;
  const toSave: FreshImagesToSave = {};

  const freshCover = fresh.imageUrl || undefined;
  if (freshCover && freshCover !== stored.imageUrl && !isImageUrlExpired(freshCover, now)) {
    const storedFullSizeAndValid = coverIsUsable(stored, now) && !isLowResolutionImageUrl(stored.imageUrl);
    if (!(isLowResolutionImageUrl(freshCover) && storedFullSizeAndValid)) {
      toSave.imageUrl = freshCover;
      toSave.imageUrlExpiresAt = parseImageUrlExpiry(freshCover);
    }
  }

  const freshSlides = (fresh.additionalImageUrls ?? []).filter((url) => url !== "");
  const storedSlides = stored.additionalImageUrls ?? [];
  const sameSlides = freshSlides.length === storedSlides.length && freshSlides.every((url, i) => url === storedSlides[i]);
  // Never a SHORTER list over a longer stored one (a vendor that returns part of a carousel must not shrink what is known); equal or longer replaces.
  if (freshSlides.length > 0 && !sameSlides && freshSlides.length >= storedSlides.length) {
    const storedFullSizeAndValid =
      storedSlides.length > 0 && !storedSlides.some((url) => isImageUrlExpired(url, now) || isLowResolutionImageUrl(url));
    if (!(freshSlides.some((url) => isLowResolutionImageUrl(url)) && storedFullSizeAndValid)) {
      toSave.additionalImageUrls = [...freshSlides];
    }
  }

  return Object.keys(toSave).length > 0 ? toSave : null;
}

/** How the refresh phase ended. */
export const REEXTRACT_REFRESH_OUTCOMES = [
  "NOT_NEEDED",
  "REFRESHED",
  "NOT_SCRAPED",
  "COOLDOWN",
  "IN_FLIGHT",
  "POST_UNAVAILABLE",
  "NO_PROVIDER_REACHABLE",
  "PROVIDER_OVER_QUOTA",
  "TIMED_OUT",
] as const;
export type ReextractRefreshOutcome = (typeof REEXTRACT_REFRESH_OUTCOMES)[number];

/**
 * What a re-extract job keeps of its refresh phase (FR125: the banner of Story 10.6a is drawn from it). Plain words and numbers
 * only: no vendor name, no URL, no caption.
 */
export interface ReextractRefreshReport {
  outcome: ReextractRefreshOutcome;
  /** Why a refresh was due; empty when `NOT_NEEDED`. */
  reasons: ReextractRefreshReason[];
  /** Fresh links were written to the post. */
  saved: boolean;
  /** A Bright Data snapshot is still running; its result will be saved to the post when it arrives (FR119). */
  lateResultPending: boolean;
  /** `COOLDOWN` only: when a refresh can be tried again (ISO 8601). */
  retryAfter: string | null;
  /** Stored image links that were still expired after the refresh. */
  expiredLinks: number;
}
