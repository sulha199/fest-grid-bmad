/**
 * Why a dedup suggestion was merged or rejected: a closed list of clue codes plus an optional short note
 * (`_bmad-output/implementation-artifacts/spec-dedup-decision-clues.md`).
 *
 * Pure and dependency-free: the database column is plain `text[]` (a new clue is a code change, never a
 * migration), and the one definition lives here so the apply bridge, the moderator mutation and the web checklist
 * cannot drift. The skill's reader holds a copy of the list that a test pins to this file.
 *
 * Clue codes are the only part of a decision that may appear in a log, issue, report or Actions output. The note
 * is free text a moderator typed while looking at untrusted event text: it is stored and never printed, and the
 * errors below never echo a value.
 */

export const DEDUP_DECISION_CLUES = [
  'same-venue',
  'different-venue',
  'same-organizer',
  'different-organizer',
  'same-date',
  'date-drift',
  'date-too-far',
  'shared-link',
  'same-name-words',
  'different-name-words',
  'name-translation-or-abbreviation',
  'registration-vs-event-day',
  'different-category-or-tier',
  'part-of-larger-event-or-session',
  'recurring-not-same-occurrence',
  'not-an-event',
  'other',
] as const;

export type DedupDecisionClue = (typeof DEDUP_DECISION_CLUES)[number];

/** Codes of one group contradict each other: at most one of each group may be chosen. `other` is in no group. */
export const DEDUP_DECISION_CLUE_GROUPS: readonly (readonly DedupDecisionClue[])[] = [
  ['same-venue', 'different-venue'],
  ['same-organizer', 'different-organizer'],
  ['same-date', 'date-drift', 'date-too-far'],
  ['same-name-words', 'different-name-words', 'name-translation-or-abbreviation'],
];

/** Longest note, in characters, after trimming. */
export const DEDUP_DECISION_NOTE_MAX_LENGTH = 200;

/** A bad clue list or note. The message names the field and never echoes a value. */
export class DedupDecisionClueError extends Error {}

const KNOWN: ReadonlySet<unknown> = new Set(DEDUP_DECISION_CLUES);

/**
 * The clue codes of a decision, in the list's own order (so a stored value does not depend on the order a client
 * sent). Omitted, `null` and an empty list all mean "none recorded" and give `null`. Anything else that is not an
 * array of distinct known codes with at most one per exclusive group throws.
 */
export function parseDedupDecisionClues(value: unknown): DedupDecisionClue[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new DedupDecisionClueError('clues must be a list of clue codes');
  if (value.length === 0) return null;
  if (value.length > DEDUP_DECISION_CLUES.length || value.some((code) => !KNOWN.has(code))) {
    throw new DedupDecisionClueError('clues must be known clue codes');
  }
  if (new Set(value).size !== value.length) throw new DedupDecisionClueError('a clue may be listed only once');
  const chosen = new Set<unknown>(value);
  for (const group of DEDUP_DECISION_CLUE_GROUPS) {
    if (group.filter((code) => chosen.has(code)).length > 1) {
      throw new DedupDecisionClueError('clues contradict each other');
    }
  }
  return DEDUP_DECISION_CLUES.filter((code) => chosen.has(code));
}

/**
 * The note of a decision, trimmed. Omitted, `null`, empty and blank all mean "no note" and give `null`. A value
 * that is not a string, holds a NUL character (Postgres text cannot) or is longer than the limit throws.
 */
export function parseDedupDecisionNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DedupDecisionClueError('the note must be text');
  const note = value.trim();
  if (note.includes('\u0000')) throw new DedupDecisionClueError('the note holds a character that cannot be stored');
  if (note.length > DEDUP_DECISION_NOTE_MAX_LENGTH) {
    throw new DedupDecisionClueError(`the note must be at most ${DEDUP_DECISION_NOTE_MAX_LENGTH} characters`);
  }
  return note === '' ? null : note;
}
