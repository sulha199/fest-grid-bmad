"use client";

import * as React from 'react';
import { RadioGroup, RadioGroupItem } from '../../core/ui/radio-group';
import { cn } from '../../lib/utils';
import { TemporalFilterToggleProps, TemporalFilterValue } from './TemporalFilterToggle.types';

// Radix's RadioGroup.Item requires a non-empty string `value`, so the component's own
// `null`-means-All contract is mapped to this sentinel at the Radix boundary only (Task 5).
const ALL_SENTINEL = 'ALL';

// DESIGN.md's components.temporal_filter tokens, applied verbatim (Story 0.i5d, AC6).
const BASE_CLASS =
  'inline-flex items-center rounded-md border border-gray-200 p-0.5 gap-0.5 w-full sm:w-auto';
const OPTION_CLASS =
  'flex-1 sm:flex-none min-h-11 px-3 py-1.5 rounded text-sm font-medium text-center transition-colors';
const OPTION_ACTIVE_CLASS = 'bg-violet-600 text-white';
const OPTION_INACTIVE_CLASS = 'text-gray-600 hover:bg-gray-100';

/**
 * Segmented Today / Upcoming / All temporal filter toggle (IDEA-019, AD-20). Built on the
 * Radix-backed `radio-group.tsx` primitive so `role="radiogroup"`/`role="radio"`/roving-tabindex
 * semantics come for free (Gate 2's flagged item, resolved directly in this story's scope rather
 * than a hand-rolled keydown handler).
 */
export function TemporalFilterToggle({ value, onChange, labels, className = '' }: TemporalFilterToggleProps) {
  const radixValue = value ?? ALL_SENTINEL;

  const handleValueChange = (next: string) => {
    onChange((next === ALL_SENTINEL ? null : next) as TemporalFilterValue);
  };

  const options: { value: string; label: string }[] = [
    { value: 'TODAY', label: labels.today },
    { value: 'UPCOMING', label: labels.upcoming },
    { value: ALL_SENTINEL, label: labels.all },
  ];

  return (
    <RadioGroup
      value={radixValue}
      onValueChange={handleValueChange}
      aria-label={labels.groupLabel}
      className={cn(BASE_CLASS, className)}
    >
      {options.map((option) => {
        const isActive = option.value === radixValue;
        return (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            className={cn(OPTION_CLASS, isActive ? OPTION_ACTIVE_CLASS : OPTION_INACTIVE_CLASS)}
          >
            {option.label}
          </RadioGroupItem>
        );
      })}
    </RadioGroup>
  );
}
