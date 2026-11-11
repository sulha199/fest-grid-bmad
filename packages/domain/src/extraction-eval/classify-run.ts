import { scoreRun } from './score-run.js';
import type { LabelledPost, RecordedRun, RunResult, ScorablePayload } from './types.js';

/**
 * Turn one recorded model answer into a run result.
 * `parse` is the pipeline's own post-answer step (JSON parse, malformed-keyword strip, schema validation); it
 * returns undefined for an unusable answer. A cut-off answer (MAX_TOKENS) or unusable JSON is `truncated`; an
 * answer that never came (429/503 after the retry cap, or no text at all with no finish reason) is `unavailable`.
 * Neither is ever scored as a wrong field.
 */
export function classifyRun(post: LabelledPost, run: RecordedRun, parse: (text: string) => ScorablePayload | undefined): RunResult {
  const base = { postId: run.postId, runIndex: run.runIndex };
  if (run.unavailable === true || run.text === undefined) return { ...base, outcome: 'unavailable' };
  if (run.finishReason === 'MAX_TOKENS') return { ...base, outcome: 'truncated' };
  const payload = parse(run.text);
  if (payload === undefined) return { ...base, outcome: 'truncated' };
  return { ...base, outcome: 'ok', score: scoreRun(post, payload) };
}
