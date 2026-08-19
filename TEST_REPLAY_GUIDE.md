# Testing Story 3.4j: Replay Actor Run

## Quick Start

### 1. Seed Test Data

First, ensure the Instagram profile exists. Then seed the test actor run:

```bash
# Option A: Run the seed script directly
npx tsx apps/backend/src/lib/scraper/seed-test-actor-run.ts

# Option B: Import and call from your test
import { seedTestActorRun } from './lib/scraper/seed-test-actor-run.js';
const actorRunId = await seedTestActorRun();
```

This creates:
- **Actor run record** with `vendor='apify'`, `triggerMode='sync'`, `status='SUCCEEDED'`
- **Raw output** with 5 Instagram posts from @chaanakyaekadanta_academy
- **No persisted posts** (simulates the "stalled scraping" scenario)

Expected output:
```
✅ Seeded actor run 3bBQrzitUR7L9ahiR (ID: <uuid>)
   Profile: <profile-id>
   Items: 5
   Status: SUCCEEDED with stored rawOutput (no posts persisted yet)

📝 Test the replay mutation with: replayActorRun(actorRunId: "<uuid>")
```

### 2. Test Via GraphQL

Use your GraphQL client (Apollo Studio, Postman, or curl):

```graphql
mutation {
  replayActorRun(actorRunId: "<ACTOR_RUN_ID_FROM_SEED>") {
    success
    postsPersisted
    message
  }
}
```

**Expected response (first replay):**
```json
{
  "success": true,
  "postsPersisted": 5,
  "message": "Replay completed: 5 new post(s) persisted"
}
```

### 3. Verify Posts Were Inserted

Query the posts table for the profile:

```graphql
query {
  queryPosts(
    filters: { profileId: "<PROFILE_ID>" }
    first: 100
  ) {
    edges {
      node {
        id
        postUrl
        content
        createdAt
      }
    }
    totalCount
  }
}
```

Should see 5 posts from the Instagram URLs:
- `https://www.instagram.com/p/DcIUe6GxMC9/`
- `https://www.instagram.com/p/DcKnS_8K9cx/`
- `https://www.instagram.com/p/DcKnrwLKIBZ/`
- `https://www.instagram.com/p/DcIT_Taq3oA/`
- `https://www.instagram.com/p/DcKoCLxK_-P/`

### 4. Test Idempotency (Optional)

Call replay again with the same actor run ID:

```graphql
mutation {
  replayActorRun(actorRunId: "<ACTOR_RUN_ID>") {
    success
    postsPersisted
    message
  }
}
```

**Expected response (second replay):**
```json
{
  "success": true,
  "postsPersisted": 0,
  "message": "Replay completed: no new posts (already existed)"
}
```

This verifies the `onConflictDoNothing` on `postUrl` dedup is working correctly.

### 5. Query Actor Runs

Verify the audit trail is queryable:

```graphql
query {
  queryActorRuns(
    filters: { vendor: APIFY, status: SUCCEEDED }
    first: 10
  ) {
    edges {
      node {
        id
        runId
        vendor
        status
        itemCount
        completedAt
      }
    }
    totalCount
  }
}
```

## Test Data Details

**Apify Run:** 3bBQrzitUR7L9ahiR
- **Duration:** 58s
- **Cost:** $0.022
- **Input:** Fetch latest 10 posts from @chaanakyaekadanta_academy (newer than 2026-08-16)
- **Output:** 5 posts (from real Instagram scrape on 2026-08-19 10:00 UTC)

**Posts in Output:**
1. KOMPETISI NASIONAL (KOMNAS) - 37 likes, 5 comments
2. CEO KARTASURA - 4 likes, 0 comments
3. CEO KLATEN - 6 likes, 2 comments
4. CEO CILACAP - 4 likes, 1 comment
5. CEO PURWAKARTA - 15 likes, 14 comments

## Cleanup

To remove test data after testing:

```sql
-- Delete the seeded posts (by profile + URLs)
DELETE FROM posts
WHERE profile_id = '<PROFILE_ID>'
  AND post_url IN (
    'https://www.instagram.com/p/DcIUe6GxMC9/',
    'https://www.instagram.com/p/DcKnS_8K9cx/',
    'https://www.instagram.com/p/DcKnrwLKIBZ/',
    'https://www.instagram.com/p/DcIT_Taq3oA/',
    'https://www.instagram.com/p/DcKoCLxK_-P/'
  );

-- Delete the actor run
DELETE FROM scraper_actor_runs
WHERE run_id = '3bBQrzitUR7L9ahiR' AND vendor = 'apify';
```

## Expected Behavior

| Scenario | Input | Expected | Actual | Status |
|----------|-------|----------|--------|--------|
| First replay | 5 items stored, 0 persisted | 5 new posts | ? | To test |
| Second replay | 5 items stored, 5 persisted | 0 new posts | ? | To test |
| Missing output | rawOutput null, fetch fails | success: false | ? | To test |
| Moderator gate | Non-moderator user | Authorization error | ? | To test |
| Query pagination | first=2 | 2 edges + hasNextPage | ? | To test |

---

**Note:** This guide assumes the backend is running with database access configured. Adjust IDs and profile usernames as needed for your test environment.
