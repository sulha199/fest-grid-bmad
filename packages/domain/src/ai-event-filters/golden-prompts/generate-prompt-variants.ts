import type { GeminiFilterExtractionResult } from '../transform-gemini-response-to-filter-expression.js';
import { computeFilterNodeFieldSignature, computeFilterNodeShapeSignature } from './compute-golden-prompt-drift.js';
import type { GoldenPromptFixture } from './golden-prompt-fixtures.js';

/**
 * Metamorphic variants of a golden prompt: the variant must resolve to the SAME leaf fields as the
 * fixture it came from, so no hand-authored expectation is needed and the suite widens itself.
 * Template-driven and deterministic -- no LLM is involved in generating a variant, so a failing
 * `(fixture, kind, seed)` is always reproducible.
 *
 * - `vague-prefix`: a subjective word ("exciting", "seru") that maps to no field is prepended.
 *   Must change nothing except adding a caveat (the "exiting events for kid" bug class).
 * - `filler`: polite filler ("please show me ...") must change nothing.
 * - `typo`: a typo in a neutral word ("events" -> "evnets") must change nothing.
 * - `uppercase`: the whole prompt in capitals must change nothing.
 */
export const PROMPT_VARIANT_KINDS = ['vague-prefix', 'filler', 'typo', 'uppercase'] as const;
export type PromptVariantKind = (typeof PROMPT_VARIANT_KINDS)[number];

export interface PromptVariant {
  kind: PromptVariantKind;
  prompt: string;
  /** `present`: the live response must carry a caveat. `same-as-base`: caveat presence must match the fixture. */
  caveatExpectation: 'present' | 'same-as-base';
}

const VAGUE_WORDS: Record<GoldenPromptFixture['lang'], readonly string[]> = {
  en: ['exciting', 'fun', 'amazing'],
  id: ['seru', 'keren', 'asik'],
};

const FILLER_PREFIX: Record<GoldenPromptFixture['lang'], string> = {
  en: 'please show me ',
  id: 'tolong tampilkan ',
};

/** Neutral words only (never a field-bearing word like a type, place or date): [word, typo]. */
const NEUTRAL_TYPOS: ReadonlyArray<readonly [string, string]> = [
  ['events', 'evnets'],
  ['event', 'evnet'],
  ['acara', 'acra'],
  ['this', 'tihs'],
  ['the', 'teh'],
];

/**
 * A variant keeps the fixture's expected leaf fields only when the base prompt is a plain
 * extraction request -- a "kw-0 or kw-1 ..." over-limit prompt or a deliberately off-topic one gives
 * a noisy or empty signal that a variant cannot meaningfully test.
 */
const VARIANT_SKIPPED_CATEGORIES: ReadonlySet<GoldenPromptFixture['category']> = new Set(['over-limit', 'off-topic']);

/** Whether `pickPromptVariant` can ever produce a variant for `fixture` -- lets a caller budget the extra call up front. */
export function canHavePromptVariant(fixture: GoldenPromptFixture): boolean {
  return !VARIANT_SKIPPED_CATEGORIES.has(fixture.category);
}

function applyTypo(prompt: string): string | undefined {
  for (const [word, typo] of NEUTRAL_TYPOS) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(prompt)) {
      return prompt.replace(pattern, typo);
    }
  }
  return undefined;
}

function build(fixture: GoldenPromptFixture, kind: PromptVariantKind, seed: number): PromptVariant | undefined {
  switch (kind) {
    case 'vague-prefix': {
      const words = VAGUE_WORDS[fixture.lang];
      return { kind, prompt: `${words[seed % words.length]} ${fixture.prompt}`, caveatExpectation: 'present' };
    }
    case 'filler':
      return { kind, prompt: `${FILLER_PREFIX[fixture.lang]}${fixture.prompt}`, caveatExpectation: 'same-as-base' };
    case 'typo': {
      const prompt = applyTypo(fixture.prompt);
      return prompt === undefined ? undefined : { kind, prompt, caveatExpectation: 'same-as-base' };
    }
    case 'uppercase':
      return { kind, prompt: fixture.prompt.toUpperCase(), caveatExpectation: 'same-as-base' };
  }
}

/**
 * Picks one variant for `fixture`: kinds rotate by `(fixtureIndex + seed)`, so every kind is
 * exercised across the suite each run and a different kind lands on each fixture as `seed` changes
 * (callers pass the UTC day number). A kind that does not apply (no neutral word to typo) falls
 * through to the next. Returns `undefined` only for categories variants cannot meaningfully test.
 */
export function pickPromptVariant(fixture: GoldenPromptFixture, fixtureIndex: number, seed: number): PromptVariant | undefined {
  if (!canHavePromptVariant(fixture)) {
    return undefined;
  }
  const start = fixtureIndex + seed;
  for (let offset = 0; offset < PROMPT_VARIANT_KINDS.length; offset++) {
    const kind = PROMPT_VARIANT_KINDS[(start + offset) % PROMPT_VARIANT_KINDS.length];
    const variant = build(fixture, kind, seed);
    if (variant) {
      return variant;
    }
  }
  // Unreachable: `uppercase` always applies, so some offset in the loop above always returns.
  /* c8 ignore next */
  return undefined;
}

export interface MetamorphicDriftResult {
  fixtureId: string;
  kind: PromptVariantKind;
  variantPrompt: string;
  drifted: boolean;
  details: string;
}

/**
 * Compares a live response for `variant.prompt` against the ORIGINAL fixture's expectation: the
 * leaf-field signature must be identical, and caveat presence must follow `caveatExpectation`.
 */
export function summarizeMetamorphicDrift(
  fixture: GoldenPromptFixture,
  variant: PromptVariant,
  liveResult: GeminiFilterExtractionResult
): MetamorphicDriftResult {
  const expectedFields = computeFilterNodeFieldSignature(fixture.expected.expression);
  const actualFields = computeFilterNodeFieldSignature(liveResult.expression);
  const expectedShape = computeFilterNodeShapeSignature(fixture.expected.expression);
  const actualShape = computeFilterNodeShapeSignature(liveResult.expression);
  const shapeMatches = JSON.stringify(expectedFields) === JSON.stringify(actualFields) && expectedShape === actualShape;
  const actualHadCaveats = liveResult.caveats.length > 0;
  const expectedCaveats = variant.caveatExpectation === 'present' ? true : fixture.expected.caveats.length > 0;
  const caveatMatches = actualHadCaveats === expectedCaveats;
  const drifted = !shapeMatches || !caveatMatches;
  const details = drifted
    ? `${variant.kind} variant "${variant.prompt}": fields expected=[${expectedFields.join(',')}] actual=[${actualFields.join(',')}]; shape expected=${expectedShape} actual=${actualShape}; caveatPresence expected=${expectedCaveats} actual=${actualHadCaveats}`
    : 'no drift';
  return { fixtureId: fixture.id, kind: variant.kind, variantPrompt: variant.prompt, drifted, details };
}
