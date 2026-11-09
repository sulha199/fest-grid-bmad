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
  E -- stop --> F[Mark extracted, clear the partial flag]
  E -- kill switch off or invariant exceeded --> G[Stop, log why, flag partial if slides remain]
  E -- continue --> H[Set partial flag, enqueue next step message with cursor and a short delay]
  H --> I[Step: blur only own images, one request]
  I --> C
  I -. 429 or 503: queue retry with delay; after the retries, dead-letter .-> P[Post stays flagged partial; redriving the message resumes]
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

State carried in the message (stateless Lambda): post id, next slide index, next free ordinal, events found so far, empty-step count, step count, last observed items per slide, claimed item count.
