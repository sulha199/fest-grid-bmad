#!/usr/bin/env tsx
/**
 * Gathers real posts for the audience, language and taxonomy POC (event-insight-poc/audience-and-taxonomy-poc-plan-2026-10-21.md).
 * RUNS ON THE OWNER'S MACHINE ONLY. Everything it writes goes to a git-ignored folder; no caption is ever printed.
 *
 * Order of work, per account:
 *   1. production database, READ ONLY: find the account's profile and its successful scraper runs (`scraper_actor_runs`), and read the stored
 *      `raw_output` of the newest runs;
 *   2. the vendor, GET only (no new billing): a run with no stored output is downloaded again by its Bright Data snapshot id / Apify run id;
 *   3. a NEW scrape (Bright Data), only for what is still short, only after the owner types the number of accounts to confirm, and never with the
 *      application's production webhook, so nothing is ingested into production.
 * Accounts the production database does not know (Malay-language, non-Indonesian, expat) are asked for and kept in a local file; they need step 3.
 *
 *   cd apps/backend
 *   PROD_RO2_DATABASE_URL=... npx tsx scripts/poc-event-insight/fetch-poc-posts.ts            (asks questions)
 *   npx tsx scripts/poc-event-insight/fetch-poc-posts.ts --help
 *
 * Safety, all enforced in code:
 *   - the database URL is read only from PROD_RO2_DATABASE_URL (or the variable named by --db-env), never from DATABASE_URL or a .env file, and
 *     every statement must pass assertReadOnlySql inside a READ ONLY transaction;
 *   - only the vendor keys in ENV_WHITELIST are read from a .env file (the rest of that file is never parsed into memory) and no value is printed;
 *   - the output folder must be git-ignored (checked with `git check-ignore`) or outside any repository;
 *   - a vendor whose kill switch (BRIGHTDATA_SCRAPING_CONFIRMED / APIFY_SCRAPING_CONFIRMED) is false is not called.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import postgres from 'postgres';
import { assertReadOnlySql, describeTarget } from './readonly-policy.js';
import {
  buildBrightDataTrigger, capPerAccount, emptyRunLog, ENV_WHITELIST, estimateCostUsd, inWindow, knownSnapshotIds, mergeByUrl, needsMore,
  parseAccountList, parseDotenvWhitelist, recordsFromRawOutput, reduceRecord, vendorAllowed, type PocPost, type RunLog, type RunLogEntry,
} from './poc-posts-lib.js';

// ---------------------------------------------------------------------------------------------------------------------------------------
// arguments

interface Args {
  since: string; perAccount: number; curators: number; venues: number; accounts: string[]; extra: string[]; extraLabel: string;
  noScrape: boolean; confirmScrape: number | null; outDir: string; envFile: string | null; dbEnv: string; yes: boolean; help: boolean;
  vendor: 'brightdata' | 'apify';
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    since: new Date(Date.now() - 60 * 86_400_000).toISOString(), perAccount: 15, curators: 8, venues: 6, accounts: [], extra: [], extraLabel: 'extra',
    noScrape: false, confirmScrape: null, outDir: join(dirname(fileURLToPath(import.meta.url)), 'local'), envFile: null, dbEnv: 'PROD_RO2_DATABASE_URL',
    yes: false, help: false, vendor: 'brightdata',
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--since') a.since = new Date(v()).toISOString();
    else if (k === '--per-account') a.perAccount = Math.max(1, parseInt(v(), 10));
    else if (k === '--curators') a.curators = Math.max(0, parseInt(v(), 10));
    else if (k === '--venues') a.venues = Math.max(0, parseInt(v(), 10));
    else if (k === '--accounts') a.accounts = parseAccountList(v()).valid;
    else if (k === '--extra') a.extra = parseAccountList(v()).valid;
    else if (k === '--extra-label') a.extraLabel = v();
    else if (k === '--no-scrape') a.noScrape = true;
    else if (k === '--confirm-scrape') a.confirmScrape = parseInt(v(), 10);
    else if (k === '--out-dir') a.outDir = resolve(v());
    else if (k === '--env-file') a.envFile = resolve(v());
    else if (k === '--db-env') a.dbEnv = v();
    else if (k === '--yes') a.yes = true;
    else if (k === '--vendor') { const x = v(); if (x !== 'brightdata' && x !== 'apify') throw new Error('--vendor must be brightdata or apify'); a.vendor = x; }
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`unknown argument: ${k}`);
  }
  return a;
}

const HELP = `fetch-poc-posts.ts: gather real posts for the audience/language/taxonomy POC, on your machine only.

  --since <date>          oldest post date to keep (default: 60 days ago)
  --per-account <n>       posts wanted per account (default 15)
  --curators <n>          how many curator accounts to offer from the database (default 8)
  --venues <n>            how many venue accounts to offer from the database (default 6)
  --accounts a,b,c        take these database accounts instead of asking
  --extra a,b,c           accounts the database does not know (Malay, non-Indonesian, expat); needs a new scrape
  --extra-label <text>    stratum label for --extra (default "extra")
  --no-scrape             never start a new scrape
  --confirm-scrape <n>    confirm a new scrape of exactly n accounts without asking
  --vendor <name>         vendor for a NEW scrape: brightdata (default) or apify (apify/instagram-api-scraper; price from APIFY_PRICE_PER_THOUSAND_RESULTS_USD, default 2.3)
  --out-dir <path>        output folder (default scripts/poc-event-insight/local, git-ignored)
  --env-file <path>       .env to read the vendor keys from (default: nearest .env above the current folder)
  --db-env <NAME>         environment variable holding the read-only database URL (default PROD_RO2_DATABASE_URL)
  --yes                   accept the top candidates without asking
`;

// ---------------------------------------------------------------------------------------------------------------------------------------
// small helpers

const log = (s: string) => process.stdout.write(s + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ensureIgnoredOutputDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const r = spawnSync('git', ['check-ignore', '-q', dir], { cwd: dir });
  if (r.status === 1) throw new Error(`the output folder ${dir} is inside a git repository and is NOT git-ignored. Refusing to write third-party captions there.`);
}

function findEnvFile(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    const f = join(dir, '.env');
    if (existsSync(f)) return f;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const readJson = <T>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback);

interface PickedAccount { username: string; source: 'db' | 'extra'; stratum: string }
interface OutPost extends PocPost { account: string; stratum: string; fetchedFrom: RunLogEntry['source'] }

// ---------------------------------------------------------------------------------------------------------------------------------------
// read-only database access

type Q = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

function readOnlyQuery(url: string): { q: Q; end: () => Promise<void> } {
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 20, onnotice: () => {} });
  const q: Q = async (text, params = []) => {
    assertReadOnlySql(text);
    return sql.begin('read only', async (tx) => {
      await tx.unsafe("set local statement_timeout = '60s'");
      return (await tx.unsafe(text, params as never[])) as unknown as Record<string, unknown>[];
    }) as Promise<Record<string, unknown>[]>;
  };
  return { q, end: () => sql.end({ timeout: 5 }) };
}

export const CANDIDATES_SQL = `select p.id::text as id, p.username, coalesce(p.account_type::text, '(unclassified)') as account_type,
  count(r.id) filter (where r.status = 'SUCCEEDED')::int as ok_runs,
  coalesce(sum(r.item_count) filter (where r.status = 'SUCCEEDED'), 0)::int as items,
  max(r.completed_at) filter (where r.status = 'SUCCEEDED') as last_ok
from social_media_account_profiles p left join scraper_actor_runs r on r.profile_id = p.id
where lower(p.platform::text) = 'instagram' and ($1::text is null or p.account_type::text = $1)
group by p.id, p.username, p.account_type
having count(r.id) filter (where r.status = 'SUCCEEDED') > 0
order by max(r.completed_at) filter (where r.status = 'SUCCEEDED') desc nulls last
limit $2::int`;

export const RUNS_SQL = `select r.id::text as id, r.vendor::text as vendor, r.run_id, r.item_count, r.completed_at, (r.raw_output is not null) as has_raw
from scraper_actor_runs r join social_media_account_profiles p on p.id = r.profile_id
where lower(p.username) = lower($1) and lower(p.platform::text) = 'instagram' and r.status = 'SUCCEEDED'
order by r.completed_at desc nulls last
limit 12`;

export const RAW_SQL = `select raw_output from scraper_actor_runs where id = $1::uuid`;

// ---------------------------------------------------------------------------------------------------------------------------------------
// vendors (the application's own client is not used: it takes the production webhook and reads the whole .env)

async function brightDataGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.brightdata.com/datasets/v3/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Bright Data ${path.split('/')[0]} answered ${res.status}`);
  return res.json();
}

async function brightDataDownload(snapshotId: string, token: string): Promise<unknown[]> {
  const p = (await brightDataGet(`progress/${snapshotId}`, token)) as { status?: string };
  if (p.status !== 'ready') throw new Error(`snapshot not ready (${p.status ?? 'unknown'})`);
  const data = await brightDataGet(`snapshot/${snapshotId}?format=json`, token);
  return Array.isArray(data) ? data : [];
}

async function brightDataScrape(env: Record<string, string>, username: string, n: number, since: string, onSnapshot: (id: string) => void): Promise<{ snapshotId: string; records: unknown[] }> {
  const token = env.BRIGHTDATA_API_TOKEN;
  const datasetId = env.BRIGHTDATA_DATASET_ID || 'gd_lk5ns7kz21pck8jpis';
  const req = buildBrightDataTrigger(datasetId, username, n, since);
  const res = await fetch(req.url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: req.body, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Bright Data trigger answered ${res.status}`);
  const snapshotId = ((await res.json()) as { snapshot_id?: string }).snapshot_id;
  if (!snapshotId) throw new Error('Bright Data trigger returned no snapshot id');
  onSnapshot(snapshotId); // recorded before polling: a crash must not lose a snapshot that was already paid for
  for (let i = 0; i < 120; i++) {
    await sleep(10_000);
    const p = (await brightDataGet(`progress/${snapshotId}`, token)) as { status?: string };
    if (p.status === 'ready') return { snapshotId, records: await brightDataDownload(snapshotId, token) };
    if (p.status === 'failed') throw new Error('Bright Data snapshot failed');
  }
  throw new Error('Bright Data snapshot did not finish in 20 minutes; run again later, it will be downloaded by id');
}

/** A new Apify scrape of one account (no webhook, nothing reaches production). The run id is recorded before the items are read, so a re-run can fetch it again. */
async function apifyScrape(token: string, username: string, n: number, since: string, onRun: (id: string) => void): Promise<{ runId: string; records: unknown[] }> {
  const { ApifyClient } = await import('apify-client');
  const client = new ApifyClient({ token });
  const run = await client.actor('apify/instagram-api-scraper').start({ directUrls: [`https://www.instagram.com/${username}/`], resultsType: 'posts', resultsLimit: n, onlyPostsNewerThan: since });
  onRun(run.id);
  const done = await client.run(run.id).waitForFinish({ waitSecs: 600 });
  if (done.status !== 'SUCCEEDED') throw new Error(`Apify run ended ${done.status}`);
  const { items } = await client.dataset(done.defaultDatasetId).listItems({ clean: true, limit: 1000 });
  return { runId: run.id, records: items as unknown[] };
}

