/**
 * Parses raw `pnpm build` / `pnpm lint` output (turbo running per-package
 * build/lint tasks) into a structured summary. Grounded in real triggered
 * failures against this repo (2026-09-04), not assumed:
 *
 *   - build: each package runs `tsc`, turbo-prefixed "<pkg>:build: ". A real
 *     type error surfaced as:
 *       "@festgrid/domain:build: src/foo.ts(1,14): error TS2322: Type
 *       'string' is not assignable to type 'number'."
 *   - lint: each package runs `eslint .` (several with `--max-warnings 0`),
 *     turbo-prefixed "<pkg>:lint: ". A real violation surfaced as:
 *       "@festgrid/domain:lint:   1:7  warning  'x' is assigned a value but
 *       never used  @typescript-eslint/no-unused-vars"
 *     followed by a per-package "<pkg>:lint: ✖ N problems (X errors, Y
 *     warnings)" summary line, and -- when a `--max-warnings 0` package hits
 *     any warnings at all -- "<pkg>:lint: ESLint found too many warnings
 *     (maximum: 0)." even though every individual line was only "warning"
 *     severity.
 *   - turbo marks each failed task on its own line regardless of build/lint:
 *     "Failed:    @festgrid/domain#build" -- this is the most reliable
 *     signal of *which* package/task actually failed, cross-checked against
 *     turbo's "Tasks: X successful, Y total" summary line (same overall
 *     verdict signal as test-output-summary.ts uses).
 *
 * Verified live, 2026-09-04, against two real triggered failures in this
 * repo (a genuine `tsc` type error and a genuine `--max-warnings 0` breach,
 * each via a throwaway probe file, reverted after capturing the output) --
 * not synthetic samples.
 */

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export interface BuildLintFailure {
  package: string; // turbo's task prefix, e.g. "@festgrid/domain"
  description: string;
  raw: string;
}

