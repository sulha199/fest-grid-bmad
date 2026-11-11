import { normalizeDate, normalizeText } from './normalize.js';
import type { LabelledEvent, ScorableEvent } from './types.js';

export interface EventMatch {
  /** Index of the labelled event. */
  labelled: number;
  /** Index of the model event. */
  model: number;
}

export interface EventMatching {
  matches: EventMatch[];
  unmatchedLabelled: number[];
  extraModel: number[];
}

function earliestStart(schedules: Array<{ eventStartDate?: string }> | undefined): string {
  const dates = (schedules ?? []).map((s) => normalizeDate(s.eventStartDate)).filter(Boolean).sort();
  return dates[0] ?? '';
}

/**
 * Pass 1: same normalized name AND same earliest start date, so two events of one name (a workshop on 05-01 and another
 * on 05-02) are paired with the right counterpart whatever order the model returns them in. Pass 2: same normalized
 * name alone, for what is left (the model got the date wrong). Pass 3: same earliest start date alone, for the labelled
 * events still unmatched (the model renamed them slightly). Each model event is used at most once.
 */
export function matchEvents(labelled: LabelledEvent[], model: ScorableEvent[]): EventMatching {
  const usedModel = new Set<number>();
  const matchOfLabelled = new Map<number, number>();

  const pass = (accepts: (event: LabelledEvent, candidate: ScorableEvent) => boolean): void => {
    labelled.forEach((event, li) => {
      if (matchOfLabelled.has(li)) return;
      const mi = model.findIndex((m, i) => !usedModel.has(i) && accepts(event, m));
      if (mi !== -1) {
        usedModel.add(mi);
        matchOfLabelled.set(li, mi);
      }
    });
  };
  const sameName = (event: LabelledEvent, m: ScorableEvent): boolean => normalizeText(m.eventName) === normalizeText(event.eventName);
  const sameStart = (event: LabelledEvent, m: ScorableEvent): boolean => {
    const start = earliestStart(event.schedules);
    return start !== '' && earliestStart(m.schedules) === start;
  };
  pass((event, m) => sameName(event, m) && sameStart(event, m));
  pass(sameName);
  pass(sameStart);

  return {
    matches: [...matchOfLabelled.entries()].map(([l, m]) => ({ labelled: l, model: m })),
    unmatchedLabelled: labelled.map((_, i) => i).filter((i) => !matchOfLabelled.has(i)),
    extraModel: model.map((_, i) => i).filter((i) => !usedModel.has(i)),
  };
}
