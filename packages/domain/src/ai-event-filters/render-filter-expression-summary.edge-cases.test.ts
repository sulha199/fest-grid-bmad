import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType } from '@festgrid/shared-types';
import { renderFilterExpressionSummary, type FilterExpressionSummaryLabels } from './render-filter-expression-summary.js';
import type { FilterNode } from './filter-node.js';

// Built-in English fallbacks: a locale that defines none of the optional words.
const bare: FilterExpressionSummaryLabels = { noFilter: 'All events' };
const render = (node: FilterNode, labels: FilterExpressionSummaryLabels = bare) =>
  renderFilterExpressionSummary(node, null, labels).summary;

const kw = (value: string): FilterNode => ({ field: 'keyword', value });

describe('renderFilterExpressionSummary on compound expressions', () => {
  it('renders account id and keyword leaves', () => {
    assert.equal(render({ op: 'OR', children: [{ field: 'accountId', value: 'acc-1' }, kw('jazz')] }), "acc-1 or about 'jazz'");
  });

  it('renders proximity leaves with and without a radius', () => {
    assert.equal(
      render({
        op: 'OR',
        children: [
          { field: 'locationProximity', value: { coordinates: { lat: 1, lng: 2 }, radiusMeters: 5000 } },
          { field: 'locationProximity', value: { coordinates: { lat: 1, lng: 2 } } },
        ],
      }),
      'within 5km of me or near me'
    );
  });

  it('renders an isFree leaf from the locale label, or as an empty clause when the locale has none', () => {
    const tree: FilterNode = { op: 'OR', children: [{ field: 'isFree', value: true }, kw('jazz')] };
    assert.equal(render(tree, { ...bare, freeEventsOnly: 'free only' }), "free only or about 'jazz'");
    assert.equal(render(tree), " or about 'jazz'");
  });

  it('renders a NOT over a leaf and over a group with the default "not" word', () => {
    assert.equal(render({ op: 'NOT', child: kw('jazz') }), "not about 'jazz'");
    assert.equal(
      render({ op: 'NOT', child: { op: 'OR', children: [kw('jazz'), kw('blues')] } }),
      "not (about 'jazz' or about 'blues')"
    );
  });

  it('uses the default "and" / "or" words and parenthesises a nested group of the other operator', () => {
    assert.equal(
      render({
        op: 'OR',
        children: [{ op: 'AND', children: [kw('jazz'), { field: 'type', value: [EventType.FESTIVAL] }] }, kw('blues')],
      }),
      "(about 'jazz' and FESTIVAL) or about 'blues'"
    );
  });

  it('honours locale-supplied and / or / not words', () => {
    assert.equal(
      render(
        { op: 'NOT', child: { op: 'OR', children: [kw('a'), kw('b')] } },
        { ...bare, not: 'bukan', or: 'atau' }
      ),
      "bukan (about 'a' atau about 'b')"
    );
  });

  it('falls back to the "no filter" text when a group renders to nothing', () => {
    assert.equal(render({ op: 'OR', children: [] }), 'All events');
  });
});
