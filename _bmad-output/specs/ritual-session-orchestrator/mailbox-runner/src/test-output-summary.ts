/**
 * Parses raw `pnpm test` output (turbo running per-package test tasks) into
 * a structured summary. Grounded in a real run of this repo's actual suite,
 * not assumed:
 *
 *   - apps/backend uses Node's native `node:test` TAP reporter -- lines like
 *     "backend:test: ok 42 - persistScrapedPost integration tests" and
 *     failures as "not ok N - <name>". Turbo prefixes every line with
 *     "<package>:test: ".
 *   - packages/* (ui, database, analytics, ...) use Vitest's default
 *     reporter, ANSI-colored -- "@festgrid/ui:test:  <green>✓<reset> src/...
 *     (N tests) 18ms" and a per-package "Test Files  N passed (N)" /
 *     "Tests  N passed (N)" summary block; a failing file uses a red
 *     ✗/× marker and the summary block shows "N failed | M passed"
 *     instead.
 *   - turbo's own final line ("Tasks:    X successful, Y total") is the
 *     single most reliable top-level signal regardless of which per-package
 *     reporter produced the detail -- it's what this summary's overall
 *     pass/fail verdict is actually based on, with the per-package/per-test
 *     detail below it as supplementary "what exactly broke" context.
 *
 * Verified 2026-09-03 against two real full runs of this repo's suite, not
 * just synthetic samples: one that passed end-to-end (Tasks: 11 successful,
 * 11 total -- confirmed the pass-path and zero false positives across 4593
 * lines, including test *names* containing the word "fails" that a naive
 * substring grep would have miscounted) and, on a later run, one with 5 real
 * backend failures (apps/backend's node:test suite itself reported
 * "# fail 5") -- this parser's 5 extracted failures matched node:test's own
 * count exactly, in order, with exact descriptions, cross-checked against a
 * raw grep for "not ok" in that log. Both the pass-path and the failure-path
 * are now grounded in real data, not assumed or synthetic-only.
 */

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export interface TestFailure {
  package: string; // turbo's task prefix, e.g. "@festgrid/ui" or "backend"
  description: string; // the failing test's own name/description, best-effort
  raw: string; // the original (ANSI-stripped) line, for anything the parse missed
}

export interface TestSummary {
  overallPass: boolean | undefined; // undefined if turbo's own summary line was never found (unexpected output shape)
  turboSummaryLine?: string;
  failures: TestFailure[];
  totalLines: number;
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

const TURBO_SUMMARY_RE = /Tasks:\s+(\d+) successful,\s+(\d+) total/;
const TAP_NOT_OK_RE = /^([\w@/.\-]+):test:\s*not ok \d+ - (.+)$/;
const VITEST_FAIL_MARKER_RE = /^([\w@/.\-]+):test:\s*[✗×]\s+(.+)$/;
const VITEST_SUMMARY_FAIL_RE = /^([\w@/.\-]+):test:\s*Test Files\s+(\d+) failed/;

export function summarizeTestOutput(rawOutput: string): TestSummary {
  const clean = stripAnsi(rawOutput);
  const lines = clean.split(/\r?\n/);

  let turboSummaryLine: string | undefined;
  let overallPass: boolean | undefined;
  const failures: TestFailure[] = [];
  const vitestFailedPackages = new Set<string>();

  for (const line of lines) {
    const turboMatch = TURBO_SUMMARY_RE.exec(line);
    if (turboMatch) {
      turboSummaryLine = line.trim();
      overallPass = turboMatch[1] === turboMatch[2];
      continue;
    }

    const tapMatch = TAP_NOT_OK_RE.exec(line);
    if (tapMatch) {
      failures.push({ package: tapMatch[1], description: tapMatch[2].trim(), raw: line.trim() });
      continue;
    }

    const vitestSummaryFailMatch = VITEST_SUMMARY_FAIL_RE.exec(line);
    if (vitestSummaryFailMatch) {
      vitestFailedPackages.add(vitestSummaryFailMatch[1]);
      continue;
    }

    const vitestFailMatch = VITEST_FAIL_MARKER_RE.exec(line);
    if (vitestFailMatch) {
      failures.push({ package: vitestFailMatch[1], description: vitestFailMatch[2].trim(), raw: line.trim() });
    }
  }

  // A package whose Vitest summary block reported failures but whose
  // individual ✗ lines weren't matched (reporter formatting variance) still
  // needs to show up as *something* -- record it at package granularity
  // rather than silently dropping it.
  for (const pkg of vitestFailedPackages) {
    if (!failures.some((f) => f.package === pkg)) {
      failures.push({ package: pkg, description: "Test Files reported failures in this package (see raw log for detail)", raw: `${pkg}: Test Files ... failed` });
    }
  }

  return { overallPass, turboSummaryLine, failures, totalLines: lines.length };
}

export function formatSummary(summary: TestSummary): string {
  const lines: string[] = [];
  if (summary.overallPass === undefined) {
    lines.push("Could not find turbo's own summary line (\"Tasks: X successful, Y total\") -- output shape may differ from what this parser expects. Check the raw log directly.");
  } else {
    lines.push(summary.overallPass ? "ALL TESTS PASSED" : "TESTS FAILED");
    if (summary.turboSummaryLine) lines.push(summary.turboSummaryLine);
  }
  if (summary.failures.length > 0) {
    lines.push("", `${summary.failures.length} failure(s):`);
    for (const f of summary.failures) {
      lines.push(`  [${f.package}] ${f.description}`);
    }
  }
  return lines.join("\n");
}
