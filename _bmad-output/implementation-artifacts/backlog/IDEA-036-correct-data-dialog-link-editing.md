---
backlog_id: IDEA-036
title: "Extend the 'Correct Data' dialog to support manual add/edit of event links"
captured: 2026-09-16
parent: IDEA-012
---

# IDEA-036 — Manual link editing in the Correct Data dialog

## Capture

Carved out of IDEA-012 by `bmad-create-story` (Story 0.37). The story session's own direct
AskUserQuestion calls hit a repeated "Stream closed" tool error, but the ritual-orchestrator
session running this batch relayed the same scope question through its mailbox instead and got
a genuine, confirmed answer: "Display-only now (Recommended)" — matches IDEA-012's stated scope
exactly and the `organizerName`/`contactInfo` precedent (display-only first, correction support
added later once a real correction-quality gap shows up).

Story 0.37 covers AI extraction + read-only display of `links: {url, label?}[]` only; it does
not touch `CorrectionForm.tsx`, `correction-dialog.tsx`, `ProposedEventCorrection`
(`packages/domain/src/events/types.ts`), `corrections.graphql`, or
`proposed-event-correction.schema.ts` (backend AJV + frontend Zod).

## Scope

This item is the follow-up: add a repeatable url+label input group to `CorrectionForm.tsx` (a
real new UI, not a copy of `contactInfo`'s single-text-field input), a new `linksLabel`-style
key in the `EventCorrectionForm` locale namespace, and thread `links` through the
`ProposedEventCorrection` type/schema/mutation so both manual user edits and AI-assisted
re-extraction correction previews can carry it.

Needs a UX pass (Gate 2, Freya) for the repeatable-input interaction pattern before story
creation, since none exists in the app yet for an array-of-objects form field.
