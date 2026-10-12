---
backlog_id: IDEA-068
title: "Extraction prompt: organizerHandle only when explicitly tagged"
captured: 2026-10-12
fixed: 2026-10-12
---

# IDEA-068 — Extraction prompt: organizerHandle only when explicitly tagged

## Capture

Prompt rule 10 in `build-gemini-request.ts` told the model to return the posting account as `organizerHandle` when no organizer was tagged. The poster is always derivable from the database; only an explicit organizer needs capturing at extraction time (a curator's caption is nulled afterwards). The default made every roundup item look organizer-matched and is the root cause of BUG-058.

## Done 2026-10-12

- Rule 10 and the schema comment now ask for an explicit organizer only, and say not to fall back to the posting account or to treat a merely mentioned venue, sponsor or performer as the organizer.
- Prompt test asserts the new wording.
- The `processIngestionJob` discount stays as defence for messages queued before this change.
- Not added: an `organizerSource` field (`tagged | stated | none`).
