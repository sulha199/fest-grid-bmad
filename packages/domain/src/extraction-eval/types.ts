/** Fields scored per post and per run. Order is the report order. */
export const EXTRACTION_EVAL_FIELDS = [
  'groupingReason',
  'eventCount',
  'eventName',
  'startDate',
  'endDate',
  'startTime',
  'endTime',
  'location',
  'ticket',
  'categoriesPrecision',
  'categoriesRecall',
  'performers',
] as const;
export type ExtractionEvalField = (typeof EXTRACTION_EVAL_FIELDS)[number];

/** A score in [0, 1], or null when the label does not ask for that field (not applicable). */
export type FieldScores = Record<ExtractionEvalField, number | null>;

export interface LabelledSchedule {
  eventStartDate: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  location?: string;
}

export interface LabelledEvent {
  eventName: string;
  schedules: LabelledSchedule[];
  location?: string;
  /** Digits are compared, so "Rp 150.000" and "150000" agree. */
  ticketPrice?: string;
  free?: boolean;
  categories?: string[];
  performers?: string[];
}

/** One hand-verified post. Synthetic or private data only: never real captions or contact data in this public repo. */
export interface LabelledPost {
  postId: string;
  caption: string;
  /** File names relative to the post's own folder; the runner reads and inlines them. */
  images: string[];
  publishedAt: string;
  ownerUsername?: string;
  /** Empty `events` means the post is not an event. */
  groupingReason?: string;
  events: LabelledEvent[];
}

/** The slice of the production extraction payload the scorer reads (already validated and normalized). */
export interface ScorableSchedule {
  eventStartDate?: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  location?: string;
  ticketPrice?: string;
  performers?: string[];
}
export interface ScorableEvent {
  eventName?: string;
  categories?: string[];
  location?: string;
  schedules?: ScorableSchedule[];
}
export interface ScorablePayload {
  isEvent?: boolean;
  groupingReason?: string | null;
  events?: ScorableEvent[];
}

export interface RecordedRun {
  postId: string;
  runIndex: number;
  /** Raw model text; absent when the call never answered. */
  text?: string;
  finishReason?: string;
  /** 429/503 after the retry cap. */
  unavailable?: boolean;
}

export interface RecordedOutputs {
  model: string;
  promptHash: string;
  recordedAt: string;
  runs: RecordedRun[];
}

export type RunOutcome = 'ok' | 'truncated' | 'unavailable';

export interface RunScore {
  fields: FieldScores;
  /** Model event count differs from the labelled count (split vs fold). */
  countMismatch: boolean;
  /** Labelled events the model did not produce (each counts once as an `eventName` miss). */
  missing: MissingEvent[];
  /** Model events that matched no labelled event: reported, not scored. */
  extras: ExtraEvent[];
}

/** A labelled event with no model counterpart in one run. `index` is its position in the label (0-based). */
export interface MissingEvent {
  index: number;
  name: string;
}

/** A model event that matched no labelled event in one run. */
export interface ExtraEvent {
  name: string;
}

/** Over the answered runs of a post: in how many runs a labelled event was missing. */
export interface MissingEventTally extends MissingEvent {
  runs: number;
}

/** Over the answered runs of a post: in how many runs a model event of this name was extra. */
export interface ExtraEventTally extends ExtraEvent {
  runs: number;
}

export interface RunResult {
  postId: string;
  runIndex: number;
  outcome: RunOutcome;
  score?: RunScore;
}

export interface PostAggregate {
  /** Pass-rate per field over the runs that answered; null when never applicable. */
  fields: FieldScores;
  okRuns: number;
  truncatedRuns: number;
  unavailableRuns: number;
  countMismatchRuns: number;
  /** count_mismatch detail the per-field rates do not show: labelled events never matched, and extra model events. */
  missing: MissingEventTally[];
  extras: ExtraEventTally[];
  /** Per-run field scores (answered runs only), in run order. Used for the noise band. */
  runFields: FieldScores[];
  /** The real run index of each entry of `runFields`, so runs of different posts can be lined up. */
  runIndexes: number[];
}

export interface Aggregate {
  posts: Record<string, PostAggregate>;
  /** Mean of the post pass-rates; null when no post applies. */
  fields: FieldScores;
  /** Per run index, the mean over posts: its spread is the noise. */
  fieldRunMeans: Record<ExtractionEvalField, number[]>;
  /** How many different run numbers the results hold (the repeats per post). Below 2 there is no spread to measure. */
  runCount: number;
  totals: { ok: number; truncated: number; unavailable: number; countMismatch: number };
}

export interface Baseline {
  model: string;
  promptHash: string;
  date: string;
  runs: number;
  fields: FieldScores;
  posts: Record<string, FieldScores>;
  /** Share of answered runs that were truncated or invalid; absent in baselines written before it was recorded. */
  truncatedRate?: number;
}

/**
 * ok, flagged (fell beyond the noise band), improved, new (field or comparison absent from the baseline), no_data, and
 * single_run: it fell beyond the band, but with one run per post the spread is 0 and a drop cannot be told from noise.
 */
export type FieldStatus = 'ok' | 'flagged' | 'improved' | 'new' | 'no_data' | 'single_run';

export interface FieldComparison {
  field: ExtractionEvalField;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  band: number;
  status: FieldStatus;
  changedPosts: Array<{ postId: string; baseline: number; current: number }>;
}

export type TruncatedStatus = 'ok' | 'flagged' | 'no_baseline' | 'no_data';

/** The share of answered runs that were truncated or invalid, against the baseline's: output validity is not a field. */
export interface TruncatedComparison {
  current: number | null;
  baseline: number | null;
  delta: number | null;
  status: TruncatedStatus;
}

export interface Comparison {
  fields: FieldComparison[];
  /** Posts in this run but not in the baseline: reported, not compared. */
  newPosts: string[];
  /** Posts in the baseline but not in this run: reported, not compared. */
  removedPosts: string[];
  /** Posts in both: the only ones whose pass-rates are compared, so a post added or dropped cannot move a field. */
  comparedPosts: string[];
  truncatedRate: TruncatedComparison;
}
