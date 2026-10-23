import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_VARIANT_KINDS,
  canHavePromptVariant,
  pickPromptVariant,
  summarizeMetamorphicDrift,
  type PromptVariant,
} from './generate-prompt-variants.js';
import { GOLDEN_PROMPT_FIXTURES, type GoldenPromptFixture } from './golden-prompt-fixtures.js';

function fixture(overrides: Partial<GoldenPromptFixture> & Pick<GoldenPromptFixture, 'prompt'>): GoldenPromptFixture {
  return {
    id: 'test-fixture',
    lang: 'en',
    category: 'AND',
    geminiResponse: {},
    expected: {
      expression: { op: 'AND', children: [{ field: 'isFree', value: true }, { field: 'keyword', value: 'jazz' }] },
      caveats: [],
    },
    ...overrides,
  };
}

// start = fixtureIndex + seed; kinds are ['vague-prefix','filler','typo','uppercase'].
const KIND_AT = (start: number) => PROMPT_VARIANT_KINDS[start % PROMPT_VARIANT_KINDS.length];

describe('pickPromptVariant', () => {
  const base = fixture({ prompt: 'free jazz events this weekend' });

  it('rotates the kind with (fixtureIndex + seed)', () => {
    for (let start = 0; start < 8; start++) {
      assert.equal(pickPromptVariant(base, start, 0)?.kind, KIND_AT(start));
      assert.equal(pickPromptVariant(base, 0, start)?.kind, KIND_AT(start));
    }
  });

  it('vague-prefix prepends a language-appropriate word and expects a caveat', () => {
    const en = pickPromptVariant(base, 0, 0);
    assert.deepEqual(en, { kind: 'vague-prefix', prompt: 'exciting free jazz events this weekend', caveatExpectation: 'present' });
    // seed 4 -> start 4 -> vague-prefix again, word index 4 % 3 = 1.
    const id = pickPromptVariant(fixture({ lang: 'id', prompt: 'acara jazz gratis' }), 0, 4);
    assert.equal(id?.kind, 'vague-prefix');
    assert.equal(id?.prompt, 'keren acara jazz gratis');
  });

  it('picks a different vague word as the seed changes', () => {
    const words = [0, 4, 8].map((seed) => pickPromptVariant(base, 0, seed)?.prompt.split(' ')[0]);
    assert.deepEqual(words, ['exciting', 'fun', 'amazing']);
  });

  it('filler prepends polite filler in the fixture language and expects the base caveat presence', () => {
    assert.deepEqual(pickPromptVariant(base, 1, 0), {
      kind: 'filler',
      prompt: 'please show me free jazz events this weekend',
      caveatExpectation: 'same-as-base',
    });
    assert.equal(pickPromptVariant(fixture({ lang: 'id', prompt: 'acara jazz' }), 1, 0)?.prompt, 'tolong tampilkan acara jazz');
  });

  it('typo corrupts only the first neutral word, case-insensitively and on whole words only', () => {
    assert.equal(pickPromptVariant(base, 2, 0)?.prompt, 'free jazz evnets this weekend');
    assert.equal(pickPromptVariant(fixture({ prompt: 'Events at the mall' }), 2, 0)?.prompt, 'evnets at the mall');
    assert.equal(pickPromptVariant(fixture({ prompt: 'acara musik' }), 2, 0)?.prompt, 'acra musik');
    // "prevents" contains "events" but is not the word.
    assert.notEqual(pickPromptVariant(fixture({ prompt: 'prevents jazz' }), 2, 0)?.kind, 'typo');
  });

  it('typo falls through to the next kind when the prompt has no neutral word', () => {
    const variant = pickPromptVariant(fixture({ prompt: 'free jazz gigs' }), 2, 0);
    assert.equal(variant?.kind, 'uppercase');
    assert.equal(variant?.prompt, 'FREE JAZZ GIGS');
  });

  it('uppercase upper-cases the whole prompt', () => {
    assert.deepEqual(pickPromptVariant(base, 3, 0), {
      kind: 'uppercase',
      prompt: 'FREE JAZZ EVENTS THIS WEEKEND',
      caveatExpectation: 'same-as-base',
    });
  });

  it('returns undefined for categories a variant cannot meaningfully test', () => {
    assert.equal(pickPromptVariant(fixture({ prompt: 'x', category: 'over-limit' }), 0, 0), undefined);
    assert.equal(pickPromptVariant(fixture({ prompt: 'x', category: 'off-topic' }), 0, 0), undefined);
  });

  it('canHavePromptVariant agrees with pickPromptVariant for every category', () => {
    for (const category of ['AND', 'OR', 'NOT', 'nesting', 'precedence', 'over-limit', 'out-of-vocabulary', 'off-topic', 'vague-descriptor'] as const) {
      const f = fixture({ prompt: 'free jazz events', category });
      assert.equal(canHavePromptVariant(f), pickPromptVariant(f, 0, 0) !== undefined, category);
    }
  });

  it('is deterministic: the same (fixture, index, seed) always yields the same variant', () => {
    assert.deepEqual(pickPromptVariant(base, 5, 123), pickPromptVariant(base, 5, 123));
  });

  it('produces a variant whose prompt differs from the original for every eligible shipped fixture', () => {
    GOLDEN_PROMPT_FIXTURES.forEach((f, index) => {
      for (let seed = 0; seed < PROMPT_VARIANT_KINDS.length; seed++) {
        const variant = pickPromptVariant(f, index, seed);
        if (f.category === 'over-limit' || f.category === 'off-topic') {
          assert.equal(variant, undefined, `${f.id} should be skipped`);
        } else {
          assert.ok(variant && variant.prompt !== f.prompt, `${f.id} seed ${seed} gave no distinct variant`);
        }
      }
    });
  });
});

