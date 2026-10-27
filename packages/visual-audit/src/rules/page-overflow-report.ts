/**
 * Markdown renderer for the page-overflow sweep. Pure -- takes already-collected rows.
 */

import { culpritKey, isOverflowing, type PageOverflowOffender, type PageOverflowResult } from './page-overflow.js';

export type AuditRowStatus = 'pass' | 'overflow' | 'error';

export interface AuditRow {
  route: string;
  viewportWidth: number;
  status: AuditRowStatus;
  result?: PageOverflowResult;
  error?: string;
}

export interface AuditReportMeta {
  generatedOn: string;
  baseUrl: string;
  /** Routes deliberately not swept, with the reason (e.g. needs login). */
  skipped: Array<{ route: string; reason: string }>;
  /** Caveats about what the measured pages actually were (e.g. a gated route showing its login prompt). */
  notes?: string[];
}

const MAX_OFFENDERS_PER_CELL = 3;

export function classifyResult(result: PageOverflowResult): AuditRowStatus {
  return isOverflowing(result) ? 'overflow' : 'pass';
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function cellFor(row: AuditRow | undefined): string {
  if (!row) return '–';
  if (row.status === 'pass') return 'ok';
  if (row.status === 'error') return 'ERR';
  const px = row.result?.overflowPx ?? 0;
  return row.result?.masked && px === 0 ? 'masked' : `+${px}px`;
}

export function renderAuditReport(rows: AuditRow[], meta: AuditReportMeta): string {
  const widths = [...new Set(rows.map((r) => r.viewportWidth))].sort((a, b) => a - b);
  const routes = [...new Set(rows.map((r) => r.route))];
  const find = (route: string, width: number) => rows.find((r) => r.route === route && r.viewportWidth === width);

  const overflowRows = rows.filter((r) => r.status === 'overflow');
  const errorRows = rows.filter((r) => r.status === 'error');
  const failingRoutes = new Set(overflowRows.map((r) => r.route));

  const out: string[] = [];
  out.push(`# Page-overflow audit -- ${meta.generatedOn}`, '');
  out.push(`Base URL: \`${meta.baseUrl}\`. Metric: \`documentElement.scrollWidth - clientWidth\` (px the page is wider than the viewport).`, '');
  out.push('## Summary', '');
  out.push(`- Checks: ${rows.length} (${routes.length} route(s) across ${widths.length} viewport width(s))`);
  out.push(`- Overflowing: ${overflowRows.length} checks across ${failingRoutes.size} route(s)`);
  out.push(`- Errors (page not measured): ${errorRows.length}`);
  out.push(`- Skipped routes: ${meta.skipped.length}`, '');

  out.push('## Matrix', '');
  out.push(`| Route | ${widths.map((w) => `${w}px`).join(' | ')} |`);
  out.push(`|---|${widths.map(() => '---').join('|')}|`);
  for (const route of routes) {
    out.push(`| \`${escapeCell(route)}\` | ${widths.map((w) => cellFor(find(route, w))).join(' | ')} |`);
  }
  out.push('');

  // Group by root culprit: one broken shared component typically overflows every route identically.
  const culprits = new Map<string, { offender: PageOverflowOffender; cells: Set<string>; routes: Set<string>; widths: Set<number>; maxPx: number }>();
  const culpritIdsFor = (row: AuditRow): string[] =>
    (row.result?.offenders ?? []).filter((o) => o.isRoot).slice(0, MAX_OFFENDERS_PER_CELL).map((o) => {
      const key = culpritKey(o.path);
      const entry = culprits.get(key) ?? { offender: o, cells: new Set<string>(), routes: new Set<string>(), widths: new Set<number>(), maxPx: 0 };
      entry.cells.add(`${row.route}@${row.viewportWidth}`);
      entry.routes.add(row.route);
      entry.widths.add(row.viewportWidth);
      entry.maxPx = Math.max(entry.maxPx, o.overflowPx);
      culprits.set(key, entry);
      return key;
    });
  const idsByCell = new Map<string, string[]>();
  for (const row of overflowRows) idsByCell.set(`${row.route}@${row.viewportWidth}`, culpritIdsFor(row));
  const labelOf = new Map([...culprits.keys()].map((key, i) => [key, `C${i + 1}`]));

  out.push('## Distinct culprits', '');
  if (overflowRows.length === 0) out.push('No overflow detected.', '');
  else if (culprits.size === 0) out.push('Overflow was detected but no culprit element could be identified (it may be absolutely positioned outside a clipping ancestor).', '');
  for (const [key, entry] of culprits) {
    const w = [...entry.widths].sort((a, b) => a - b);
    out.push(`### ${labelOf.get(key)} -- \`${key}\``, '');
    out.push(`- Seen on ${entry.routes.size} route(s) at ${w.join(', ')}px; worst overshoot +${entry.maxPx}px; element width ${Math.round(entry.offender.width)}px`);
    if (entry.offender.classes) out.push(`- Classes: \`${entry.offender.classes.trim().replace(/\s+/g, ' ').slice(0, 160)}\``);
    out.push(`- Routes: ${[...entry.routes].map((r) => `\`${r}\``).join(', ')}`, '');
  }

  out.push('## Findings by route', '');
  for (const route of routes) {
    const bad = overflowRows.filter((r) => r.route === route).sort((a, b) => a.viewportWidth - b.viewportWidth);
    if (bad.length === 0) continue;
    out.push(`### \`${route}\``, '');
    for (const row of bad) {
      const result = row.result!;
      const ids = (idsByCell.get(`${route}@${row.viewportWidth}`) ?? []).map((k) => labelOf.get(k)).join(', ') || '?';
      const head = result.masked && result.overflowPx === 0
        ? `html/body \`overflow-x\` is masking overflow`
        : `+${result.overflowPx}px (scrollWidth ${result.scrollWidth} vs clientWidth ${result.clientWidth})`;
      out.push(`- **${row.viewportWidth}px** ${head} -> ${ids}`);
    }
    out.push('');
  }

  if (errorRows.length > 0) {
    out.push('## Errors', '');
    for (const row of errorRows) out.push(`- \`${row.route}\` @ ${row.viewportWidth}px -- ${(row.error ?? 'unknown error').replace(/\s+/g, ' ')}`);
    out.push('');
  }
  if (meta.notes && meta.notes.length > 0) {
    out.push('## Caveats', '');
    for (const note of meta.notes) out.push(`- ${note}`);
    out.push('');
  }
  if (meta.skipped.length > 0) {
    out.push('## Skipped routes', '');
    for (const s of meta.skipped) out.push(`- \`${s.route}\` -- ${s.reason}`);
    out.push('');
  }
  return out.join('\n');
}
