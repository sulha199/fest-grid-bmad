import type { EventType, EventCategory } from '@festgrid/shared-types';
import type { DateRangeFilter, DayOfWeek, TemporalFilter } from '../events/buildEventsQueryCondition.js';
import type { AIFilterSummaryLabels } from './render-ai-filter-summary.js';

/**
 * Pure, shared per-leaf-field formatting helpers (Story 9.5 Task 1). Extracted once so both the
 * flat renderer (`render-ai-filter-summary.ts`) and the tree renderer
 * (`render-filter-expression-summary.ts`) call the *same* implementation per concern, mirroring
 * `compile-filter-node.ts`'s existing precedent of extracting shared leaf builders out of
 * `buildEventsQueryCondition.ts` rather than re-deriving per-field logic twice.
 *
 * `AIFilterSummaryLabels` is imported type-only (erased at compile time) -- `render-ai-filter-
 * summary.ts` (which also imports *values* from this file) therefore has no runtime circular
 * dependency with this module (Dev Notes decision 6).
 */

export function formatAccountIdClause(accountId: string, labels: AIFilterSummaryLabels): string {
  const accId = accountId.trim();
  if (labels.accountIdTemplate) {
    return labels.accountIdTemplate.replace('{accountId}', accId);
  }
  return (labels.accountIdPrefix ?? '') + accId;
}

export function formatTypesClause(types: EventType[], labels: AIFilterSummaryLabels): string {
  const translatedTypes = types.map((t) => (labels.types && labels.types[t]) ? labels.types[t] : t);
  const typeSeparator = labels.typeSeparator ?? ', ';
  return (labels.typesPrefix ?? '') + translatedTypes.join(typeSeparator);
}

export function formatCategoriesClause(categories: EventCategory[], labels: AIFilterSummaryLabels): string {
  const translatedCats = categories.map((c) => (labels.categories && labels.categories[c]) ? labels.categories[c] : c);
  const catSeparator = labels.categorySeparator ?? ', ';
  return (labels.categoriesPrefix ?? '') + translatedCats.join(catSeparator);
}

export function formatKeywordClause(keyword: string, labels: AIFilterSummaryLabels): string {
  const kw = keyword.trim();
  if (labels.keywordTemplate) {
    return labels.keywordTemplate.replace('{keyword}', kw);
  }
  return (labels.keywordPrefix ?? 'about ') + "'" + kw + "'";
}

export function formatDateRangeClause(dateRange: DateRangeFilter, labels: AIFilterSummaryLabels): string {
  const { anchor, offsetAmount, offsetUnit, spanAmount, spanUnit } = dateRange;
  const anchorText = (labels.anchors && labels.anchors[anchor]) ? labels.anchors[anchor] : anchor;
  const hasSpan = spanAmount != null && spanUnit != null;
  const spanUnitText = hasSpan ? ((labels.units && labels.units[spanUnit as string]) ? labels.units[spanUnit as string] : spanUnit) : '';
  if (offsetAmount === 0) {
    if (hasSpan) {
      return (labels.dateRangeSpanOnlyTemplate ?? 'the next {spanAmount} {spanUnit}')
        .replace('{spanAmount}', String(spanAmount)).replace('{spanUnit}', spanUnitText as string);
    }
    return anchorText;
  }
  const unitText = (labels.units && labels.units[offsetUnit]) ? labels.units[offsetUnit] : offsetUnit;
  const sign = offsetAmount >= 0 ? '+' : '-';
  const absAmount = Math.abs(offsetAmount);
  const base = labels.dateRangeTemplate
    ? labels.dateRangeTemplate.replace('{anchor}', anchorText).replace('{sign}', sign).replace('{amount}', String(absAmount)).replace('{unit}', unitText)
    : `${anchorText} ${sign} ${absAmount} ${unitText}`;
  if (hasSpan) {
    return (labels.dateRangeSpanExtensionTemplate ?? '{base}, extending {spanAmount} {spanUnit}')
      .replace('{base}', base).replace('{spanAmount}', String(spanAmount)).replace('{spanUnit}', spanUnitText as string);
  }
  return base;
}

const WEEKEND_DAYS = ['SAT', 'SUN'];
const WEEKDAY_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

function isExactDaySet(dows: string[], set: string[]): boolean {
  return dows.length === set.length && set.every((d) => dows.includes(d));
}

export function formatDayOfWeekClause(dowInput: DayOfWeek[] | DayOfWeek | string, labels: AIFilterSummaryLabels): string {
  const dows = (Array.isArray(dowInput) ? dowInput : [dowInput]) as string[];
  if (isExactDaySet(dows, WEEKEND_DAYS) && labels.weekends) return labels.weekends;
  if (isExactDaySet(dows, WEEKDAY_DAYS) && labels.weekdays) return labels.weekdays;
  const translated = dows.map((d) => (labels.daysOfWeek && labels.daysOfWeek[d]) ? labels.daysOfWeek[d] : d);
  if (translated.length <= 1) return translated.join('');
  const orWord = labels.or ?? 'or';
  return translated.slice(0, -1).join(', ') + ` ${orWord} ` + translated[translated.length - 1];
}

export function formatTemporalFilterClause(temporalFilter: TemporalFilter | string, labels: AIFilterSummaryLabels): string {
  return (labels.temporalStatus && labels.temporalStatus[temporalFilter as string]) ? labels.temporalStatus[temporalFilter as string] : String(temporalFilter);
}

export function formatLocationAdminAreaClause(adminArea: string, labels: AIFilterSummaryLabels): string {
  const area = adminArea.trim();
  return labels.adminAreaTemplate ? labels.adminAreaTemplate.replace('{adminArea}', area) : (labels.adminAreaPrefix ?? 'in ') + area;
}

export function formatLocationProximityClause(radiusMeters: number | null | undefined, labels: AIFilterSummaryLabels): string {
  if (radiusMeters !== undefined && radiusMeters !== null) {
    const radiusKm = radiusMeters / 1000;
    return labels.nearMeWithRadiusTemplate ? labels.nearMeWithRadiusTemplate.replace('{radius}', String(radiusKm)) : (labels.nearMeWithRadiusPrefix ?? 'within ') + radiusKm + 'km of me';
  }
  return labels.nearMe ?? 'near me';
}

export function formatVenueTypeClause(venueType: string, labels: AIFilterSummaryLabels): string {
  const vt = venueType.trim();
  return labels.venueTypeTemplate ? labels.venueTypeTemplate.replace('{venueType}', vt) : (labels.venueTypePrefix ?? 'at ') + vt;
}

export function formatIsFreeClause(isFree: boolean, labels: AIFilterSummaryLabels): string | undefined {
  if (isFree === true && labels.freeEventsOnly) {
    return labels.freeEventsOnly;
  }
  if (isFree === false && labels.paidEventsOnly) {
    return labels.paidEventsOnly;
  }
  return undefined;
}

export function joinCaveats(caveats: string[] | null | undefined, labels: AIFilterSummaryLabels): string | undefined {
  if (!caveats || caveats.length === 0) return undefined;
  const nonEmpty = caveats.filter((c) => c.trim() !== '');
  if (nonEmpty.length === 0) return undefined;
  const caveatSeparator = labels.caveatSeparator ?? '\n';
  const caveatPrefix = labels.caveatPrefix ?? '';
  return nonEmpty.map((c) => caveatPrefix + c).join(caveatSeparator);
}
