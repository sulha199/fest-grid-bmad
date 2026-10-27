import test from 'node:test';
import * as assert from 'node:assert';
import { EventCategory, EVENT_CATEGORY_DEFINITIONS, CATEGORY_BOUNDARIES } from '@festgrid/shared-types';
import { renderEventCategoryGlossary } from './render-event-category-glossary.js';

test('renderEventCategoryGlossary unit tests', async (t) => {
  await t.test('renders exactly one line per category, in Object.values(EventCategory) declaration order', () => {
    const rendered = renderEventCategoryGlossary();
    const lines = rendered.split('\n');
    const categoryValues = Object.values(EventCategory);

    for (let i = 0; i < categoryValues.length; i++) {
      assert.ok(
        lines[i].startsWith(`  - ${categoryValues[i]} -- `),
        `Expected line ${i} to start with "  - ${categoryValues[i]} -- ", got: ${lines[i]}`
      );
    }

    // Exactly one line per category, not more (the next lines, if any, belong to boundaries).
    const categoryLineCount = lines.filter((line) =>
      categoryValues.some((c) => line.startsWith(`  - ${c} -- `))
    ).length;
    assert.strictEqual(categoryLineCount, categoryValues.length);
  });

  await t.test('uses the exact ASCII " -- " separator (not an em dash) and includes the definition + aliases', () => {
    const rendered = renderEventCategoryGlossary();
    const musicDef = EVENT_CATEGORY_DEFINITIONS[EventCategory.MUSIC];
    const expectedLine = `  - MUSIC -- ${musicDef.definition} (also: ${musicDef.aliases.join(', ')})`;
    assert.ok(rendered.includes(expectedLine), `Expected rendered output to include: ${expectedLine}`);
    assert.ok(!rendered.includes('—'), 'Expected no em dash (U+2014) anywhere in the rendered output');
  });

  await t.test('includes one line per CATEGORY_BOUNDARIES entry', () => {
    const rendered = renderEventCategoryGlossary();
    for (const boundary of CATEGORY_BOUNDARIES) {
      assert.ok(rendered.includes(boundary.rule), `Expected rendered output to include boundary rule: ${boundary.rule}`);
    }
  });

  await t.test('is deterministic: two calls return byte-identical output', () => {
    assert.strictEqual(renderEventCategoryGlossary(), renderEventCategoryGlossary());
  });
});
