#!/usr/bin/env node
// Node helper for scripts/scrape-batching-cost-research.sh — used for JSON
// building/parsing/rendering, mirroring scripts/apify-smoke-test.mjs's pattern
// (jq is not assumed to be installed; Node already is, this is a Node monorepo).

import fs from 'node:fs';

const [, , cmd, ...args] = process.argv;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Tolerant variant for reading a vendor HTTP response that may be an empty or
// malformed body (proxy hiccup, truncated connection) -- returns null instead of
// throwing, so a single bad response can't crash the whole research run under the
// caller shell script's `set -e` (which would otherwise abort and lose every
// already-triggered, already-paid-for run's collected data).
function tryReadJson(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

// --- Apify ---------------------------------------------------------------

function buildApifyInput(usernamesCsv, limitStr) {
  const usernames = usernamesCsv.split(',').filter(Boolean);
  const limit = parseInt(limitStr || '3', 10);
  return {
    directUrls: usernames.map((u) => `https://www.instagram.com/${u}/`),
    resultsType: 'posts',
    resultsLimit: limit,
  };
}

// Mirrors apify-smoke-test.mjs's computeCost — PAY_PER_EVENT breakdown is
// authoritative when present (totalChargeUsd can lag right after SUCCEEDED).
function computeApifyCost(run) {
  if (run.pricingInfo && run.pricingInfo.pricingModel === 'PAY_PER_EVENT' && run.chargedEventCounts) {
    const events = run.pricingInfo.pricingPerEvent?.actorChargeEvents || {};
    const entries = Object.entries(run.chargedEventCounts);
    if (entries.length) {
      let total = 0;
      const lines = entries.map(([key, count]) => {
        const ev = events[key] || {};
        const price = typeof ev.eventPriceUsd === 'number' ? ev.eventPriceUsd : 0;
        const title = ev.eventTitle || key;
        const subtotal = price * count;
        total += subtotal;
        return `- **${title}:** ${count} × $${price} = **$${subtotal.toFixed(4)}**`;
      });
      return { total, breakdown: lines.join('\n'), source: 'vendor pricingInfo/chargedEventCounts' };
    }
  }
  // Fallback used by apify-smoke-test.mjs's computeCost for pricing models that
  // report only via usageUsd (no PAY_PER_EVENT breakdown, no totalChargeUsd yet).
  if (run.usageUsd && typeof run.usageUsd === 'object' && Object.keys(run.usageUsd).length) {
    let total = 0;
    const lines = Object.entries(run.usageUsd).map(([key, val]) => {
      if (typeof val === 'number') total += val;
      return `- **${key}:** $${val}`;
    });
    return { total, breakdown: lines.join('\n'), source: 'vendor usageUsd' };
  }
  if (typeof run.totalChargeUsd === 'number' && run.totalChargeUsd > 0) {
    return { total: run.totalChargeUsd, breakdown: `- **totalChargeUsd:** $${run.totalChargeUsd}`, source: 'vendor totalChargeUsd' };
  }
  return { total: null, breakdown: '- (no vendor cost field available yet)', source: 'unavailable' };
}

// --- Bright Data -----------------------------------------------------------

function buildBrightDataInput(usernamesCsv, limitStr, startDate) {
  const usernames = usernamesCsv.split(',').filter(Boolean);
  const numOfPosts = parseInt(limitStr || '3', 10);
  return {
    input: usernames.map((u) => ({
      url: `https://www.instagram.com/${u}/`,
      num_of_posts: numOfPosts,
      start_date: startDate,
    })),
  };
}

// --- Shared formula (mirrors apps/backend/src/lib/scraper/usage-store.ts) --

function computeFormulaCost(itemCount, pricePerThousandItemsUsd) {
  return (itemCount / 1000) * pricePerThousandItemsUsd;
}

// Tolerant lookup used by the shell driver's status/id/field polling — a malformed
// or empty vendor response body yields '' (treated downstream as "not yet known")
// instead of throwing and aborting the whole run under `set -e`.
function getPath(file, path) {
  const obj = tryReadJson(file);
  if (obj == null) return '';
  const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  return val === undefined || val === null ? '' : String(val);
}

// A raw vendor error body/notes string may contain '|' or newlines, which would
// otherwise break the rendered markdown table's column alignment.
function sanitizeForTableCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
}

function renderComparisonReport(rows, outFile) {
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines = [
    '# Scrape Batching Cost/Latency Research (IDEA-015)',
    '',
    `Generated: ${dateStr}`,
    '',
    '| Vendor | Mode | Accounts | Status | Duration (s) | Cost ($, vendor) | Cost ($, formula) | Notes |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    lines.push(
      `| ${sanitizeForTableCell(r.vendor)} | ${sanitizeForTableCell(r.mode)} | ${r.accountCount} | ${sanitizeForTableCell(r.status)} | ${r.durationSec ?? 'n/a'} | ${r.vendorCost ?? 'n/a'} | ${r.formulaCost ?? 'n/a'} | ${sanitizeForTableCell(r.notes)} |`
    );
  }
  lines.push('', '## Raw Run Details', '');
  for (const r of rows) {
    lines.push(`### ${r.vendor} — ${r.mode} (${r.accountCount} account(s))`, '', '```json', JSON.stringify(r.raw ?? {}, null, 2), '```', '');
  }
  fs.writeFileSync(outFile, lines.join('\n'));
}

switch (cmd) {
  case 'build-apify-input': {
    const [usernamesCsv, limit] = args;
    process.stdout.write(JSON.stringify(buildApifyInput(usernamesCsv, limit), null, 2));
    break;
  }
  case 'build-brightdata-input': {
    const [usernamesCsv, limit, startDate] = args;
    process.stdout.write(JSON.stringify(buildBrightDataInput(usernamesCsv, limit, startDate), null, 2));
    break;
  }
  case 'apify-cost': {
    const [runFile] = args;
    const runWrap = tryReadJson(runFile);
    if (runWrap == null) {
      process.stdout.write(JSON.stringify({ total: null, breakdown: '- (run response unavailable/malformed)', source: 'unavailable' }));
      break;
    }
    const run = runWrap.data || runWrap;
    const { total, breakdown, source } = computeApifyCost(run);
    process.stdout.write(JSON.stringify({ total, breakdown, source }));
    break;
  }
  case 'formula-cost': {
    const [itemCountStr, pricePerThousandStr] = args;
    const total = computeFormulaCost(parseInt(itemCountStr, 10) || 0, parseFloat(pricePerThousandStr));
    process.stdout.write(String(total));
    break;
  }
  case 'get': {
    const [file, path] = args;
    process.stdout.write(getPath(file, path));
    break;
  }
  case 'render-report': {
    const [rowsFile, outFile] = args;
    const rows = readJson(rowsFile);
    renderComparisonReport(rows, outFile);
    break;
  }
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}
