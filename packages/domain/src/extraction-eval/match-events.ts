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
 * Pass 1: same normalized name. Pass 2: same earliest start date, for the labelled events still unmatched
 * (the model renamed them slightly). Each model event is used at most once.
 */
export function matchEvents(labelled: LabelledEvent[], model: ScorableEvent[]): EventMatching {
  const usedModel = new Set<number>();
  const matchOfLabelled = new Map<number, number>();

  labelled.forEach((event, li) => {
    const name = normalizeText(event.eventName);
    const mi = model.findIndex((m, i) => !usedModel.has(i) && normalizeText(m.eventName) === name);
    if (mi !== -1) {
      usedModel.add(mi);
      matchOfLabelled.set(li, mi);
    }
  });
  labelled.forEach((event, li) => {
    if (matchOfLabelled.has(li)) return;
    const start = earliestStart(event.schedules);
    if (start === '') return;
    const mi = model.findIndex((m, i) => !usedModel.has(i) && earliestStart(m.schedules) === start);
    if (mi !== -1) {
      usedModel.add(mi);
      matchOfLabelled.set(li, mi);
    }
  });

  return {
    matches: [...matchOfLabelled.entries()].map(([l, m]) => ({ labelled: l, model: m })),
    unmatchedLabelled: labelled.map((_, i) => i).filter((i) => !matchOfLabelled.has(i)),
    extraModel: model.map((_, i) => i).filter((i) => !usedModel.has(i)),
  };
}
