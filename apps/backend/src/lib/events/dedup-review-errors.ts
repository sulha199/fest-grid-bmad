/**
 * Errors of the dedup review export whose messages are fixed text and safe to print in a public
 * Actions log. Kept in their own file, with no database import, so the CLI can recognise them
 * without loading the database client.
 */

/** The database role cannot see every row, so the export would pass for an empty queue. */
export class DedupReviewRoleError extends Error {}

/** `DEDUP_REVIEW_MODERATOR_EMAIL` is set but names no active moderator. The message never holds the address. */
export class DedupReviewReviewerError extends Error {}
