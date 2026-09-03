#!/usr/bin/env node
// Node helper for scripts/apify-smoke-test.sh — used for JSON building/parsing/rendering
// (jq is not assumed to be installed; Node already is, as this is a Node monorepo).

import fs from 'node:fs';

const [, , cmd, ...args] = process.argv;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildInput(actorId, username, limitStr) {
  const limit = parseInt(limitStr || '3', 10);
  switch (actorId) {
    case 'apify~instagram-profile-scraper':
      return { usernames: [username], includeAboutSection: false };
    case 'figue~instagram-profile-scraper':
      return { profiles: [username], includeRecentPosts: false };
    case 'danek~instagram-profiles-scraper-ppr':
      return { usernames: [username] };
    case 'instagram-scraper~fast-instagram-post-scraper':
      // Actor rejects postsPerProfile < 5.
      return { instagramUsernames: [username], postsPerProfile: Math.max(limit, 5) };
    default:
      throw new Error(`Unknown actor id: ${actorId}`);
  }
}

function getPath(file, path) {
  const obj = readJson(file);
  const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  return val === undefined || val === null ? '' : String(val);
}

// Apify's totalChargeUsd can still read 0 for a short window right after a
// run reaches SUCCEEDED (billing aggregation lags behind chargedEventCounts,
// which is populated synchronously as events fire) — so treat the itemized
// breakdown as the authoritative total whenever it's available, and only
// fall back to totalChargeUsd/usageUsd when there's no breakdown to sum.
function computeCost(run) {
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
      return { total, breakdown: lines.join('\n') };
    }
  }
  if (run.usageUsd && typeof run.usageUsd === 'object' && Object.keys(run.usageUsd).length) {
    let total = 0;
    const lines = Object.entries(run.usageUsd).map(([key, val]) => {
      if (typeof val === 'number') total += val;
      return `- **${key}:** $${val}`;
    });
    return { total, breakdown: lines.join('\n') };
  }
  return {
    total: typeof run.totalChargeUsd === 'number' ? run.totalChargeUsd : 0,
    breakdown: '- (no itemized breakdown available for this pricing model)',
  };
}

function renderReport(runFile, datasetFile, inputFile, actorId, actorLabel, username, outFile) {
  const runWrap = readJson(runFile);
  const run = runWrap.data || runWrap;
  const dataset = readJson(datasetFile);
  const input = readJson(inputFile);

  const startedAt = run.startedAt ? new Date(run.startedAt) : null;
  const finishedAt = run.finishedAt ? new Date(run.finishedAt) : null;
  const durationSec = startedAt && finishedAt ? Math.round((finishedAt - startedAt) / 1000) : null;

  const { total, breakdown } = computeCost(run);
  const totalRounded = total.toFixed(3);
  const totalExact = String(total);

  const consoleUrl = run.actId && run.id
    ? `https://console.apify.com/actors/${run.actId}/runs/${run.id}`
    : '';

  const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const md = `# Apify Instagram Scraper Smoke Test

- **Actor:** \`${actorId}\` — ${actorLabel}
- **Target:** [@${username}](https://www.instagram.com/${username}/)
- **Date/Time:** ${dateStr}
- **Run ID:** [${run.id}](${consoleUrl})
- **Status:** ${run.status}
- **Duration:** ${durationSec !== null ? `${durationSec} s` : 'n/a'}
- **Cost ($):** $${totalRounded} (exact total: $${totalExact})

### Cost Breakdown
${breakdown}

### Input Params
\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

### Output
\`\`\`json
${JSON.stringify(dataset, null, 2)}
\`\`\`
`;

  fs.writeFileSync(outFile, md);
}

switch (cmd) {
  case 'build-input': {
    const [actorId, username, limit] = args;
    process.stdout.write(JSON.stringify(buildInput(actorId, username, limit), null, 2));
    break;
  }
  case 'get': {
    const [file, path] = args;
    process.stdout.write(getPath(file, path));
    break;
  }
  case 'render-report': {
    const [runFile, datasetFile, inputFile, actorId, actorLabel, username, outFile] = args;
    renderReport(runFile, datasetFile, inputFile, actorId, actorLabel, username, outFile);
    break;
  }
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}
