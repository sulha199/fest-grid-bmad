/**
 * Pre-flight sanity checks run before a "test" check kind, so an environment
 * problem fails fast with a clear message instead of masquerading as 300+
 * per-test ECONNREFUSED failures (or, worse, corrupting the local DB mid-run).
 *
 * Why this exists: ../README.md's Resume section documents two real,
 * recurring failures this session hit running the full monorepo suite --
 * (1) the native Windows `postgresql-x64-18` service crashing under
 * WAL/checkpoint write pressure, correlated with the C: drive sitting at
 * 92-95% full (14GB free when it first crashed; still saw a different
 * Postgres-side error at 21GB free, so headroom matters even above the
 * literal crash point), and (2) the service simply not running yet turning
 * into a cascade of per-test ECONNREFUSED failures that reads like hundreds
 * of independent test bugs rather than one environment problem. Both are
 * cheap to catch before spending 15+ minutes running a doomed suite.
 *
 * Deliberately narrow: a raw TCP connect to the DB host:port (not a real
 * Postgres handshake -- no query, no auth, no new dependency) and a
 * PowerShell `Get-PSDrive` free-space read on the drive `--cwd` lives on. A
 * query that can't be run (PowerShell missing, cwd not on a lettered drive)
 * is treated as a non-fatal skip, not a hard failure -- this is a sanity
 * check for a known recurring failure mode, not a general-purpose health
 * monitor, and it should never be the reason a check can't run at all.
 */
import net from "node:net";
import { execFile } from "node:child_process";
import path from "node:path";
import { loadDotEnv } from "./load-env.js";

export interface PreflightCheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface PreflightResult {
  ok: boolean;
  problems: string[]; // detail strings for checks that failed (empty if ok)
  checks: PreflightCheckResult[];
}

const DB_CONNECT_TIMEOUT_MS = 3000;

/**
 * Extracts a real message from a connect error. Found by live testing
 * against a real refused port (2026-09-13): Node's `net.connect` does
 * Happy Eyeballs (parallel IPv4/IPv6 attempts) and on refusal throws an
 * `AggregateError` whose own top-level `.message` is empty -- the actual
 * "connect ECONNREFUSED ..." text is only inside `.errors[]`. Without this,
 * every refused-connection failure printed a useless "failed ()" with no
 * indication of what actually happened.
 */
function describeConnectError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; errors?: unknown[] };
    if (Array.isArray(e.errors) && e.errors.length > 0) {
      return e.errors.map((sub) => (sub instanceof Error ? sub.message : String(sub))).join("; ");
    }
    if (e.message) return e.message;
    if (e.code) return e.code;
  }
  return String(err);
}
// 14GB free is the exact level at which postgresql-x64-18 crashed twice this
// session (2026-09-12, Stories 3.4r/3.6l); 21GB free (92% full) still surfaced
// a different Postgres-side error afterward, so this threshold sits above
// both observed data points rather than exactly at the known-bad line.
const MIN_FREE_DISK_GB = 15;

function checkDbReachable(): Promise<PreflightCheckResult> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Promise.resolve({ name: "database", ok: true, detail: "DATABASE_URL not set -- skipping (nothing to check)" });
  }

  let host: string;
  let port: number;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parsed.port ? Number(parsed.port) : 5432;
  } catch (err) {
    return Promise.resolve({
      name: "database",
      ok: false,
      detail: `DATABASE_URL is not a parseable URL: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: DB_CONNECT_TIMEOUT_MS });
    let settled = false;
    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ name: "database", ok, detail });
    };
    socket.once("connect", () => finish(true, `TCP connect to ${host}:${port} succeeded`));
    socket.once("timeout", () =>
      finish(
        false,
        `TCP connect to ${host}:${port} timed out after ${DB_CONNECT_TIMEOUT_MS}ms -- is the postgresql-x64-18 service running? ("Get-Service postgresql-x64-18" in an elevated shell)`
      )
    );
    socket.once("error", (err) =>
      finish(
        false,
        `TCP connect to ${host}:${port} failed (${describeConnectError(err)}) -- is the postgresql-x64-18 service running? ("Get-Service postgresql-x64-18" in an elevated shell)`
      )
    );
  });
}

function driveLetterFor(cwd: string): string | undefined {
  const match = /^([A-Za-z]):/.exec(path.resolve(cwd));
  return match ? match[1].toUpperCase() : undefined;
}

function checkDiskSpace(cwd: string): Promise<PreflightCheckResult> {
  const drive = driveLetterFor(cwd);
  if (!drive) {
    return Promise.resolve({ name: "disk-space", ok: true, detail: `could not determine a drive letter from "${cwd}" -- skipping` });
  }

  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-Command", `(Get-PSDrive ${drive}).Free`],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve({ name: "disk-space", ok: true, detail: `could not query free space on ${drive}: (non-fatal) ${err.message}` });
          return;
        }
        const freeBytes = Number(stdout.trim());
        if (!Number.isFinite(freeBytes)) {
          resolve({ name: "disk-space", ok: true, detail: `unexpected Get-PSDrive output "${stdout.trim()}" -- skipping (non-fatal)` });
          return;
        }
        const freeGb = freeBytes / 1024 ** 3;
        const ok = freeGb >= MIN_FREE_DISK_GB;
        resolve({
          name: "disk-space",
          ok,
          detail: ok
            ? `${drive}: has ${freeGb.toFixed(1)}GB free (>= ${MIN_FREE_DISK_GB}GB minimum)`
            : `${drive}: only ${freeGb.toFixed(1)}GB free (< ${MIN_FREE_DISK_GB}GB minimum) -- Postgres has crashed under WAL/checkpoint write pressure at this level before (see ../README.md)`,
        });
      }
    );
  });
}

export async function checkPreflight(cwd: string): Promise<PreflightResult> {
  loadDotEnv(cwd);
  const checks = await Promise.all([checkDbReachable(), checkDiskSpace(cwd)]);
  const problems = checks.filter((c) => !c.ok).map((c) => c.detail);
  return { ok: problems.length === 0, problems, checks };
}

export function formatPreflightFailure(result: PreflightResult): string {
  const failed = result.checks.filter((c) => !c.ok);
  return [
    "[preflight] FAILED -- refusing to start the test suite (this would otherwise likely cascade into a large batch of ECONNREFUSED/timeout failures, or worse, run against a DB mid-crash):",
    ...failed.map((c) => `  - ${c.name}: ${c.detail}`),
    'See ../README.md\'s Resume section ("Local Postgres crashing under full-suite test load") for the incident this guards against.',
  ].join("\n");
}
