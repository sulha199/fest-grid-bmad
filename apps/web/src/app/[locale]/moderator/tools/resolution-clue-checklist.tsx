'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@festgrid/ui';
import {
  DEDUP_DECISION_CLUES,
  DEDUP_DECISION_CLUE_GROUPS,
  DEDUP_DECISION_NOTE_MAX_LENGTH,
  type DedupDecisionClue,
} from '@festgrid/domain/events';

/**
 * The "why" of a merge or a reject (spec-dedup-decision-clues): the closed list of clue codes as checkboxes, and an
 * optional note. Both are optional. Once one code of an exclusive group is ticked the rest of that group is
 * disabled, so a contradictory pair cannot be sent (the server refuses it too). The note is the moderator's own
 * words and goes only to the mutation: it is never sent to analytics or written to the console.
 */
export function ResolutionClueChecklist({
  clues,
  note,
  onCluesChange,
  onNoteChange,
  disabled = false,
}: {
  clues: DedupDecisionClue[];
  note: string;
  onCluesChange: (next: DedupDecisionClue[]) => void;
  onNoteChange: (next: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('DuplicateEventsPage');

  const toggle = (code: DedupDecisionClue, checked: boolean) => {
    onCluesChange(checked ? DEDUP_DECISION_CLUES.filter((c) => c === code || clues.includes(c)) : clues.filter((c) => c !== code));
  };

  const isBlockedByGroup = (code: DedupDecisionClue) => {
    const group = DEDUP_DECISION_CLUE_GROUPS.find((g) => g.includes(code));
    return group !== undefined && group.some((other) => other !== code && clues.includes(other));
  };

  return (
    <div className="mt-4 space-y-3 text-left">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium">{t('clueHeading')}</legend>
        <p className="text-xs text-muted-foreground">{t('clueHint')}</p>
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {DEDUP_DECISION_CLUES.map((code) => (
            <Checkbox
              key={code}
              id={`resolution-clue-${code}`}
              label={t(`clues.${code}`)}
              checked={clues.includes(code)}
              disabled={disabled || isBlockedByGroup(code)}
              onChange={(checked) => toggle(code, checked)}
            />
          ))}
        </div>
      </fieldset>
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
