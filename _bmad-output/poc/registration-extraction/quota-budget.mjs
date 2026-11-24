// POC: shared request budget and pacing for every replay script (free-tier limits seen: 500 requests per day per project and model, counted per
// Pacific-time day; 15 requests per minute; 250K tokens per minute). State: private/quota-counter.json {day, n, tag, lastAt}.
//   - tag is a short non-reversible hash of the API key in use, so a NEW key (a new project, a fresh daily allowance) starts from zero by itself.
//   - Every ATTEMPT (retries included) claims one call; at the budget claimCall() returns ok:false and the scripts exit with code 3 (same as a real 429).
//   - Calls are paced to at least MIN_GAP_MS apart (15 RPM = 4,000 ms; 4,200 ms leaves a margin). Replays here send about 8-10K tokens per call, so
//     14 calls a minute stays near 130K TPM, under the 250K limit.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const FILE = process.env.QUOTA_FILE || 'private/quota-counter.json'; // QUOTA_FILE: only for the test of the lock
export const BUDGET = Number(process.env.GEMINI_DAILY_BUDGET || 440); // 500 limit minus a margin for retries and a few manual probes
export const MIN_GAP_MS = Number(process.env.GEMINI_MIN_GAP_MS || 4200);
export const ptDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d); // YYYY-MM-DD in Pacific time
const keyTag = () => createHash('sha256').update(process.env.SYSTEM_GEMINI_API_KEY ?? '').digest('hex').slice(0, 10);
const sleepSync = (ms) => { if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };

export function readCounter() {
  const today = ptDay(), tag = keyTag();
  if (!existsSync(FILE)) return { day: today, n: 0, tag, lastAt: 0 };
  try { const j = JSON.parse(readFileSync(FILE, 'utf8')); return j.day === today && j.tag === tag ? j : { day: today, n: 0, tag, lastAt: 0 }; } catch { return { day: today, n: 0, tag, lastAt: 0 }; }
}
// Two replay processes at the same time (an orphan of a stopped job, a second chain) used to read the same count, both add one and write it back: increments were
// lost and the pacing was not shared. The whole read, wait and write now runs under a lock (an atomic mkdir); a lock older than 20 s is taken over (a crashed process).
function withLock(fn) {
  const lock = `${FILE}.lock`, t0 = Date.now();
  for (;;) {
    try { mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() - t0 > 20000) { try { rmSync(lock, { recursive: true }); } catch { /* another process took it over */ } }
      sleepSync(25);
    }
  }
  try { return fn(); } finally { try { rmSync(lock, { recursive: true }); } catch { /* already gone */ } }
}
export function claimCall() {
  return withLock(() => {
    const c = readCounter();
    if (c.n >= BUDGET) return { ok: false, n: c.n, budget: BUDGET };
    sleepSync((c.lastAt ?? 0) + MIN_GAP_MS - Date.now());
    c.n += 1; c.lastAt = Date.now(); writeFileSync(FILE, JSON.stringify(c));
    return { ok: true, n: c.n, budget: BUDGET };
  });
}
