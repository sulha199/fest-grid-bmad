import axe from 'axe-core';

/**
 * WCAG 2.2 AA automated check (axe-core) for one rendered subtree.
 *
 * jsdom has no layout engine, so `color-contrast` (and the rules that need real geometry) cannot be judged
 * here and are switched off: contrast is covered by the design tokens in DESIGN.md instead. Everything else
 * axe can decide from the DOM runs: names, roles, ARIA validity, labels, landmarks, headings, duplicate ids,
 * link and button names, image alternatives, list structure and so on.
 */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

export async function wcagViolations(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: [...WCAG_TAGS] },
    rules: {
      'color-contrast': { enabled: false },
      // Needs a real page: a tested subtree is not a document with a title, a <main> or a skip link.
      region: { enabled: false },
    },
  });
  return results.violations;
}

export function describeViolations(violations: axe.Result[]): string {
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes.map((n) => `  - ${n.target.join(' ')}: ${n.html.slice(0, 160)}`).join('\n'),
    )
    .join('\n');
}
