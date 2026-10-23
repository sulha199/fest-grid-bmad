import type { EventType, EventCategory } from '@festgrid/shared-types';
import { EventFilterInput, type DayOfWeek } from '../events/buildEventsQueryCondition.js';
import {
  formatAccountIdClause,
  formatCategoriesClause,
  formatDateRangeClause,
  formatDayOfWeekClause,
  formatIsFreeClause,
  formatKeywordClause,
  formatLocationAdminAreaClause,
  formatLocationProximityClause,
  formatTemporalFilterClause,
  formatTypesClause,
  formatVenueTypeClause,
  joinCaveats,
} from './summary-clause-formatters.js';

export interface AIFilterSummaryLabels {
  noFilter: string;
  accountIdPrefix?: string;
  accountIdTemplate?: string;
  types?: Record<string, string>;
  typeSeparator?: string;
  typesPrefix?: string;
  categories?: Record<string, string>;
  categorySeparator?: string;
  categoriesPrefix?: string;
  keywordPrefix?: string;
  keywordTemplate?: string;
  anchors?: Record<string, string>;
  units?: Record<string, string>;
  /** Singular unit words for an amount of exactly 1 ("1 week", not "1 weeks"); falls back to `units`. */
  unitsSingular?: Record<string, string>;
  /** Wording for TODAY + a 1-month span, which really runs to the end of the current month. */
  restOfMonth?: string;
  dateRangeTemplate?: string;
  daysOfWeek?: Record<string, string>;
  adminAreaPrefix?: string;
  adminAreaTemplate?: string;
  nearMe?: string;
  nearMeWithRadiusPrefix?: string;
  nearMeWithRadiusTemplate?: string;
  venueTypePrefix?: string;
  venueTypeTemplate?: string;
  freeEventsOnly?: string;
  paidEventsOnly?: string;
  caveatPrefix?: string;
  caveatSeparator?: string;
  or?: string;
  weekends?: string;
  weekdays?: string;
  temporalStatus?: Record<string, string>;
  dateRangeSpanOnlyTemplate?: string;
  dateRangeSpanExtensionTemplate?: string;
}

export interface AIFilterSummaryResult {
  summary: string;
  caveatsText?: string;
}

export function renderAIFilterSummary(
  filter: EventFilterInput | null | undefined,
  caveats: string[] | null | undefined,
  labels: AIFilterSummaryLabels
): AIFilterSummaryResult {
  if (!filter) {
    filter = {};
  }
  const clauses: string[] = [];

  if (filter.accountId && filter.accountId.trim() !== '') {
    clauses.push(formatAccountIdClause(filter.accountId, labels));
  }

  if (filter.types && filter.types.length > 0) {
    clauses.push(formatTypesClause(filter.types as EventType[], labels));
  }

  if (filter.categories && filter.categories.length > 0) {
    clauses.push(formatCategoriesClause(filter.categories as EventCategory[], labels));
  }

  if (filter.keyword && filter.keyword.trim() !== '') {
    clauses.push(formatKeywordClause(filter.keyword, labels));
  }

  // `dateRange` and `dayOfWeek` are applied together (the weekdays within the window -- "this
  // weekend" is THIS_WEEK + [SAT, SUN]), so both must be shown; printing only the date range reads
  // as "this week" and hides the weekday narrowing the query really applies.
  if (filter.dateRange && filter.dayOfWeek) {
    clauses.push(
      `${formatDateRangeClause(filter.dateRange, labels)}, ${formatDayOfWeekClause(filter.dayOfWeek as DayOfWeek[] | DayOfWeek | string, labels)}`
    );
  } else if (filter.dateRange) {
    clauses.push(formatDateRangeClause(filter.dateRange, labels));
  } else if (filter.dayOfWeek) {
    clauses.push(formatDayOfWeekClause(filter.dayOfWeek as DayOfWeek[] | DayOfWeek | string, labels));
  }

  if (filter.temporalFilter) {
    clauses.push(formatTemporalFilterClause(filter.temporalFilter, labels));
  }

  if (filter.location) {
    const { adminArea, coordinates, radiusMeters } = filter.location;
    if (adminArea && adminArea.trim() !== '') {
      clauses.push(formatLocationAdminAreaClause(adminArea, labels));
    } else if (coordinates) {
      clauses.push(formatLocationProximityClause(radiusMeters, labels));
    }
  }

  if (filter.venueType && filter.venueType.trim() !== '') {
    clauses.push(formatVenueTypeClause(filter.venueType, labels));
  }

  if (filter.isFree != null) {
    const isFreeClause = formatIsFreeClause(filter.isFree, labels);
    if (isFreeClause !== undefined) {
      clauses.push(isFreeClause);
    }
  }

  const summary = clauses.length > 0 ? clauses.join(' ') : labels.noFilter;
  const caveatsText = joinCaveats(caveats, labels);

  return { summary, caveatsText };
}
