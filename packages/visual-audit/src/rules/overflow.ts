/**
 * AD-26 Rule 5, overflow/clipping: renders each `ts-morph`-enumerated content variant and flags
 * `scrollWidth > clientWidth` (or the height equivalent) -- including variants the source
 * prototype never itself depicted (AC9).
 */

import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { enumerateContentVariants } from '../content-variants.js';
import { getElementSnapshot, checkOverflow } from '../compare/computed-style.js';
import type { OverflowRule } from '../manifest.js';

export interface OverflowVariantResult {
  variantLabel: string;
  pass: boolean;
  message: string;
}

export interface OverflowRuleResult {
  pass: boolean;
  variants: OverflowVariantResult[];
}

/** Runs an `OverflowRule` against every enumerated content variant, reusing `page` (viewport
 * already set by the caller's render step) for each variant's isolated markup. */
export async function runOverflowRule(page: Page, rule: OverflowRule, repoRoot: string): Promise<OverflowRuleResult> {
  const path = await import('node:path');
  const sourceText = readFileSync(path.resolve(repoRoot, rule.formattingFunction.filePath), 'utf-8');
  const variants = enumerateContentVariants(sourceText, rule.formattingFunction.functionName);

  const results: OverflowVariantResult[] = [];
  for (const variant of variants) {
    const html = rule.buildFixtureHtml(variant.sampleText);
    await page.setContent(html, { waitUntil: 'load' });
    const snapshot = await getElementSnapshot(page, rule.selector);
    const overflow = checkOverflow(snapshot);
    results.push({
      variantLabel: variant.label,
      pass: overflow.pass,
      message: `[${variant.label} -> "${variant.sampleText}"] ${overflow.message}`,
    });
  }

  return { pass: results.every((r) => r.pass), variants: results };
}
