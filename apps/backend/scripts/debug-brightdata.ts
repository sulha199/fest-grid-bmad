// Diagnostic for the 2026-10-21 Bright Data outage: every snapshot is accepted, reaches `ready`, and
// returns zero records ("No records found. The data may not be available or has changed."), while
// Apify returns posts for the same accounts. This triggers one snapshot WITH `start_date` (exactly the
// shape the daily batch sends) and one WITHOUT it, for one Instagram URL, then prints each snapshot's
// full progress report, so a vendor ticket can say whether `start_date` matters or the dataset is
// returning nothing for any input.
//
// Run it yourself with your own token; nothing in CI or the Lambdas calls this. Each trigger creates a
// billed snapshot (a few records at most):
//
//   pnpm --filter backend exec tsx scripts/debug-brightdata.ts [instagram-url] [--days=14] [--max-wait-secs=300]
//
// Needs BRIGHTDATA_API_TOKEN and BRIGHTDATA_DATASET_ID (default gd_lk5ns7kz21pck8jpis) in the
// repo-root .env or apps/backend/.env, like scripts/debug-apify.ts. No webhook `endpoint` is sent:
// the script polls the progress API itself, so nothing is delivered to the app.
import { loadBackendEnv } from '../src/env.js';

const DEFAULT_URL = 'https://www.instagram.com/infoeventjogja/';
const POLL_INTERVAL_MS = 10_000;
const API = 'https://api.brightdata.com/datasets/v3';

function argValue(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split('=')[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Same MM-DD-YYYY format as mapBrightDataDateToStartDate (brightdata-client.ts).
function startDateDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}-${date.getUTCFullYear()}`;
}

async function call(path: string, token: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep the raw text: error pages are not JSON
  }
  return { status: response.status, body };
}

async function runVariant(label: string, token: string, datasetId: string, input: Record<string, unknown>, maxWaitMs: number) {
  console.log(`\n=== ${label} ===`);
  console.log('Request input:', JSON.stringify(input));

  const params = new URLSearchParams({
    dataset_id: datasetId,
    type: 'discover_new',
    discover_by: 'url',
    format: 'json',
  });
  const trigger = await call(`/trigger?${params}`, token, { method: 'POST', body: JSON.stringify({ input: [input] }) });
  console.log(`Trigger -> HTTP ${trigger.status}`, JSON.stringify(trigger.body));
  const snapshotId = (trigger.body as { snapshot_id?: string })?.snapshot_id;
  if (!snapshotId) {
    console.error('No snapshot_id returned; stopping this variant.');
    return;
  }

  const deadline = Date.now() + maxWaitMs;
  let progress: { status: number; body: unknown } | undefined;
  while (Date.now() < deadline) {
    progress = await call(`/progress/${snapshotId}`, token);
    const status = (progress.body as { status?: string })?.status;
    console.log(`  progress (${snapshotId}): HTTP ${progress.status} status=${status}`);
    if (status === 'ready' || status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // The whole progress report, untouched: records, errors, error_codes, error_message and anything
  // else the vendor sent. This is what to paste into the ticket.
  console.log('--- Final progress report ---');
  console.log(JSON.stringify(progress?.body, null, 2));

  const records = (progress?.body as { records?: number })?.records;
  if ((progress?.body as { status?: string })?.status === 'ready' && records !== 0) {
    const snapshot = await call(`/snapshot/${snapshotId}?format=json`, token);
    const items = Array.isArray(snapshot.body) ? snapshot.body : [];
    console.log(`--- Snapshot (HTTP ${snapshot.status}, ${items.length} items; first 2 shown) ---`);
    console.log(JSON.stringify(items.slice(0, 2), null, 2));
  }
}

async function main() {
  const env = loadBackendEnv();
  if (!env.brightdataApiToken) {
    console.error('BRIGHTDATA_API_TOKEN is not set (checked repo-root .env and apps/backend/.env). Aborting.');
    process.exit(1);
  }
  if (!env.brightdataDatasetId) {
    console.error('BRIGHTDATA_DATASET_ID is not set. Aborting.');
    process.exit(1);
  }

  const url = process.argv.find((a) => a.startsWith('http')) ?? DEFAULT_URL;
  const days = argValue('days', 14);
  const maxWaitMs = argValue('max-wait-secs', 300) * 1000;
  const numOfPosts = env.scrapeResultsLimit || 10;

  console.log(`Using BRIGHTDATA_API_TOKEN: ${env.brightdataApiToken.slice(0, 6)}... (${env.brightdataApiToken.length} chars)`);
  console.log(`Dataset ${env.brightdataDatasetId}, URL ${url}, num_of_posts ${numOfPosts}`);

  try {
    await runVariant(`WITH start_date (${startDateDaysAgo(days)}, what the daily batch sends)`, env.brightdataApiToken, env.brightdataDatasetId, {
      url,
      num_of_posts: numOfPosts,
      start_date: startDateDaysAgo(days),
    }, maxWaitMs);
    await runVariant('WITHOUT start_date', env.brightdataApiToken, env.brightdataDatasetId, {
      url,
      num_of_posts: numOfPosts,
    }, maxWaitMs);
  } catch (err) {
    console.error('--- Bright Data call failed ---');
    console.error(err);
    process.exit(1);
  }
}

main();
