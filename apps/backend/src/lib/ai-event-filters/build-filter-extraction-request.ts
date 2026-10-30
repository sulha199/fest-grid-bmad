import { EventType } from '@festgrid/shared-types';
import { DateAnchor, DateOffsetUnit, DayOfWeek, TemporalFilter } from '@festgrid/domain/events';
import { FILTER_NODE_MAX_DEPTH, FILTER_NODE_MAX_NODES } from '@festgrid/domain/ai-event-filters';
import { renderEventCategoryGlossary } from '../ai-gateway/render-event-category-glossary.js';

/**
 * Story 9.4 AC1: the full system instruction sent to Gemini for `resolvePromptToEventFilter`.
 * Documents the complete leaf field vocabulary (`filter-vocabulary.md`, including the three
 * fields the old flat-only prompt never requested: `dateRange.spanAmount`/`spanUnit`,
 * array-valued `dayOfWeek`, `temporalFilter`) and the `op`/`children`/`child` grammar, with one
 * English and one Indonesian few-shot example demonstrating AND/OR/NOT precedence and grouping.
 */
export function buildFilterExtractionSystemInstruction(): string {
  return `You are an AI assistant that parses a free-text prompt from Indonesia (mainly Yogyakarta/Sleman) into a structured, tree-shaped event filter expression.

Each node in the tree is either a GROUP (has "op": "AND" or "OR" plus "children": an array of nodes), a NEGATION (has "op": "NOT" plus "child": a single node), or a LEAF (no "op" -- one or more of the fields below, populated directly on the node object):

- accountId: optional string -- the social media account the user named, exactly as written (an @handle, username or display name). NEVER invent a UUID; if no account is named, omit it.
- types: optional array of EventType strings: ${Object.values(EventType).join(', ')}.
- categories: optional array of EventCategory strings, each given as \`NAME -- definition\`:
${renderEventCategoryGlossary()}
- keyword: optional free-text search phrase string.
- dateRange: optional object -- { anchor: one of ${Object.values(DateAnchor).join(', ')}, offsetAmount: integer (positive or negative), offsetUnit: one of ${Object.values(DateOffsetUnit).join(', ')}, spanAmount: optional positive integer widening the window (e.g. "next 7 days"), spanUnit: optional, same allowed values as offsetUnit, required together with spanAmount }.
- dayOfWeek: optional array of one or more weekday strings: ${Object.values(DayOfWeek).join(', ')} (e.g. "weekends" -> ["SAT", "SUN"]).
- location: optional object -- EITHER { adminArea: a province/city/regency string, e.g. Yogyakarta, Sleman, Bantul, Jakarta } OR { coordinates: { lat, lng }, radiusMeters: optional positive integer } -- never both on the same leaf.
- isFree: optional boolean.
- temporalFilter: optional string, one of ${Object.values(TemporalFilter).join(', ')} ("happening now" vs. "upcoming").

NOT FILTERABLE: the kind or setting of a place (cafe, mall, stadium, indoor, outdoor, rooftop, ...) has NO field. Never invent one and never map such a word to a type, category or keyword -- list it in "caveats" and keep every other condition.

A leaf node may populate more than one of the fields above at once (e.g. a single leaf combining dateRange and dayOfWeek for "this weekend").

GROUPING GRAMMAR: combine leaves with AND/OR/NOT.
- A GROUP node: { "op": "AND" | "OR", "children": [node, node, ...] }. Use OR when the user says "or" between alternatives of the SAME kind (e.g. two keywords, two locations). Use AND to require several different conditions together.
- A NEGATION node: { "op": "NOT", "child": node }. NOT excludes everything matching its child. An event that has NO VALUE at all for the negated field does not match the child, so NOT KEEPS it ("not workshops" still shows events with no type). Never nest a NOT directly inside another NOT.
- The tree is at most ${FILTER_NODE_MAX_DEPTH} levels deep and at most ${FILTER_NODE_MAX_NODES} nodes in total. Keep your output within these bounds.
- Any part of the prompt that cannot be mapped to the fields/grammar above MUST be listed as a plain-text caveat string in the parallel "caveats" array, instead of being guessed at.

Output MUST be valid JSON matching:
{
  "expression": <a single node as described above>,
  "caveats": ["caveat 1", "caveat 2", ...]
}

EXAMPLE (English) -- prompt: "jazz or blues in Sleman or Bantul this weekend, not workshops" ->
{
  "expression": {
    "op": "AND",
    "children": [
      { "op": "OR", "children": [ { "keyword": "jazz" }, { "keyword": "blues" } ] },
      { "op": "OR", "children": [ { "location": { "adminArea": "Sleman" } }, { "location": { "adminArea": "Bantul" } } ] },
      { "dateRange": { "anchor": "THIS_WEEK", "offsetAmount": 0, "offsetUnit": "WEEK" }, "dayOfWeek": ["SAT", "SUN"] },
      { "op": "NOT", "child": { "types": ["WORKSHOP"] } }
    ]
  },
  "caveats": []
}

EXAMPLE (Indonesian) -- prompt: "musik jazz atau blues di Sleman atau Bantul akhir pekan ini, bukan workshop" -> the identical tree shape as above (the same grouping/precedence applies regardless of the prompt's language):
{
  "expression": {
    "op": "AND",
    "children": [
      { "op": "OR", "children": [ { "keyword": "jazz" }, { "keyword": "blues" } ] },
      { "op": "OR", "children": [ { "location": { "adminArea": "Sleman" } }, { "location": { "adminArea": "Bantul" } } ] },
      { "dateRange": { "anchor": "THIS_WEEK", "offsetAmount": 0, "offsetUnit": "WEEK" }, "dayOfWeek": ["SAT", "SUN"] },
      { "op": "NOT", "child": { "types": ["WORKSHOP"] } }
    ]
  },
  "caveats": []
}
`;
}

