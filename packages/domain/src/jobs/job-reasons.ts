// Story 10.4 (Part A; PRD 4.21 `JobReasonCode`, FR117, FR123) -- the boundary mappings of the Jobs read API: which reasons a user may
// see, and the spelling of a vendor. The engine's own endings never reach a user as a cause.

/** The user-safe reasons (the GraphQL `JobReasonCode`). `GENERIC` is what every engine-internal or unknown ending reads as. */
export const USER_SAFE_JOB_REASON_CODES = [
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_PRIVATE",
  "NO_PROVIDER_REACHABLE",
  "PROVIDER_OVER_QUOTA",
  "ACCOUNT_TYPE_NOT_SCRAPED",
  "POST_UNAVAILABLE",
  "COOLDOWN",
  "TIMED_OUT",
  "CANCELLED",
  "WAITED_TOO_LONG",
  "SOME_POSTS_NOT_EXTRACTED",
  "REFRESH_IN_PROGRESS",
  "REFRESH_DID_NOT_HEAL_IMAGES",
  "POST_NOT_FOUND",
  "CHAIN_IN_FLIGHT",
  "QUOTA_EXHAUSTED",
  "EXTRACTION_FAILED",
  "VENDOR_RUN_FAILED",
  "GENERIC",
] as const;
export type UserSafeJobReasonCode = (typeof USER_SAFE_JOB_REASON_CODES)[number];

/**
 * The engine-internal endings (Story 10.1a): the job's code threw, no handler, a hand-off that did not happen, it could not be started,
 * an ending with no reason. They are listed here only so a test can pin that each reads as `GENERIC`; any code not in the user-safe list does.
 */
export const ENGINE_INTERNAL_JOB_REASON_CODES = ["HANDLER_ERROR", "HANDLER_NOT_REGISTERED", "HANDOFF_MISSING", "START_FAILED", "UNSPECIFIED"] as const;

const USER_SAFE = new Set<string>(USER_SAFE_JOB_REASON_CODES);

/** The reason a user sees for the engine's stored code: null when there is none, the same code when it is user-safe, else `GENERIC`. */
export function mapJobReasonCode(code: string | null | undefined): UserSafeJobReasonCode | null {
  if (code === null || code === undefined || code === "") {
    return null;
  }
  return USER_SAFE.has(code) ? (code as UserSafeJobReasonCode) : "GENERIC";
}

export type UserSafeJobProvider = "APIFY" | "BRIGHT_DATA";

/** The PRD's spelling of a vendor (`BRIGHT_DATA`); the table's enum says `BRIGHTDATA`. Moderators only. */
export function userSafeJobProvider(provider: "APIFY" | "BRIGHTDATA"): UserSafeJobProvider {
  return provider === "BRIGHTDATA" ? "BRIGHT_DATA" : "APIFY";
}
