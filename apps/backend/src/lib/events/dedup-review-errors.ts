/**
 * Errors of the dedup review export whose messages are fixed text and safe to print in a public
 * Actions log. Kept in their own file, with no database import, so the CLI can recognise them
 * without loading the database client.
 */

/** The database role cannot see every row, so the export would pass for an empty queue. */
export class DedupReviewRoleError extends Error {}

/** The invoker hash matches no single active moderator. One message for zero, two or a non-moderator, so a public log cannot be used to probe who is a moderator. */
export class DedupReviewInvokerError extends Error {}

/** What a run says when it holds a reject and the owner has not switched rejects on. Fixed text: no value of the run is in it. */
export const REJECTS_DISABLED_MESSAGE = 'Rejects are switched off. The owner turns them on with the variable DEDUP_REVIEW_REJECT_ENABLED of the dedup-review-live environment.';

/** A run holds a reject while the owner's reject switch (`DEDUP_REVIEW_REJECT_ENABLED`) is off: nothing was read or changed. */
export class DedupReviewRejectsDisabledError extends Error {}

/**
 * A live run committed its merges or rejects but its report could not be written (a closed pipe), so the caller must not
 * read the exit code as "nothing happened". The message names where each kind is found: merges in the journal, rejects only
 * on the suggestion rows. Reopening a reject is the owner's SQL in the runbook, never a string in code.
 */
export class DedupReviewReportLostError extends Error {
  constructor(
    readonly merged: number,
    readonly rejected: number = 0
  ) {
    super(
      `The run finished and committed ${merged} merge(s) and ${rejected} reject(s), but its report could not be written. Do not run it again for these decisions: look for event_merges rows with performed_via = 'ai_skill' to find and, if needed, undo the merges, and for event_match_candidates rows with status = 'rejected' and resolved_via = 'ai_skill' for the rejects (the runbook says how the owner reopens one).`
    );
  }
}