function buildLeafProperties(): Record<string, object> {
  return {
    accountId: { type: 'STRING' },
    types: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: Object.values(EventType) },
    },
    // Deliberately NOT an `enum`: this leaf is unrolled into 7 node copies, and adding the 5 new
    // categories of Story 0.52-0.54 (18 -> 23 values, 380 enum values in all) made Gemini answer
    // every call with a bare 400 INVALID_ARGUMENT (nightly eval runs 12-16). The allowed names and
    // their definitions are in the system instruction's glossary, and
    // `transformGeminiResponseToFilterExpression` already drops an unknown value with a caveat.
    categories: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    keyword: { type: 'STRING' },
    dateRange: {
      type: 'OBJECT',
      properties: {
        anchor: { type: 'STRING', enum: Object.values(DateAnchor) },
        offsetAmount: { type: 'INTEGER' },
        offsetUnit: { type: 'STRING', enum: Object.values(DateOffsetUnit) },
        spanAmount: { type: 'INTEGER' },
        spanUnit: { type: 'STRING', enum: Object.values(DateOffsetUnit) },
      },
    },
    dayOfWeek: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: Object.values(DayOfWeek) },
    },
    location: {
      type: 'OBJECT',
      properties: {
        coordinates: {
          type: 'OBJECT',
          properties: {
            lat: { type: 'NUMBER' },
            lng: { type: 'NUMBER' },
          },
        },
        radiusMeters: { type: 'INTEGER', minimum: 1 },
        adminArea: { type: 'STRING' },
      },
    },
    isFree: { type: 'BOOLEAN' },
    temporalFilter: { type: 'STRING', enum: Object.values(TemporalFilter) },
  };
}

/**
 * Composes one unrolled tree level: always carries every leaf property, and additionally carries
 * `op`/`children`/`child` ONLY when `childSchema` is supplied -- the innermost (deepest allowed)
 * level omits them entirely, so Gemini is structurally incapable of nesting a group/NOT one level
 * past that point.
 */
function buildNodeSchema(childSchema?: object): object {
  const leafProperties = buildLeafProperties();
  if (!childSchema) {
    return { type: 'OBJECT', properties: leafProperties };
  }
  return {
    type: 'OBJECT',
    properties: {
      ...leafProperties,
      op: { type: 'STRING', enum: ['AND', 'OR', 'NOT'] },
      children: { type: 'ARRAY', items: childSchema },
      child: childSchema,
    },
  };
}

/**
 * Story 9.4 AC1: the bounded, explicitly-unrolled (non-recursive) 3-level `responseSchema` for
 * Gemini's structured output -- matches `FILTER_NODE_MAX_DEPTH` (3). No `$ref`/recursive schema
 * and no `oneOf`/discriminated union (Gemini's OpenAPI-subset schema format supports neither, per
 * this same codebase's other Gemini call site, `build-gemini-request.ts`).
 */
export function buildFilterExtractionResponseSchema(): object {
  const level3 = buildNodeSchema();
  const level2 = buildNodeSchema(level3);
  const level1 = buildNodeSchema(level2);

  return {
    type: 'OBJECT',
    properties: {
      expression: level1,
      caveats: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['expression', 'caveats'],
  };
}
