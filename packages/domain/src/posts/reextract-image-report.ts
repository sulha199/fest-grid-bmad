import { isImageUrlExpired } from "./post-images-need-refresh.js";
import type { ReextractRefreshOutcome } from "./reextract-image-refresh.js";

// Story 10.6a (PRD 3.9.3 FR125; Architecture Spine AD-40 Rule 9, AD-53 Rule 18) -- the pure rules of the per-image report of a
// moderator re-extract preview: which image the extraction read and which it did not, and why. The AI-processor builds the list
// (`buildReextractImageReport`) and the web draws the missing-images banner from it (`summarizeMissingImages`,
// `pickReextractBannerCauses`). No URL ever enters or leaves these functions except the one `classifyUnreadImage` reads and drops.
// No DB, Node-only or AWS import.

/** How a post's image fared in a preview (decision 3 of Story 10.6a). */
export const REEXTRACT_IMAGE_STATES = ["READ", "NOT_READ_EXPIRED", "NOT_READ_UNAVAILABLE", "NOT_SENT_OVER_CAP"] as const;
export type ReextractImageState = (typeof REEXTRACT_IMAGE_STATES)[number];

export const REEXTRACT_IMAGE_ROLES = ["COVER", "SLIDE"] as const;
export type ReextractImageRole = (typeof REEXTRACT_IMAGE_ROLES)[number];

/** The state of an image the request tried to fetch (an over-cap slide is never fetched). */
export type ReextractFetchedImageState = Exclude<ReextractImageState, "NOT_SENT_OVER_CAP">;

/** One image of the post: position 0 is the cover, slides count from 1 in the de-duplicated order. */
export interface ReextractImageEntry {
  position: number;
  role: ReextractImageRole;
  state: ReextractImageState;
}

/** What the request builder saw per image, in order. No URL: the classification has already used it. */
export interface ReextractImageOutcomes {
  /** The cover's state, null when the post lists no cover. */
  cover: ReextractFetchedImageState | null;
  /** The slides the request tried, in order (at most the cap). */
  slides: ReextractFetchedImageState[];
  /** Slides beyond the cap: never fetched. */
  overCapSlides: number;
}

/**
 * Why an image could not be read: `NOT_READ_EXPIRED` only when its own stored link has passed its expiry, otherwise
 * `NOT_READ_UNAVAILABLE` (a non-OK answer, a non-image, a blur that failed closed or had no time).
 */
export function classifyUnreadImage(url: string | null | undefined, now: Date): "NOT_READ_EXPIRED" | "NOT_READ_UNAVAILABLE" {
  return isImageUrlExpired(url, now) ? "NOT_READ_EXPIRED" : "NOT_READ_UNAVAILABLE";
}

/** The entry list of a preview: the cover (when there is one) first, then the tried slides in order, then the over-cap slides. */
export function buildReextractImageReport(outcomes: ReextractImageOutcomes): ReextractImageEntry[] {
  const entries: ReextractImageEntry[] = [];
  if (outcomes.cover !== null) entries.push({ position: 0, role: "COVER", state: outcomes.cover });
  let position = 1;
  for (const state of outcomes.slides) entries.push({ position: position++, role: "SLIDE", state });
  for (let i = 0; i < outcomes.overCapSlides; i++) entries.push({ position: position++, role: "SLIDE", state: "NOT_SENT_OVER_CAP" });
  return entries;
}

/** A run of consecutive slide positions, both ends included (a single slide has `from === to`). */
export interface ReextractSlideRange {
  from: number;
  to: number;
}

export interface MissingImagesSummary {
  /** The cover was not read. */
  coverMissing: boolean;
  /** The slides that were tried and not read, as runs of consecutive positions. */
  slideRanges: ReextractSlideRange[];
  /** Slides left out because the carousel is longer than the preview cap. */
  overCapCount: number;
  /** Images that were tried and not read (cover and slides, over-cap slides not counted). */
  failedCount: number;
}

/** What the banner names: the cover, the slide ranges and the over-cap count. */
export function summarizeMissingImages(images: readonly ReextractImageEntry[]): MissingImagesSummary {
  let coverMissing = false;
  let overCapCount = 0;
  const slidePositions: number[] = [];
  for (const image of images) {
    if (image.state === "READ") continue;
    if (image.state === "NOT_SENT_OVER_CAP") {
      overCapCount += 1;
    } else if (image.role === "COVER") {
      coverMissing = true;
    } else {
      slidePositions.push(image.position);
    }
  }
  slidePositions.sort((a, b) => a - b);
  const slideRanges: ReextractSlideRange[] = [];
  for (const position of slidePositions) {
    const last = slideRanges[slideRanges.length - 1];
    if (last && position === last.to + 1) last.to = position;
    else slideRanges.push({ from: position, to: position });
  }
  return { coverMissing, slideRanges, overCapCount, failedCount: slidePositions.length + (coverMissing ? 1 : 0) };
}

/** The copy keys (`ReextractPreview` namespace) of the banner's cause sentences. */
export const REEXTRACT_BANNER_CAUSES = [
  "causeExpiredRefreshFailed",
  "causeNotHealed",
  "causeRefreshRunning",
  "causeCooldown",
  "causeNotScraped",
  "causePostGone",
  "causeInFlight",
  "causeTimedOut",
  "causeNoProvider",
  "causeOverQuota",
  "causeImagesUnavailable",
] as const;
export type ReextractBannerCause = (typeof REEXTRACT_BANNER_CAUSES)[number];

/** What the banner reads of a job's refresh report. `images` is empty on a job finished before Story 10.6a. */
export interface ReextractBannerInput {
  outcome: ReextractRefreshOutcome;
  saved: boolean;
  lateResultPending: boolean;
  expiredLinks: number;
  images: readonly ReextractImageEntry[];
  imagesAvailable: number;
  imagesRead: number;
}

/**
 * The cause sentences of the banner, in order (copy-keys.md section 3): a refresh that is still running, or the outcome's own
 * sentence (no provider reached comes with "the links have expired and refreshing them failed" when links expired), the "provider
 * answered but nothing healed" sentence, and, when none of those explains the shortfall, "some images could not be loaded".
 */
export function pickReextractBannerCauses(report: ReextractBannerInput): ReextractBannerCause[] {
  if (report.lateResultPending) return ["causeRefreshRunning"];
  switch (report.outcome) {
    case "NO_PROVIDER_REACHABLE":
      return report.expiredLinks > 0 ? ["causeNoProvider", "causeExpiredRefreshFailed"] : ["causeNoProvider"];
    case "PROVIDER_OVER_QUOTA":
      return ["causeOverQuota"];
    case "TIMED_OUT":
      return ["causeTimedOut"];
    case "COOLDOWN":
      return ["causeCooldown"];
    case "NOT_SCRAPED":
      return ["causeNotScraped"];
    case "POST_UNAVAILABLE":
      return ["causePostGone"];
    case "IN_FLIGHT":
      return ["causeInFlight"];
    default:
      break;
  }
  if (report.outcome === "REFRESHED" && !report.saved && report.expiredLinks > 0) return ["causeNotHealed"];
  const failedImages =
    report.images.length > 0 ? report.images.some((image) => image.state === "NOT_READ_EXPIRED" || image.state === "NOT_READ_UNAVAILABLE") : report.imagesRead < report.imagesAvailable;
  return failedImages ? ["causeImagesUnavailable"] : [];
}
