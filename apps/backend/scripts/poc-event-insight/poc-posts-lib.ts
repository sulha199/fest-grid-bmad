/**
 * Pure pieces of fetch-poc-posts.ts, the script that gathers real posts for the audience, language and taxonomy POC
 * (event-insight-poc/audience-and-taxonomy-poc-plan-2026-10-21.md). No I/O and no imports, so every rule here is unit-tested
 * (poc-posts-lib.test.ts) without a database, a network or a key.
 *
 * The posts are third-party content, and a curator's caption is deliberately not kept in the database (PRD 3.16). So this module is built
 * around what must NOT leave the owner's machine: `reduceRecord` keeps a short whitelist of fields and drops everything else (comments, tagged
 * users, counts, profile pictures), and the run log is built from counts and ids only.
 */

export interface PocPost {
  url: string;
  /** The posting account's username, lower-cased. */
  username: string | null;
  /** ISO 8601, or null when the record had no usable date. */
  datePosted: string | null;
  caption: string;
  /** Lower-case, without the leading '#'. */
  hashtags: string[];
  contentType: string | null;
  /** The place the post tagged, as text only. */
  locationName: string | null;
  photoCount: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

function toIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function tags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.replace(/^#+/, '').trim().toLowerCase()).filter(Boolean))];
}

/**
 * Reduces one raw vendor record (Bright Data's Instagram posts dataset, or an Apify post item) to the whitelisted fields. Returns null when the
 * record has no URL (nothing to key it on). Everything not named here is dropped on purpose.
 */
export function reduceRecord(rec: unknown): PocPost | null {
  if (!rec || typeof rec !== 'object') return null;
  const r = rec as Record<string, unknown>;
  const url = str(r.url) ?? str(r.postUrl);
  if (!url) return null;
  // Bright Data: user_posted, date_posted, description, content_type, location_details.name, photos[]
  // Apify:       ownerUsername, timestamp | pubDate | publishedAt, caption | text | description, type, locationName, displayUrl, childPosts[]
  const username = (str(r.user_posted) ?? str(r.ownerUsername))?.toLowerCase() ?? null;
  const datePosted = toIso(r.date_posted) ?? toIso(r.timestamp) ?? toIso(r.pubDate) ?? toIso(r.publishedAt);
  const caption = str(r.description) ?? str(r.caption) ?? str(r.text) ?? '';
  const loc = r.location_details && typeof r.location_details === 'object' ? str((r.location_details as Record<string, unknown>).name) : null;
  const photos = Array.isArray(r.photos) ? r.photos.length : Array.isArray(r.childPosts) ? r.childPosts.length : str(r.displayUrl) ? 1 : 0;
  return {
    url,
    username,
    datePosted,
    caption,
    hashtags: tags(r.hashtags),
    contentType: str(r.content_type) ?? str(r.type),
    locationName: loc ?? str(r.locationName),
    photoCount: photos,
  };
}

/**
 * `scraper_actor_runs.raw_output` is jsonb, and some rows hold a JSON string that itself contains the JSON (BUG-068), so a string is parsed once.
 * An array is the records; an object may wrap them under items / records / data / results.
 */
export function recordsFromRawOutput(raw: unknown): unknown[] {
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    for (const key of ['items', 'records', 'data', 'results']) {
      const inner = (v as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
}

/** True when the post has a date on or after `sinceIso`. A post with no usable date is not in the window (it cannot be checked). */
export function inWindow(post: PocPost, sinceIso: string): boolean {
  return post.datePosted !== null && post.datePosted >= sinceIso;
}

/** Merges by URL; the first occurrence wins, so a re-run never duplicates a post. */
export function mergeByUrl(existing: PocPost[], incoming: PocPost[]): PocPost[] {
  const seen = new Set(existing.map((p) => p.url));
  const out = [...existing];
  for (const p of incoming) {
    if (!seen.has(p.url)) { seen.add(p.url); out.push(p); }
  }
  return out;
}

/** Keeps the `n` most recent posts of each username (posts with no username share one bucket). */
export function capPerAccount(posts: PocPost[], n: number): PocPost[] {
  const buckets = new Map<string, PocPost[]>();
  for (const p of posts) {
    const k = p.username ?? '';
    buckets.set(k, [...(buckets.get(k) ?? []), p]);
  }
  const out: PocPost[] = [];
  for (const list of buckets.values()) {
    out.push(...list.sort((a, b) => (b.datePosted ?? '').localeCompare(a.datePosted ?? '')).slice(0, n));
  }
  return out;
}

/** True when the records on hand do not reach the number wanted for an account. */
export const needsMore = (have: number, wanted: number): boolean => have < wanted;

// ---------------------------------------------------------------------------------------------------------------------------------------
// accounts typed by the owner

const USERNAME = /^[a-z0-9._]{1,30}$/;

/** Accepts "@name", "name", "instagram.com/name/" and full URLs, separated by commas, spaces or new lines. */
export function parseAccountList(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)) {
    const m = raw.match(/instagram\.com\/([^/?#\s]+)/i);
    const name = (m ? m[1] : raw).replace(/^@/, '').toLowerCase();
    if (USERNAME.test(name) && !['p', 'reel', 'reels', 'explore', 'stories'].includes(name)) {
      if (!valid.includes(name)) valid.push(name);
    } else {
      invalid.push(raw);
    }
  }
  return { valid, invalid };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the .env file: only the keys this script needs

export const ENV_WHITELIST = [
  'BRIGHTDATA_API_TOKEN',
  'BRIGHTDATA_DATASET_ID',
  'BRIGHTDATA_SCRAPING_CONFIRMED',
  'BRIGHTDATA_PRICE_PER_THOUSAND_ITEMS_USD',
  'APIFY_API_TOKEN',
  'APIFY_SCRAPING_CONFIRMED',
  'APIFY_PRICE_PER_THOUSAND_RESULTS_USD',
] as const;

/**
 * Reads KEY=VALUE lines and returns ONLY the whitelisted keys. The repository's .env also holds the application's own owner-privileged database
 * URL and other secrets; this script never reads them, and the caller never prints a value.
 */
export function parseDotenvWhitelist(text: string, allowed: readonly string[] = ENV_WHITELIST): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || !allowed.includes(m[1])) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    if (v) out[m[1]] = v;
  }
  return out;
}

/** The kill switches the application honours (AD-32 Rule 5): an explicit false or 0 disables the vendor. Unset means allowed. */
export function vendorAllowed(value: string | undefined): boolean {
  if (value === undefined) return true;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// a new Bright Data scrape

export interface TriggerRequest { url: string; body: string }

/** MM-DD-YYYY, the format Bright Data's trigger expects (the application's mapBrightDataDateToStartDate). */
export function brightDataStartDate(sinceIso: string): string {
  const d = new Date(sinceIso);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

/**
 * The trigger for one account. There is deliberately NO `endpoint` parameter: the application passes its production webhook there, which would
 * ingest the result into production. Without it the snapshot is only fetched by id, by this script.
 */
export function buildBrightDataTrigger(datasetId: string, username: string, numOfPosts: number, sinceIso: string): TriggerRequest {
  const u = new URL('https://api.brightdata.com/datasets/v3/trigger');
  u.searchParams.set('dataset_id', datasetId);
  u.searchParams.set('type', 'discover_new');
  u.searchParams.set('discover_by', 'url');
  u.searchParams.set('format', 'json');
  return {
    url: u.toString(),
    body: JSON.stringify({ input: [{ url: `https://www.instagram.com/${username}/`, num_of_posts: numOfPosts, start_date: brightDataStartDate(sinceIso) }] }),
  };
}

export const estimateCostUsd = (records: number, pricePerThousandUsd: number): number => Math.round((records / 1000) * pricePerThousandUsd * 10000) / 10000;

// ---------------------------------------------------------------------------------------------------------------------------------------
// the run log: counts and ids only

export interface RunLogEntry {
  username: string;
  source: 'db-raw' | 'vendor-refetch' | 'new-scrape' | 'none';
  vendor?: 'APIFY' | 'BRIGHTDATA';
  /** An Apify run id or a Bright Data snapshot id, so a re-run downloads it again instead of paying for a second scrape. */
  runId?: string;
  fetched: number;
  inWindow: number;
  kept: number;
  at: string;
}

export interface RunLog { version: 1; entries: RunLogEntry[] }

export const emptyRunLog = (): RunLog => ({ version: 1, entries: [] });

/** The snapshot ids a previous run already paid for, per username, so a re-run reuses them. */
export function knownSnapshotIds(log: RunLog, username: string): string[] {
  return log.entries.filter((e) => e.username === username && e.source === 'new-scrape' && e.vendor === 'BRIGHTDATA' && e.runId).map((e) => e.runId as string);
}
