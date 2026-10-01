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

export class FormattingFunctionNotFoundError extends Error {
  constructor(functionName: string, filePath: string) {
    super(`Expected to find an exported function "${functionName}" in ${filePath}`);
    this.name = 'FormattingFunctionNotFoundError';
  }
}

/**
 * Review Follow-up (patch item 7, 2026-09-22): fail fast and loud if the source function an
 * `OverflowRule` cites has moved/been renamed, rather than a confusing "function not found"
 * error surfacing deep inside `ts-morph`. Previously this guard existed only as a dead,
 * manifest-specific export (`assertFormattingFunctionExists`) nothing ever called; it is now
 * generic (works for any `OverflowRule`, not just one manifest's) and wired directly into this
 * rule's own execution path, so it runs on every overflow check unconditionally.
 */
function assertFormattingFunctionExists(sourceText: string, functionName: string, filePath: string): void {
  const exportPattern = new RegExp(`export\\s+function\\s+${functionName}\\b`);
  if (!exportPattern.test(sourceText)) {
    throw new FormattingFunctionNotFoundError(functionName, filePath);
  }
}

/** Runs an `OverflowRule` against every enumerated content variant, reusing `page` (viewport
 * already set by the caller's render step) for each variant's isolated markup. */
export async function runOverflowRule(page: Page, rule: OverflowRule, repoRoot: string): Promise<OverflowRuleResult> {
  const path = await import('node:path');
  const absolutePath = path.resolve(repoRoot, rule.formattingFunction.filePath);
  const sourceText = readFileSync(absolutePath, 'utf-8');
  assertFormattingFunctionExists(sourceText, rule.formattingFunction.functionName, absolutePath);
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
