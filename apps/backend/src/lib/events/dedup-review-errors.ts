/**
 * Errors of the dedup review export whose messages are fixed text and safe to print in a public
 * Actions log. Kept in their own file, with no database import, so the CLI can recognise them
 * without loading the database client.
 */

/** The database role cannot see every row, so the export would pass for an empty queue. */
export class DedupReviewRoleError extends Error {}

/** The invoker hash matches no single active moderator. One message for zero, two or a non-moderator, so a public log cannot be used to probe who is a moderator. */
export class DedupReviewInvokerError extends Error {}
