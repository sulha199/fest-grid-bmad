/**
 * POC (pure over EXPLAIN JSON): a plan-shape guard for the hot read paths. The measured failure modes of Query.events were all
 * invisible to a unit test and to a green CI run — a sequential scan over every event, a plan whose estimated cost crosses the JIT
 * optimisation threshold (a ~700 ms cliff), a query that touches thousands of rows to return twenty. This turns "the plan changed
 * for the worse" into a failing check on the volume seed, before it reaches production.
 *
 *   analyzePlan(explainJson)          what the plan does: scan nodes, estimated and actual rows, cost, JIT
 *   checkPlan(analysis, rules)        the violations against explicit rules (defaults below are starting values to tune)
 *
 * Input is the output of `EXPLAIN (ANALYZE, FORMAT JSON) <query>` (an array with one object). Without ANALYZE the "Actual" figures are
 * absent and only the estimate-based rules apply.
 */

export interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Parallel Aware'?: boolean;
  'Plan Rows'?: number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Total Cost'?: number;
  Plans?: PlanNode[];
}
export interface ExplainRoot { Plan: PlanNode; JIT?: { Functions?: number; Timing?: { Total?: number } }; 'Execution Time'?: number }

export interface ScanInfo { node: string; relation: string; index?: string; parallel: boolean; estimatedRows: number; actualRows?: number }
export interface PlanAnalysis {
  scans: ScanInfo[];
  totalCost: number;
  returnedRows?: number;
  scannedRows?: number;      // sum of actual rows × loops over the scan nodes
  jitFunctions: number;
  executionMs?: number;
}

const SCAN_NODES = new Set(['Seq Scan', 'Index Scan', 'Index Only Scan', 'Bitmap Heap Scan']);

function walk(node: PlanNode, visit: (n: PlanNode) => void): void {
  visit(node);
  for (const child of node.Plans ?? []) walk(child, visit);
}

export function analyzePlan(explain: ExplainRoot[] | ExplainRoot): PlanAnalysis {
  const root = Array.isArray(explain) ? explain[0] : explain;
  const scans: ScanInfo[] = [];
  let scanned = 0;
  let sawActual = false;
  walk(root.Plan, (n) => {
    if (!SCAN_NODES.has(n['Node Type'])) return;
    const loops = n['Actual Loops'] ?? 1;
    const actual = n['Actual Rows'] !== undefined ? n['Actual Rows'] * loops : undefined;
    if (actual !== undefined) { sawActual = true; scanned += actual; }
    scans.push({ node: n['Node Type'], relation: n['Relation Name'] ?? '?', index: n['Index Name'], parallel: !!n['Parallel Aware'], estimatedRows: n['Plan Rows'] ?? 0, actualRows: actual });
  });
  return {
    scans,
    totalCost: root.Plan['Total Cost'] ?? 0,
    returnedRows: root.Plan['Actual Rows'],
    scannedRows: sawActual ? scanned : undefined,
    jitFunctions: root.JIT?.Functions ?? 0,
    executionMs: root['Execution Time'],
  };
}

export interface PlanRules {
  /** A sequential scan of one of these relations is a violation once it touches at least `minRows` rows (estimated or actual). */
  noSeqScanOn: string[];
  minRows: number;
  /** The estimated total cost must stay under this (Postgres pays the expensive JIT work above jit_optimize_above_cost = 500,000). */
  maxTotalCost: number;
  /** Any JIT-compiled function is a violation (the hot path should neither need nor pay for it). */
  forbidJit: boolean;
  /** rows scanned ÷ rows returned: a paged query that reads thousands of rows to return a page is amplifying work. */
  maxAmplification: number;
  /** An absolute budget for rows read by scan nodes — for a query whose useful work is known (e.g. 4 x K for a candidate query). */
  maxScannedRows?: number;
}
export const DEFAULT_PLAN_RULES: PlanRules = {
  noSeqScanOn: ['events', 'schedules', 'posts', 'favorites', 'reports', 'calendar_additions', 'bench_event_area'],
  minRows: 1000,
  maxTotalCost: 400_000,
  forbidJit: true,
  maxAmplification: 2000,
};

export interface Violation { rule: 'seq-scan' | 'cost' | 'jit' | 'amplification' | 'scanned-budget'; detail: string }

export function checkPlan(a: PlanAnalysis, rules: PlanRules = DEFAULT_PLAN_RULES): Violation[] {
  const v: Violation[] = [];
  for (const s of a.scans) {
    if (s.node !== 'Seq Scan' || !rules.noSeqScanOn.includes(s.relation)) continue;
    const rows = Math.max(s.estimatedRows, s.actualRows ?? 0);
    if (rows >= rules.minRows) v.push({ rule: 'seq-scan', detail: `${s.parallel ? 'Parallel ' : ''}Seq Scan on ${s.relation} (${rows} rows)` });
  }
  if (a.totalCost > rules.maxTotalCost) v.push({ rule: 'cost', detail: `estimated cost ${Math.round(a.totalCost)} > ${rules.maxTotalCost}` });
  if (rules.forbidJit && a.jitFunctions > 0) v.push({ rule: 'jit', detail: `${a.jitFunctions} JIT-compiled functions` });
  if (a.scannedRows !== undefined && a.returnedRows !== undefined) {
    const ratio = a.scannedRows / Math.max(1, a.returnedRows);
    if (ratio > rules.maxAmplification) v.push({ rule: 'amplification', detail: `scanned ${a.scannedRows} rows to return ${a.returnedRows} (x${Math.round(ratio)})` });
  }
  if (rules.maxScannedRows !== undefined && a.scannedRows !== undefined && a.scannedRows > rules.maxScannedRows) v.push({ rule: 'scanned-budget', detail: `scanned ${a.scannedRows} rows, budget ${rules.maxScannedRows}` });
  return v;
}

/** One line per query for logs and CI output. */
export function describe(name: string, a: PlanAnalysis, violations: Violation[]): string {
  const scans = a.scans.map((s) => `${s.node.replace(' Scan', '')}:${s.relation}`).join(', ');
  return `${violations.length ? 'FAIL' : 'ok  '} ${name} — ${a.executionMs?.toFixed(1) ?? '?'} ms, cost ${Math.round(a.totalCost)}, ${scans || 'no scans'}${violations.length ? ' | ' + violations.map((x) => `${x.rule}: ${x.detail}`).join('; ') : ''}`;
}
