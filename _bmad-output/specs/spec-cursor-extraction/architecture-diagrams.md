# Architecture diagrams

## Step loop

```mermaid
flowchart TD
  A[Scraped post enqueued] --> B[First request: cover + today's window of 5 slides, caption, post plan]
  B --> C{Signals at risk?}
  C -- yes --> S[Split window, retry, down to 1 slide]
  S --> C
  C -- no --> D[Dedupe against the post's events, allocate ordinals, enqueue ingestion]
  D --> E{Continue rules, in code}
  E -- stop --> F[Atomic stop: cursor null, extracted, partial flag per outcome]
  E -- kill switch off or bound exceeded --> G[Atomic stop, log why, flag partial if slides remain]
  E -- continue --> H[Reserve ordinals, enqueue ingestion, commit cursor, enqueue next step message with a short delay]
  H --> I[Step: blur only own images, one request]
  I --> C
  I -. 429, 503 or timeout: queue retry with delay .-> I
  I -. retries exhausted .-> R[Resume pass on the 5-minute tick: re-enqueue from the persisted cursor while images are valid and attempts remain]
  R --> I
  R -. attempts spent .-> P[Atomic stop: cursor null, post flagged partial, reason logged]
  R -. images expired or slide fetch 403/404/410, slides unread .-> X[Re-scrape for fresh image links: scrape gate, lease, at most 2 per post, 10 minutes apart]
  X -- fresh links, same slide count --> U[Replace only the links in the cursor, keep all progress] --> I
  X -. refused, failed or slide count changed .-> P
```

## Step message and state

```mermaid
sequenceDiagram
  participant Q as AI processing queue
  participant L as AI Lambda (one step per message)
  participant G as Gemini via key gateway
  participant D as Data ingestion queue
  participant DB as Postgres
  Q->>L: step message {postId, window, cursor}
  L->>G: one request (blurred images of this window only)
  G-->>L: events, post plan, finishReason, token usage
  L->>DB: read the post's existing events (dedupe key)
  L->>D: one message per new event (ordinal from the cursor's next-free value)
  L->>DB: write one extraction_audit_logs row for this step
  alt continue rules say continue
    L->>Q: next step message with updated cursor
  else stop or cap
    L->>DB: mark post extracted and clear the partial flag
  end
```

The cursor is also persisted on the post (written when a step ends and cleared at a clean end), which is what the resume pass reads.

State carried in the message (stateless Lambda): post id, next slide index, next free ordinal, events found so far, empty-step count, step count, last observed items per slide, claimed item count.