describe('summarizeMetamorphicDrift', () => {
  const base = fixture({ prompt: 'free jazz' });
  const filler: PromptVariant = { kind: 'filler', prompt: 'please show me free jazz', caveatExpectation: 'same-as-base' };
  const vague: PromptVariant = { kind: 'vague-prefix', prompt: 'fun free jazz', caveatExpectation: 'present' };
  const sameExpr = base.expected.expression;

  it('passes when fields match and caveat presence matches the base', () => {
    const result = summarizeMetamorphicDrift(base, filler, { expression: sameExpr, caveats: [] });
    assert.deepEqual(result, {
      fixtureId: 'test-fixture',
      kind: 'filler',
      variantPrompt: 'please show me free jazz',
      drifted: false,
      details: 'no drift',
    });
  });

  it('ignores free-text values and field order: only the leaf-field signature counts', () => {
    const reordered = { op: 'AND' as const, children: [{ field: 'keyword' as const, value: 'JAZZ' }, { field: 'isFree' as const, value: true }] };
    assert.equal(summarizeMetamorphicDrift(base, filler, { expression: reordered, caveats: [] }).drifted, false);
  });

  it('flags a changed field set and reports the variant prompt', () => {
    const result = summarizeMetamorphicDrift(base, filler, {
      expression: { field: 'venueType', value: 'kids' },
      caveats: [],
    });
    assert.equal(result.drifted, true);
    assert.match(result.details, /filler variant "please show me free jazz"/);
    assert.match(result.details, /expected=\[isFree,keyword\] actual=\[venueType\]; shape expected=AND\(isFree,keyword\) actual=venueType/);
  });

  it('flags a variant whose response lost the NOT even though the same fields are present', () => {
    const withNot = fixture({
      prompt: 'jazz, not workshops',
      expected: {
        expression: {
          op: 'AND',
          children: [{ field: 'keyword', value: 'jazz' }, { op: 'NOT', child: { field: 'venueType', value: 'x' } }],
        },
        caveats: [],
      },
    });
    const lostNot = { op: 'AND' as const, children: [{ field: 'keyword' as const, value: 'jazz' }, { field: 'venueType' as const, value: 'x' }] };
    const result = summarizeMetamorphicDrift(withNot, filler, { expression: lostNot, caveats: [] });
    assert.equal(result.drifted, true);
    assert.match(result.details, /shape expected=AND\(NOT\(venueType\),keyword\) actual=AND\(keyword,venueType\)/);
  });

  it('flags an unexpected caveat for a same-as-base variant', () => {
    assert.equal(summarizeMetamorphicDrift(base, filler, { expression: sameExpr, caveats: ['x'] }).drifted, true);
  });

  it('requires a caveat for a vague-prefix variant even when the base has none', () => {
    assert.equal(summarizeMetamorphicDrift(base, vague, { expression: sameExpr, caveats: [] }).drifted, true);
    assert.equal(summarizeMetamorphicDrift(base, vague, { expression: sameExpr, caveats: ['"fun" ignored'] }).drifted, false);
  });

  it('same-as-base follows a base fixture that does have caveats', () => {
    const withCaveat = fixture({ prompt: 'free jazz', expected: { expression: sameExpr, caveats: ['c'] } });
    assert.equal(summarizeMetamorphicDrift(withCaveat, filler, { expression: sameExpr, caveats: ['c'] }).drifted, false);
    assert.equal(summarizeMetamorphicDrift(withCaveat, filler, { expression: sameExpr, caveats: [] }).drifted, true);
  });
});
