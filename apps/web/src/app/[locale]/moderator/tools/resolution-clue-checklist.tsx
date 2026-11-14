'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@festgrid/ui';
import { DEDUP_DECISION_CLUES, DEDUP_DECISION_NOTE_MAX_LENGTH, type DedupDecisionClue } from '@festgrid/domain/events';

/**
 * The "why" of a merge or a reject (spec-dedup-decision-clues): the closed list of clue codes and an optional note. Both
 * are optional.
 *
 * The four aspects that come in contradicting pairs (venue, organizer, date, name) are one row each with a toggle per
 * answer, "Same" or "Different" and so on, and the two events' own values beside it ("Existing: Jalan Pramuka, New:
 * Jalan Pahlawan"); a second click on the chosen answer clears it, and choosing another replaces it, so a contradicting
 * pair cannot be sent (the server refuses it too). Every other reason is a checkbox, listed with the reasons that suit
 * the decision first. The note is the moderator's own words and goes only to the mutation: never to analytics or the
 * console.
 */

export interface ClueEventFacts {
  name: string;
  location?: string | null;
  /** The main schedule's start date, `YYYY-MM-DD`. */
  startDate?: string | null;
}

/** The aspects, in display order, and the codes each can take (a venue is the same or different, and so on). */
export const CLUE_ASPECTS: ReadonlyArray<{ key: 'venue' | 'organizer' | 'date' | 'name'; codes: readonly DedupDecisionClue[] }> = [
  { key: 'venue', codes: ['same-venue', 'different-venue'] },
  { key: 'organizer', codes: ['same-organizer', 'different-organizer'] },
  { key: 'date', codes: ['same-date', 'date-drift', 'date-too-far'] },
  { key: 'name', codes: ['same-name-words', 'different-name-words', 'name-translation-or-abbreviation'] },
];

/** The other reasons, most useful first for each decision: a merge starts from what makes two posts one event, a reject from what keeps them apart. */
export const CLUE_REASONS: Record<'accept' | 'reject', readonly DedupDecisionClue[]> = {
  accept: ['shared-link', 'registration-vs-event-day', 'part-of-larger-event-or-session', 'recurring-not-same-occurrence', 'different-category-or-tier', 'not-an-event', 'other'],
  reject: ['recurring-not-same-occurrence', 'different-category-or-tier', 'part-of-larger-event-or-session', 'not-an-event', 'registration-vs-event-day', 'shared-link', 'other'],
};

const DAY_MS = 86_400_000;

/** Whole days between two `YYYY-MM-DD` dates, or null when either is missing or not a date. */
export function dayGap(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  return Number.isNaN(first) || Number.isNaN(second) ? null : Math.round(Math.abs(first - second) / DAY_MS);
}

export function ResolutionClueChecklist({
  decision,
  existing,
  incoming,
  clues,
  note,
  onCluesChange,
  onNoteChange,
  disabled = false,
}: {
  decision: 'accept' | 'reject';
  existing: ClueEventFacts;
  incoming: ClueEventFacts;
  clues: DedupDecisionClue[];
  note: string;
  onCluesChange: (next: DedupDecisionClue[]) => void;
  onNoteChange: (next: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('DuplicateEventsPage');
  const none = '-';
  const pair = (a?: string | null, b?: string | null) => t('clueValues', { existing: a || none, incoming: b || none });

  const hints: Record<'venue' | 'organizer' | 'date' | 'name', string | null> = {
    venue: pair(existing.location, incoming.location),
    organizer: null,
    date: (() => {
      const gap = dayGap(existing.startDate, incoming.startDate);
      return `${pair(existing.startDate, incoming.startDate)}${gap === null ? '' : ` (${t('clueDayGap', { days: gap })})`}`;
    })(),
    name: pair(existing.name, incoming.name),
  };

  const choose = (codes: readonly DedupDecisionClue[], code: DedupDecisionClue) => {
    const rest = clues.filter((c) => !codes.includes(c));
    onCluesChange(clues.includes(code) ? rest : DEDUP_DECISION_CLUES.filter((c) => c === code || rest.includes(c)));
  };

  const toggleReason = (code: DedupDecisionClue, checked: boolean) => {
    onCluesChange(checked ? DEDUP_DECISION_CLUES.filter((c) => c === code || clues.includes(c)) : clues.filter((c) => c !== code));
  };

  return (
    <div className="mt-4 space-y-3 text-left">
      <p className="text-sm font-medium">{t('clueHeading')}</p>
      <p className="text-xs text-muted-foreground">{t('clueHint')}</p>
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {CLUE_ASPECTS.map(({ key, codes }) => {
          const labelId = `resolution-aspect-${key}`;
          return (
            <div key={key} className="space-y-1">
              <p id={labelId} className="text-sm font-medium">
                {t(`clueAspects.${key}`)}
              </p>
              {hints[key] && <p className="text-xs text-muted-foreground">{hints[key]}</p>}
              <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
                {codes.map((code) => {
                  const pressed = clues.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={pressed}
                      aria-label={t(`clues.${code}`)}
                      disabled={disabled}
                      onClick={() => choose(codes, code)}
                      className={`rounded-md border px-3 py-1 text-sm ${pressed ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}
                    >
                      {t(`clueShort.${code}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium">{t('clueReasonsHeading')}</legend>
          {CLUE_REASONS[decision].map((code) => (
            <Checkbox
              key={code}
              id={`resolution-clue-${code}`}
              label={t(`clues.${code}`)}
              checked={clues.includes(code)}
              disabled={disabled}
              onChange={(checked) => toggleReason(code, checked)}
            />
          ))}
        </fieldset>
      </div>
      <div className="space-y-1">
        <label htmlFor="resolution-note" className="text-sm font-medium">
          {t('noteLabel')}
        </label>
        <textarea
          id="resolution-note"
          value={note}
          maxLength={DEDUP_DECISION_NOTE_MAX_LENGTH}
          rows={2}
          disabled={disabled}
          onChange={(event) => onNoteChange(event.target.value)}
          className="w-full rounded-md border bg-background p-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">{t('noteCounter', { count: note.length, max: DEDUP_DECISION_NOTE_MAX_LENGTH })}</p>
      </div>
    </div>
  );
}
