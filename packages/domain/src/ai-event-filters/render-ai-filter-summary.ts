import { EventFilterInput } from '../events/buildEventsQueryCondition.js';

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
    const accId = filter.accountId.trim();
    if (labels.accountIdTemplate) {
      clauses.push(labels.accountIdTemplate.replace('{accountId}', accId));
    } else {
      clauses.push((labels.accountIdPrefix ?? '') + accId);
    }
  }

  if (filter.types && filter.types.length > 0) {
    const translatedTypes = filter.types.map(t => (labels.types && labels.types[t]) ? labels.types[t] : t);
    const typeSeparator = labels.typeSeparator ?? ', ';
    clauses.push((labels.typesPrefix ?? '') + translatedTypes.join(typeSeparator));
  }

  if (filter.categories && filter.categories.length > 0) {
    const translatedCats = filter.categories.map(c => (labels.categories && labels.categories[c]) ? labels.categories[c] : c);
    const catSeparator = labels.categorySeparator ?? ', ';
    clauses.push((labels.categoriesPrefix ?? '') + translatedCats.join(catSeparator));
  }

  if (filter.keyword && filter.keyword.trim() !== '') {
    const kw = filter.keyword.trim();
    if (labels.keywordTemplate) {
      clauses.push(labels.keywordTemplate.replace('{keyword}', kw));
    } else {
      clauses.push((labels.keywordPrefix ?? "about ") + "'" + kw + "'");
    }
  }

  if (filter.dateRange) {
    const { anchor, offsetAmount, offsetUnit } = filter.dateRange;
    const anchorText = (labels.anchors && labels.anchors[anchor]) ? labels.anchors[anchor] : anchor;
    if (offsetAmount === 0) {
      clauses.push(anchorText);
    } else {
      const unitText = (labels.units && labels.units[offsetUnit]) ? labels.units[offsetUnit] : offsetUnit;
      const sign = offsetAmount >= 0 ? '+' : '-';
      const absAmount = Math.abs(offsetAmount);
      if (labels.dateRangeTemplate) {
        clauses.push(labels.dateRangeTemplate
          .replace('{anchor}', anchorText)
          .replace('{sign}', sign)
          .replace('{amount}', String(absAmount))
          .replace('{unit}', unitText));
      } else {
        clauses.push(`${anchorText} ${sign} ${absAmount} ${unitText}`);
      }
    }
  } else if (filter.dayOfWeek) {
    const dow = filter.dayOfWeek;
    clauses.push((labels.daysOfWeek && labels.daysOfWeek[dow]) ? labels.daysOfWeek[dow] : dow);
  }

  if (filter.location) {
    const { adminArea, coordinates, radiusMeters } = filter.location;
    if (adminArea && adminArea.trim() !== '') {
      const area = adminArea.trim();
      clauses.push(labels.adminAreaTemplate ? labels.adminAreaTemplate.replace('{adminArea}', area) : (labels.adminAreaPrefix ?? 'in ') + area);
    } else if (coordinates) {
      if (radiusMeters !== undefined) {
        const radiusKm = radiusMeters / 1000;
        clauses.push(labels.nearMeWithRadiusTemplate ? labels.nearMeWithRadiusTemplate.replace('{radius}', String(radiusKm)) : (labels.nearMeWithRadiusPrefix ?? 'within ') + radiusKm + 'km of me');
      } else {
        clauses.push(labels.nearMe ?? 'near me');
      }
    }
  }

  if (filter.venueType && filter.venueType.trim() !== '') {
    const vt = filter.venueType.trim();
    clauses.push(labels.venueTypeTemplate ? labels.venueTypeTemplate.replace('{venueType}', vt) : (labels.venueTypePrefix ?? 'at ') + vt);
  }

  if (filter.isFree !== undefined) {
    if (filter.isFree === true && labels.freeEventsOnly) {
      clauses.push(labels.freeEventsOnly);
    } else if (filter.isFree === false && labels.paidEventsOnly) {
      clauses.push(labels.paidEventsOnly);
    }
  }

  const summary = clauses.length > 0 ? clauses.join(' ') : labels.noFilter;
  let caveatsText: string | undefined = undefined;
  if (caveats && caveats.length > 0) {
    const caveatSeparator = labels.caveatSeparator ?? '\n';
    const caveatPrefix = labels.caveatPrefix ?? '';
    caveatsText = caveats.map(c => caveatPrefix + c).join(caveatSeparator);
  }

  return { summary, caveatsText };
}
