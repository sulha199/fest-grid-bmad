"use client";

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CalendarRangeFilterValue {
  /** Show schedules whose (occurrence) run starts inside the context. */
  start: boolean;
  /** Show schedules whose (occurrence) run ends inside the context. */
  end: boolean;
}

export interface CalendarRangeFilterToggleLabels {
  /** Accessible group label. */
  groupLabel: string;
  /** "Starts this week" — shown from the md breakpoint up, where the context is the displayed week. */
  startsWeek: string;
  endsWeek: string;
  /** "Starts this day" — shown below md, where the context is the displayed day. */
  startsDay: string;
  endsDay: string;
}

export interface CalendarRangeFilterToggleProps {
  value: CalendarRangeFilterValue;
  onChange: (value: CalendarRangeFilterValue) => void;
  labels: CalendarRangeFilterToggleLabels;
  className?: string;
}

// Same segmented-control tokens as `TemporalFilterToggle` (DESIGN.md components.temporal_filter), so
// the two read as one family and share its responsiveness: full width on mobile, content width from `sm`.
const BASE_CLASS =
  'inline-flex items-center rounded-md border border-gray-200 p-0.5 gap-0.5 w-full sm:w-auto';
const OPTION_CLASS =
  'flex-1 sm:flex-none min-h-11 px-3 py-1.5 rounded text-sm font-medium text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
const OPTION_ACTIVE_CLASS = 'bg-violet-600 text-white';
const OPTION_INACTIVE_CLASS = 'text-gray-600 hover:bg-gray-100';

/**
 * Two independent toggles — "Starts [context]" and "Ends [context]" — where the context is the
 * displayed week on desktop and the displayed day on mobile. Neither, one, or both can be on; with
 * neither on the calendar is unfiltered. Unlike `TemporalFilterToggle` this is multi-select, so it is
 * a `role="group"` of `aria-pressed` buttons rather than a radio group.
 */
export function CalendarRangeFilterToggle({ value, onChange, labels, className = '' }: CalendarRangeFilterToggleProps) {
  const options = [
    { key: 'start' as const, week: labels.startsWeek, day: labels.startsDay },
    { key: 'end' as const, week: labels.endsWeek, day: labels.endsDay },
  ];

  return (
    <div role="group" aria-label={labels.groupLabel} className={cn(BASE_CLASS, className)} data-testid="calendar-range-filter">
      {options.map((option) => {
        const isActive = value[option.key];
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            data-testid={`calendar-range-filter-${option.key}`}
            className={cn(OPTION_CLASS, isActive ? OPTION_ACTIVE_CLASS : OPTION_INACTIVE_CLASS)}
            onClick={() => onChange({ ...value, [option.key]: !isActive })}
          >
            <span className="hidden md:inline">{option.week}</span>
            <span className="md:hidden">{option.day}</span>
          </button>
        );
      })}
    </div>
  );
}
