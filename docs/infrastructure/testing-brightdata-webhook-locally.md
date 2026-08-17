# Testing the Bright Data Webhook Locally (ngrok)

Companion runbook for Story [3.4a](../../_bmad-output/implementation-artifacts/3-4a-add-brightdata-as-the-priority-scraping-vendor-for-the-scheduled-batch.md). That story's own Task 14 notes that local testing of `POST /webhooks/brightdata` "requires a real deployed API Gateway URL (or a tunneling tool) since Bright Data must reach a public HTTPS endpoint" — this doc is that tunneling-tool path.

**Status note:** this doc is written against 3.4a's spec (Task 3 `brightdata-client.ts`, Task 6 `lambdas/webhook.ts`, Task 7 `trigger-brightdata-for-target.ts`). As of writing, `webhook.ts` does not exist yet in the tree — Steps 1–5 below need it. Everything up to "does not exist yet" markers can be prepared ahead of time; the rest unblocks once that file lands.

## Why this is needed

Bright Data's `POST /datasets/v3/trigger` call takes an `endpoint=` query param — a public HTTPS URL it POSTs the completed job's records to when the async job finishes (Dev Notes, "Bright Data API Facts"). `localhost` is not reachable from Bright Data's side, so exercising the real trigger → async job → webhook round trip locally requires exposing your machine through a public tunnel (ngrok) for the lifetime of that one job.

## Prerequisites

- A real `BRIGHTDATA_API_TOKEN` (this hits Bright Data's live API and consumes real free-tier quota — 5,000 records/month, no card required).
- [ngrok](https://ngrok.com/) installed and authenticated (`ngrok config add-authtoken <token>`).
- A throwaway/low-volume Instagram profile to scrape against, and a small `num_of_posts` (2-3) — no reason to spend quota testing plumbing.
- Local Postgres reachable via `DATABASE_URL`, migrated (`pnpm --filter @festgrid/database migrate` or equivalent), so `brightdata_pending_jobs` rows can actually be written/read.

## Step 1 — Local dev server for the webhook Lambda

`apps/backend/src/index.ts` already does this for the GraphQL Lambda (`api.ts`): a plain `node:http` server wrapping the Lambda handler, run via `tsx watch`. `webhook.ts`'s handler is `(event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>` (Task 6) — the same shape `api.ts` wraps — so the same pattern applies, just inverted (build a synthetic `APIGatewayProxyEvent` from the incoming `node:http` request instead of building a `Request` from one).

Once `apps/backend/src/lambdas/webhook.ts` exists, add a new **dev-only** entrypoint (do not wire this into `apps/infrastructure` — it never gets deployed):

```typescript
// apps/backend/src/webhook-dev-server.ts
import { createServer } from 'node:http';
import { handler } from './lambdas/webhook.js';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const PORT = process.env.WEBHOOK_DEV_PORT ?? 4001;

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString('utf8');

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const event = {
    httpMethod: req.method,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: req.headers,
    body,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEvent;

  const result = await handler(event);
  res.writeHead(result.statusCode, result.headers as Record<string, string>);
  res.end(result.body);
});

server.listen(PORT, () => {
  console.log(`Bright Data webhook dev server on http://localhost:${PORT}/webhooks/brightdata`);
});
```

Run it with the same env the real Lambda would have (`DATABASE_URL`, `STAGE`):

```bash
pnpm --filter backend exec tsx watch src/webhook-dev-server.ts
```

## Step 2 — Expose it with ngrok

```bash
ngrok http 4001
```

Copy the `https://<random>.ngrok-free.app` forwarding URL. It changes on every `ngrok` restart (free plan) — keep the tunnel running for the full lifetime of whatever job you trigger in Step 4, since that job's `endpoint=` URL is fixed at trigger time (Dev Notes, "Webhook Token / URL Ordering").

Leave the ngrok web inspector open at `http://localhost:4040` — it shows the raw request Bright Data actually sends, which is the fastest way to confirm the real payload shape against Task 5's field-mapping code (the story's own flagged "residual, low-risk unknown").

## Step 3 — Point the trigger call at your tunnel

Override the env var `trigger-brightdata-for-target.ts` reads for the webhook base URL when running the backend locally:

```bash
BRIGHTDATA_WEBHOOK_BASE_URL="https://<random>.ngrok-free.app/webhooks/brightdata" \
BRIGHTDATA_API_TOKEN="<real token>" \
pnpm --filter backend dev
```

In a deployed environment this var is set automatically post-deploy by the CDK stack (Task 12); locally you're standing in for that.

## Step 4 — Trigger a real job

Whichever path is easiest given what's landed:

- Call `subscribeToAccount` locally against a fresh test profile with Apify capacity exhausted (or just call `attemptBrightDataTrigger` directly from a one-off `tsx` script) — either way it should call the real `triggerBrightDataJob`, create a `brightdata_pending_jobs` row, and return a `snapshot_id`.
- Confirm the row exists: `SELECT * FROM brightdata_pending_jobs WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 1;`

Bright Data's job typically takes a few minutes to complete.

## Step 5 — Watch it land

- ngrok inspector (`localhost:4040`) shows the inbound POST the moment Bright Data delivers it — inspect the raw JSON array here first.
- Your dev server's console logs the handler's response.
- Confirm end state in Postgres: the `brightdata_pending_jobs` row flips to `COMPLETED`, new rows appear wherever `persistScrapedPost` writes, and the profile's `lastScrapedAt` is stamped.

## Fast path: testing the handler without spending quota

To iterate on the handler/mapping logic without waiting on a real Bright Data job each time, skip Steps 2-4 and POST a fixture payload straight at the local dev server, using a real `webhookToken` from a row you insert by hand:

```bash
curl -X POST "http://localhost:4001/webhooks/brightdata?jobToken=<webhookToken-from-a-PENDING-row>" \
  -H "Content-Type: application/json" \
  -d '[{"url": "...", "caption": "...", "likes": 1, "comments": 0, "date_posted": "2026-08-01T00:00:00Z", "id": "abc123"}]'
```

This is the right loop for iterating on Task 5's field-mapping (`processBrightDataResult`) and Task 6's token-validation branches (missing/unknown/expired/already-completed token → `200` without processing) — no ngrok or real Bright Data call needed for any of that. Reserve the full ngrok round trip for confirming the *real* payload shape once, not for every iteration.

## Guardrails

- Real trigger calls count against `BRIGHTDATA_MONTHLY_BUDGET_USD` / the 5,000-record free tier — keep `num_of_posts` small and reuse one throwaway profile.
- Don't leave a long-lived ngrok tunnel wired into a shared/staging `BRIGHTDATA_WEBHOOK_BASE_URL` — this is a local-only override for your own machine.
- `webhook-dev-server.ts` is dev tooling, not part of `apps/infrastructure`'s deployable surface — don't add it to the CDK stack.