async function apifyRunItems(runId: string, token: string): Promise<unknown[]> {
  const { ApifyClient } = await import('apify-client');
  const client = new ApifyClient({ token });
  const run = await client.run(runId).get();
  if (!run || run.status !== 'SUCCEEDED') return [];
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true, limit: 1000 });
  return items as unknown[];
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// main

function pickIndexes(answer: string, max: number, fallbackCount: number): number[] {
  const t = answer.trim();
  if (!t) return Array.from({ length: Math.min(fallbackCount, max) }, (_, i) => i);
  const out = new Set<number>();
  for (const part of t.split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = parseInt(m[1], 10); i <= parseInt(m[2], 10); i++) out.add(i - 1);
    else if (/^\d+$/.test(part)) out.add(parseInt(part, 10) - 1);
  }
  return [...out].filter((i) => i >= 0 && i < max).sort((a, b) => a - b);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { log(HELP); return; }
  ensureIgnoredOutputDir(args.outDir);
  const files = {
    accounts: join(args.outDir, 'poc-accounts.local.json'),
    posts: join(args.outDir, 'poc-posts.local.json'),
    runlog: join(args.outDir, 'poc-run-log.local.json'),
  };

  // vendor keys: the process environment first, then only the whitelisted keys of a .env file
  const envFile = args.envFile ?? findEnvFile(process.cwd());
  const fromFile = envFile && existsSync(envFile) ? parseDotenvWhitelist(readFileSync(envFile, 'utf8')) : {};
  const env: Record<string, string> = {};
  for (const k of ENV_WHITELIST) { const v = process.env[k] ?? fromFile[k]; if (v) env[k] = v; }
  log(`vendor keys: Bright Data ${env.BRIGHTDATA_API_TOKEN ? 'found' : 'not found'}, Apify ${env.APIFY_API_TOKEN ? 'found' : 'not found'} (values are never printed)`);
  const bdOk = Boolean(env.BRIGHTDATA_API_TOKEN) && vendorAllowed(env.BRIGHTDATA_SCRAPING_CONFIRMED);
  const apifyOk = Boolean(env.APIFY_API_TOKEN) && vendorAllowed(env.APIFY_SCRAPING_CONFIRMED);

  // database
  const dbUrl = process.env[args.dbEnv];
  if (!dbUrl) throw new Error(`${args.dbEnv} is not set. Set it to the READ-ONLY connection string; this script never uses DATABASE_URL or a .env database URL.`);
  if (process.env.DATABASE_URL && dbUrl === process.env.DATABASE_URL) throw new Error(`${args.dbEnv} equals DATABASE_URL (the application's own URL). Use the read-only role.`);
  log(`database (read only): ${describeTarget(dbUrl)}`);
  const db = readOnlyQuery(dbUrl);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q: string): Promise<string> => (args.yes ? '' : (await rl.question(q + ' ')).trim());

  try {
    // ---- 1. accounts
    const previous = readJson<{ accounts: PickedAccount[] }>(files.accounts, { accounts: [] }).accounts;
    let picked: PickedAccount[] = [];
    if (args.accounts.length || args.extra.length) {
      picked = [...args.accounts.map((username) => ({ username, source: 'db' as const, stratum: 'chosen' })), ...args.extra.map((username) => ({ username, source: 'extra' as const, stratum: args.extraLabel }))];
    } else {
      if (previous.length && (await ask(`Use the ${previous.length} accounts saved in ${files.accounts}? [y/N]`)).toLowerCase() === 'y') picked = previous;
      else {
        for (const [type, label, count] of [['CURATOR_GUIDE', 'curator', args.curators], ['ORGANIZER_VENUE_EVENT', 'venue', args.venues]] as const) {
          if (count === 0) continue;
          const rows = await db.q(CANDIDATES_SQL, [type, 30]);
          log(`\n${label} accounts with successful scrapes (newest first):`);
          rows.forEach((r, i) => log(`  ${String(i + 1).padStart(2)}. ${String(r.username).padEnd(28)} runs ${String(r.ok_runs).padStart(3)}  items ${String(r.items).padStart(5)}  last ${r.last_ok ? new Date(r.last_ok as string).toISOString().slice(0, 10) : '-'}`));
          const ans = await ask(`Pick ${label} accounts (e.g. 1,2,5-7; Enter = the first ${count}):`);
          for (const i of pickIndexes(ans, rows.length, count)) picked.push({ username: String(rows[i].username).toLowerCase(), source: 'db', stratum: label });
        }
        const more = await ask('\nOther accounts the database does not know (Malay-language, non-Indonesian, expat; handles or URLs; Enter = none):');
        if (more) {
          const { valid, invalid } = parseAccountList(more);
          if (invalid.length) log(`ignored (not a username): ${invalid.length}`);
          const label = (await ask('Label for these (e.g. malay, expat, intl; Enter = extra):')) || 'extra';
          for (const username of valid) picked.push({ username, source: 'extra', stratum: label });
        }
      }
    }
    picked = picked.filter((p, i) => picked.findIndex((x) => x.username === p.username) === i);
    if (!picked.length) { log('nothing selected.'); return; }
    writeFileSync(files.accounts, JSON.stringify({ savedAt: new Date().toISOString(), accounts: picked }, null, 2));
    log(`\nselected ${picked.length} accounts, saved to ${files.accounts}`);

    // ---- 2. existing data: stored raw output, then vendor re-download
    const runLog = readJson<RunLog>(files.runlog, emptyRunLog());
    const logEntry = (e: Omit<RunLogEntry, 'at'>) => { runLog.entries.push({ ...e, at: new Date().toISOString() }); writeFileSync(files.runlog, JSON.stringify(runLog, null, 2)); };
    let pool: OutPost[] = readJson<OutPost[]>(files.posts, []);
    const countFor = (username: string) => pool.filter((p) => p.account === username && inWindow(p, args.since)).length;
    const addRecords = (acct: PickedAccount, records: unknown[], source: RunLogEntry['source']) => {
      const reduced = records.map(reduceRecord).filter((p): p is PocPost => p !== null);
      const kept = reduced.filter((p) => inWindow(p, args.since));
      pool = mergeByUrl(pool, kept.map((p) => ({ ...p, account: acct.username, stratum: acct.stratum, fetchedFrom: source })) as OutPost[]) as OutPost[];
      return { fetched: records.length, inWindow: kept.length };
    };

    for (const acct of picked.filter((p) => p.source === 'db')) {
      process.stdout.write(`${acct.username}: `);
      const runs = await db.q(RUNS_SQL, [acct.username]);
      if (!runs.length) { log('no successful run in the database'); continue; }
      let refetched = 0;
      for (const r of runs) {
        if (!needsMore(countFor(acct.username), args.perAccount)) break;
        const vendor = String(r.vendor) as 'APIFY' | 'BRIGHTDATA';
        let records: unknown[] = [];
        let source: RunLogEntry['source'] = 'db-raw';
        if (r.has_raw) {
          const raw = await db.q(RAW_SQL, [r.id]);
          records = recordsFromRawOutput(raw[0]?.raw_output);
        }
        if (!records.length && refetched < 3) {
          refetched += 1;
          try {
            if (vendor === 'BRIGHTDATA' && bdOk) { records = await brightDataDownload(String(r.run_id), env.BRIGHTDATA_API_TOKEN); source = 'vendor-refetch'; }
            else if (vendor === 'APIFY' && apifyOk) { records = await apifyRunItems(String(r.run_id), env.APIFY_API_TOKEN); source = 'vendor-refetch'; }
          } catch (e) { log(`  re-download of one ${vendor} run failed (${(e as Error).message})`); }
        }
        if (!records.length) continue;
        const c = addRecords(acct, records, source);
        logEntry({ username: acct.username, source, vendor, runId: String(r.run_id), fetched: c.fetched, inWindow: c.inWindow, kept: countFor(acct.username) });
      }
      log(`${countFor(acct.username)} posts in the window (wanted ${args.perAccount})`);
    }

    // ---- 3. snapshots a previous run already paid for
    for (const acct of picked) {
      for (const id of knownSnapshotIds(runLog, acct.username)) {
        if (!needsMore(countFor(acct.username), args.perAccount) || !bdOk) break;
        try {
          const c = addRecords(acct, await brightDataDownload(id, env.BRIGHTDATA_API_TOKEN), 'new-scrape');
          log(`${acct.username}: re-downloaded a snapshot paid for earlier (${c.inWindow} in window)`);
        } catch (e) { log(`${acct.username}: earlier snapshot not available (${(e as Error).message})`); }
      }
    }

    // ---- 4. what is still short: plan, confirm, scrape
    const short = picked.filter((p) => needsMore(countFor(p.username), args.perAccount));
    if (short.length) {
      const price = parseFloat(env.BRIGHTDATA_PRICE_PER_THOUSAND_ITEMS_USD ?? '') || 1.5;
      const records = short.length * args.perAccount;
      log(`\nStill short of ${args.perAccount} posts: ${short.map((p) => `${p.username} (${countFor(p.username)})`).join(', ')}`);
      if (args.noScrape) log('--no-scrape: no new scrape will be started.');
      else if (args.vendor === 'apify') {
        const apifyPrice = parseFloat(process.env.APIFY_PRICE_PER_THOUSAND_RESULTS_USD ?? '') || 2.3;
        if (!apifyOk) log(env.APIFY_API_TOKEN ? 'Apify is disabled by APIFY_SCRAPING_CONFIRMED.' : 'No Apify key found: no new scrape is possible.');
        else {
          log(`A new Apify scrape (apify/instagram-api-scraper) of ${short.length} account(s), up to ${records} results, about $${estimateCostUsd(records, apifyPrice)} at $${apifyPrice} per 1,000 results. Nothing is sent to the production webhook.`);
          const answer = args.confirmScrape !== null ? String(args.confirmScrape) : await rl.question(`Type ${short.length} to start the scrape (anything else skips): `);
          if (answer.trim() === String(short.length)) {
            for (const acct of short) {
              try {
                const res = await apifyScrape(env.APIFY_API_TOKEN, acct.username, args.perAccount, args.since, (id) => logEntry({ username: acct.username, source: 'new-scrape', vendor: 'APIFY', runId: id, fetched: 0, inWindow: 0, kept: 0 }));
                const c = addRecords(acct, res.records, 'new-scrape');
                logEntry({ username: acct.username, source: 'new-scrape', vendor: 'APIFY', runId: res.runId, fetched: c.fetched, inWindow: c.inWindow, kept: countFor(acct.username) });
                log(`${acct.username}: scraped, ${c.fetched} returned, ${c.inWindow} in window`);
              } catch (e) { log(`${acct.username}: scrape failed (${(e as Error).message})`); }
            }
          } else log('skipped.');
        }
      }
      else if (!bdOk) log(env.BRIGHTDATA_API_TOKEN ? 'Bright Data is disabled by BRIGHTDATA_SCRAPING_CONFIRMED.' : 'No Bright Data key found: no new scrape is possible.');
      else {
        log(`A new Bright Data scrape of ${short.length} account(s), up to ${records} records, about $${estimateCostUsd(records, price)} at $${price} per 1,000 (set BRIGHTDATA_PRICE_PER_THOUSAND_ITEMS_USD for your rate). Results are fetched by id; nothing is sent to the production webhook.`);
        const answer = args.confirmScrape !== null ? String(args.confirmScrape) : await rl.question(`Type ${short.length} to start the scrape (anything else skips): `);
        if (answer.trim() === String(short.length)) {
          for (const acct of short) {
            try {
              const res = await brightDataScrape(env, acct.username, args.perAccount, args.since, (id) => logEntry({ username: acct.username, source: 'new-scrape', vendor: 'BRIGHTDATA', runId: id, fetched: 0, inWindow: 0, kept: 0 }));
              const c = addRecords(acct, res.records, 'new-scrape');
              logEntry({ username: acct.username, source: 'new-scrape', vendor: 'BRIGHTDATA', runId: res.snapshotId, fetched: c.fetched, inWindow: c.inWindow, kept: countFor(acct.username) });
              log(`${acct.username}: scraped, ${c.inWindow} in window`);
            } catch (e) { log(`${acct.username}: scrape failed (${(e as Error).message})`); }
          }
        } else log('skipped.');
      }
    }

    // ---- 5. write and summarise (counts only)
    pool = capPerAccount(pool, args.perAccount) as OutPost[];
    writeFileSync(files.posts, JSON.stringify(pool, null, 2));
    log('\naccount                      stratum     posts  empty-caption  sources');
    for (const acct of picked) {
      const mine = pool.filter((p) => p.account === acct.username);
      const sources = [...new Set(mine.map((p) => p.fetchedFrom))].join('+') || '-';
      log(`${acct.username.padEnd(28)} ${acct.stratum.padEnd(11)} ${String(mine.length).padStart(5)}  ${String(mine.filter((p) => !p.caption).length).padStart(13)}  ${sources}`);
    }
    log(`\n${pool.length} posts written to ${files.posts}`);
    log('These are third-party captions. The folder is git-ignored. Delete it when the POC ends.');
  } finally {
    rl.close();
    await db.end();
  }
}

// run only when executed directly (the tests import the SQL constants)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { process.stderr.write(`error: ${(e as Error).message}\n`); process.exit(1); });
}