export interface BuildLintSummary {
  overallPass: boolean | undefined; // undefined if turbo's own summary line was never found
  turboSummaryLine?: string;
  failedTargets: string[]; // e.g. ["@festgrid/domain#build"]
  failures: BuildLintFailure[];
  totalLines: number;
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

const TURBO_SUMMARY_RE = /Tasks:\s+(\d+) successful,\s+(\d+) total/;
const FAILED_TARGET_RE = /^Failed:\s+(.+)$/;
const TSC_ERROR_RE = /^([\w@/.\-]+):build:\s*(\S.*\(\d+,\d+\):\s*error\s+TS\d+:.*)$/;
const ESLINT_ERROR_LINE_RE = /^([\w@/.\-]+):lint:\s+\d+:\d+\s+error\s+(.+)$/;
const ESLINT_PROBLEMS_RE = /^([\w@/.\-]+):lint:\s*✖\s*(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/;
const ESLINT_TOO_MANY_WARNINGS_RE = /^([\w@/.\-]+):lint:\s*ESLint found too many warnings/;

export function summarizeBuildOrLintOutput(rawOutput: string): BuildLintSummary {
  const clean = stripAnsi(rawOutput);
  const lines = clean.split(/\r?\n/);

  let turboSummaryLine: string | undefined;
  let overallPass: boolean | undefined;
  const failedTargets: string[] = [];

  // First pass: find turbo's own verdict and exactly which targets it says
  // failed. A passing package can still print an eslint "N problems (0
  // errors, N warnings)" summary line (warnings alone don't fail a task
  // without --max-warnings 0) -- so diagnostic lines must be attributed only
  // to packages turbo itself marked failed, not to every package that
  // merely printed output. Found as a real false positive live: `backend`
  // passed with 1032 warnings while only `@festgrid/domain` actually failed,
  // and a single-pass version wrongly flagged both.
  for (const line of lines) {
    const turboMatch = TURBO_SUMMARY_RE.exec(line);
    if (turboMatch) {
      turboSummaryLine = line.trim();
      overallPass = turboMatch[1] === turboMatch[2];
      continue;
    }
    const failedMatch = FAILED_TARGET_RE.exec(line);
    if (failedMatch) {
      failedTargets.push(failedMatch[1].trim());
    }
  }

  // Empty failedTargets with a known-failing verdict means turbo's "Failed:"
  // line wasn't found (output shape may differ) -- fall back to attributing
  // diagnostics to every package rather than silently dropping all detail.
  const restrictToFailedPackages = failedTargets.length > 0;
  const failedPackages = new Set(failedTargets.map((t) => t.split("#")[0]));

  const failures: BuildLintFailure[] = [];
  const reportedPackages = new Set<string>();

  for (const line of lines) {
    const tscMatch = TSC_ERROR_RE.exec(line);
    if (tscMatch && (!restrictToFailedPackages || failedPackages.has(tscMatch[1]))) {
      failures.push({ package: tscMatch[1], description: tscMatch[2].trim(), raw: line.trim() });
      reportedPackages.add(tscMatch[1]);
      continue;
    }

    const eslintErrorMatch = ESLINT_ERROR_LINE_RE.exec(line);
    if (eslintErrorMatch && (!restrictToFailedPackages || failedPackages.has(eslintErrorMatch[1]))) {
      failures.push({ package: eslintErrorMatch[1], description: eslintErrorMatch[2].trim(), raw: line.trim() });
      reportedPackages.add(eslintErrorMatch[1]);
      continue;
    }

    const problemsMatch = ESLINT_PROBLEMS_RE.exec(line);
    if (problemsMatch && Number(problemsMatch[3]) === 0 && restrictToFailedPackages && failedPackages.has(problemsMatch[1])) {
      // Zero real errors but the package still failed the task (e.g. a
      // --max-warnings 0 threshold breach) -- the per-line "error" regex
      // above found nothing, so this summary line is the only signal.
      failures.push({ package: problemsMatch[1], description: `${problemsMatch[2]} problem(s), 0 errors, ${problemsMatch[4]} warning(s) -- likely a --max-warnings threshold breach`, raw: line.trim() });
      reportedPackages.add(problemsMatch[1]);
      continue;
    }

    const tooManyWarningsMatch = ESLINT_TOO_MANY_WARNINGS_RE.exec(line);
    if (tooManyWarningsMatch && (!restrictToFailedPackages || failedPackages.has(tooManyWarningsMatch[1])) && !reportedPackages.has(tooManyWarningsMatch[1])) {
      failures.push({ package: tooManyWarningsMatch[1], description: line.trim(), raw: line.trim() });
      reportedPackages.add(tooManyWarningsMatch[1]);
    }
  }

  // A failed target with no individual diagnostic line matched (reporter
  // formatting variance) still needs to show up as *something* rather than
  // silently vanishing from the summary.
  for (const target of failedTargets) {
    const pkg = target.split("#")[0];
    if (!reportedPackages.has(pkg)) {
      failures.push({ package: pkg, description: "Task failed but no individual diagnostic line was matched -- see raw log.", raw: `Failed:    ${target}` });
    }
  }

  return { overallPass, turboSummaryLine, failedTargets, failures, totalLines: lines.length };
}

export function formatBuildLintSummary(kind: "build" | "lint", summary: BuildLintSummary): string {
  const lines: string[] = [];
  if (summary.overallPass === undefined) {
    lines.push(`Could not find turbo's own summary line ("Tasks: X successful, Y total") -- output shape may differ from what this parser expects. Check the raw log directly.`);
  } else {
    lines.push(summary.overallPass ? `ALL ${kind.toUpperCase()} TASKS PASSED` : `${kind.toUpperCase()} FAILED`);
    if (summary.turboSummaryLine) lines.push(summary.turboSummaryLine);
  }
  if (summary.failedTargets.length > 0) {
    lines.push("", `Failed targets: ${summary.failedTargets.join(", ")}`);
  }
  if (summary.failures.length > 0) {
    lines.push("", `${summary.failures.length} diagnostic(s):`);
    for (const f of summary.failures) {
      lines.push(`  [${f.package}] ${f.description}`);
    }
  }
  return lines.join("\n");
}
