---
baseline_commit: d06b873dd3879e0c2d1ce202e10ee640ca3e5771
---

# Story 0.47: Build the reusable ConfirmActionDialog primitive

## Story Details

- Epic: 0
- Story ID: 0.47
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, generic focus-trapping confirmation dialog primitive (`ConfirmActionDialog`, `packages/ui/src/core/`) implementing `EXPERIENCE.md`'s merge-confirmation contract (opening moves focus into the dialog; Cancel returns focus to the triggering control with no further action; Confirm commits, closes, and returns focus to the triggering control),
so that Story 3.6w's "merge two events" confirmation step — and any future destructive moderator/user action that needs an explicit confirm-before-commit step — can reuse one accessible, tested dialog instead of each feature hand-rolling its own focus-trap logic.

## Acceptance Criteria

1. **Given** `EXPERIENCE.md`'s CC-024 "Moderator tools" entry (item 6, its final paragraph) describing a confirmation step with true focus-trap semantics — "opening it moves focus into the dialog; **Cancel** returns focus to the row's merge-trigger control, dialog closes, nothing else happens; **Confirm** commits the merge, closes the dialog, returns focus to that same trigger control" — **when** a consuming feature renders `<ConfirmActionDialog open={...} title={...} description={...} confirmLabel={...} cancelLabel={...} onConfirm={...} onCancel={...} />`, **then** opening it traps focus inside the dialog (first focusable element, or an explicit `initialFocusRef`), `Escape` and an overlay click behave identically to Cancel, and closing by either path returns focus to whichever element had focus immediately before the dialog opened (captured internally, not required as a prop) — matching the stated contract exactly, not just "a dialog that closes."
2. **And** the primitive is built on `@radix-ui/react-dialog` (already a pinned dependency of `apps/web`, `^1.1.21` — confirmed via its `package.json`; added fresh to `packages/ui`'s own dependencies at the same pinned version, not a new library choice) rather than hand-rolled focus-trap logic, since Radix's `Dialog.Content` already provides correct focus-trap/return/`Escape`/overlay-dismiss behavior out of the box and this codebase has no existing `packages/ui`-local wrapper around it to extend (see Dev Notes — `apps/web/src/components/ui/dialog.tsx` is a separate, pre-existing, `apps/web`-local shadcn `Dialog` wrapper used by 9+ existing form dialogs; this story does not move or refactor it).
3. **And** `onConfirm` is `() => void | Promise<void>` — while a returned promise is pending, the dialog shows its Confirm button in a disabled/busy state (reusing `@festgrid/ui`'s existing `Button` component's `disabled` prop; no new spinner primitive) and `Escape`/overlay-click/Cancel are disabled for that duration, so a moderator cannot dismiss the dialog mid-commit. On the promise resolving, the dialog closes and focus returns to the trigger (AC1). On the promise rejecting, the dialog stays open, re-enables its controls, and the consumer is responsible for surfacing its own error (e.g. a toast) — this primitive does not swallow or retry `onConfirm` failures, it only unblocks its own UI.
4. **And** the dialog's visual chrome reuses `DESIGN.md`'s existing shared `{components.modal}` tokens (`overlay`: `fixed inset-0 bg-black bg-opacity-50`; `dialog`: `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md`) — the same tokens `PwaInstallIosModal` already reuses verbatim (`DESIGN.md`'s own explicit "not inventing new modal chrome" note) — plus `@festgrid/ui`'s existing `Button` component (`variant="destructive"` for a destructive confirm action, `variant="outline"` for Cancel, both caller-selectable via a `confirmVariant?: 'default' | 'destructive'` prop defaulting to `'default'`).
5. **And** it ships its own integration test suite (Vitest + Testing Library + `@testing-library/user-event`) covering: opening moves focus into the dialog; `Escape` calls `onCancel` and returns focus to a pre-rendered trigger button; clicking the overlay calls `onCancel` identically; clicking Confirm calls `onConfirm`, disables Confirm/Cancel while its promise is pending, then closes and returns focus to the trigger on resolution; a rejecting `onConfirm` leaves the dialog open and re-enables its controls; `confirmVariant="destructive"` renders the `Button` destructive variant.
6. **And** the component is exported from `packages/ui/src/index.ts` (and `ConfirmActionDialogProps` from a sibling `.types.ts`), reusable with no feature-specific coupling — Story 3.6w is this story's first real consumer (see Dev Notes), not built here.

## Tasks / Subtasks

- [ ] **Task 1 (AC2) — Add `@radix-ui/react-dialog` to `packages/ui`.**
  - [ ] Add `@radix-ui/react-dialog` to `packages/ui/package.json` `dependencies` at the exact version already pinned in `apps/web/package.json` (`^1.1.21`) — confirm no drift at implementation time (`npm view @radix-ui/react-dialog version`), matching the version-pinning convention `useSoftDeleteWithUndo`'s `sonner` addition (Story 0.18) already established for a fresh `packages/ui` dependency.
- [ ] **Task 2 (AC1, AC3) — Build `ConfirmActionDialog`.**
  - [ ] Create `packages/ui/src/core/confirm-action-dialog.types.ts` exporting `ConfirmActionDialogProps`: `{ open: boolean; title: string; description?: string; confirmLabel: string; cancelLabel: string; confirmVariant?: 'default' | 'destructive'; onConfirm: () => void | Promise<void>; onCancel: () => void; className?: string }`. No `labels`-object indirection (unlike `useSoftDeleteWithUndo`'s `SoftDeleteToastLabels` — this primitive renders visible dialog copy directly as props, since every consumer already has its own `useTranslations()` call site to source strings from, matching `BlockingLoaderProps`'s plain-string-prop precedent rather than inventing a second copy-indirection shape).
  - [ ] Create `packages/ui/src/core/confirm-action-dialog.tsx` (`'use client'`) wrapping `@radix-ui/react-dialog`'s `Root`/`Portal`/`Overlay`/`Content` directly (not re-exporting `apps/web/src/components/ui/dialog.tsx` — that file lives in `apps/web`, and `packages/ui` cannot import from an app; see Dev Notes):
    - `Root` with `open`/`onOpenChange={(next) => { if (!next) onCancel(); }}` (Radix fires `onOpenChange(false)` for both `Escape` and overlay-click — mapping both to `onCancel` satisfies AC1 without separate handlers).
    - `Overlay` styled with `DESIGN.md`'s `components.modal.overlay` token verbatim; `Content` styled with `components.modal.dialog` verbatim (AC4), `role="alertdialog"` (not `role="dialog"` — this is specifically a confirm-before-destructive-action pattern, the correct ARIA role per APG) and `aria-describedby` wired to the `description` paragraph when provided.
    - Internal `isConfirming` state (`useState`): set `true` when `onConfirm()` is invoked, wrapped in `Promise.resolve(onConfirm()).then(..., (err) => { setIsConfirming(false); throw err; })` so a synchronous `onConfirm` and an async one are handled identically; on resolution the consumer's own `open` prop flipping to `false` (via whatever it does after `onConfirm` succeeds) unmounts the dialog — this component does not call `onCancel`/close itself after a successful confirm, since the consumer owns `open` state and already knows it succeeded (AC3's "the dialog closes" is therefore the consumer setting `open={false}`, not an internal auto-close — document this explicitly so Story 3.6w's own Task doesn't double-manage close state).
    - While `isConfirming` is `true`: `Content`'s `onEscapeKeyDown`/`onPointerDownOutside` call `event.preventDefault()` (blocking Radix's own dismiss), and both buttons render with `disabled`.
    - Confirm button: `<Button variant={confirmVariant === 'destructive' ? 'destructive' : 'default'} disabled={isConfirming} onClick={handleConfirm}>{confirmLabel}</Button>`. Cancel button: `<Button variant="outline" disabled={isConfirming} onClick={onCancel}>{cancelLabel}</Button>`.
    - Radix's `Dialog.Content` already handles focus-trap-in and focus-return-to-trigger automatically (its documented behavior) — no manual `useRef`/focus-management code is needed beyond what Radix provides; do not re-implement what `PwaInstallIosModal` hand-rolled (that component predates this primitive and has no real focus trap — this story does not retrofit it).
  - [ ] Create `packages/ui/src/core/confirm-action-dialog.test.tsx` per AC5.
- [ ] **Task 3 (AC6) — Wire exports.**
  - [ ] Add `export * from './core/confirm-action-dialog';` and the types export to `packages/ui/src/index.ts`, matching the `soft-delete-toaster`/`blocking-loader` entries' existing pattern.
- [ ] **Task 4 — Verification.**
  - [ ] `pnpm --filter ui run test` passes, including the new test file, no regression in existing `packages/ui` tests.
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root.
  - [ ] Manual smoke check (Completion Notes): a throwaway harness confirming visually that opening moves focus in, `Escape`/overlay/Cancel all return focus to the trigger, and a slow (artificially delayed) `onConfirm` visibly disables both buttons until it resolves. Remove the harness before marking done, matching Story 0.18's precedent.

## Dev Notes

- **Why this story exists:** surfaced during Story 3.6w's own creation (`bmad-create-story`, 2026-10-05) — `EXPERIENCE.md`'s CC-024 merge-confirmation entry specifies true focus-trap-plus-focus-return semantics that no existing primitive in this codebase provides. Confirmed via a full `Grep` across `packages/ui/src` and `apps/web/src`: zero `AlertDialog`/`ConfirmDialog` component exists, and `packages/ui`'s own `package.json` has no `@radix-ui/react-dialog` dependency at all. The nearest existing "modal" (`packages/ui/src/core/PwaInstallIosModal.tsx`) is a bespoke, hand-rolled implementation with `Escape`-only dismiss and **no real focus trap** (no focus moves into it on open, no focus-return on close) — it would not satisfy AC1 if reused or copied, and this story does not retrofit it (out of scope — see below). User confirmed via `AskUserQuestion` during Story 3.6w's creation: split this primitive into its own prerequisite story rather than build it inline inside 3.6w, so any future destructive-action confirmation (event delete, API key delete, etc.) reuses one accessible implementation instead of each story reinventing the same focus-trap logic — matching the Story 0.18 (Soft-Delete-with-Undo)/0.19 (Swipe-to-Reveal)/3.6ua (EventCardCompact extraction) split precedent.
- **Why not reuse `apps/web/src/components/ui/dialog.tsx`:** that file is a real, already-correct, Radix-backed `Dialog` wrapper (focus trap included, via Radix's own `Dialog.Content`) — but it lives in `apps/web`, not `packages/ui`, and is used by 9+ existing *form* dialogs there (`SetDefaultLocationDialog`, `ApiKeyFormDialog`, `LocationFormDialog`, etc.). `project-context.md`'s Code Organization rule requires reusable UI components to live in `packages/ui`; `packages/ui` cannot import from `apps/web` (the dependency direction is the reverse — apps consume packages, never the other way around), so this story cannot "just reuse" that file. **This story does not move/refactor `apps/web`'s existing `dialog.tsx` or its 9+ call sites into `packages/ui`** — that would be a much larger, separate consolidation with its own risk profile (every existing form-dialog call site would need re-verification) and is not what Story 3.6w's merge confirmation needs. Instead, this story builds a second, `packages/ui`-local, narrower primitive (`ConfirmActionDialog` — confirm/cancel only, no form-field slot) directly on the same underlying `@radix-ui/react-dialog` library apps/web already depends on, so both primitives share the same battle-tested focus-trap engine without one importing the other. This pre-existing package-boundary situation (a reusable-shaped component living in `apps/web` instead of `packages/ui`) is a known, accepted quirk this story's creation surfaced but does not fix — flag for a future cleanup pass if it recurs.
- **Why `role="alertdialog"`, not `role="dialog"`:** per the WAI-ARIA Authoring Practices, `alertdialog` is the correct role for a modal that interrupts the user specifically to confirm/cancel a consequential action (exactly this primitive's only use case) — `dialog` is the generic role `apps/web`'s existing form-dialogs correctly use instead, since they are not themselves a yes/no confirmation.
- **`packages/domain` reusable-mechanism check:** evaluated, not applicable — this is a React-UI/Radix-coupled component, matching Story 0.18's identical conclusion for `useSoftDeleteWithUndo`.
- **State-management categorization:** `isConfirming` is local component state (not Server/URL/Client-Global per `project-context.md`'s three-scope rule) — `open` itself is owned by the consumer (whatever scope its own triggering state lives in; for Story 3.6w that is local component state on the Duplicate Events tab).
- **Package dependency isolation:** `@radix-ui/react-dialog` is added to `packages/ui` only — no `apps/web` change (it already depends on the same library independently, for its own unrelated `dialog.tsx`/form-dialog usage).
- **Latest Tech Information:** confirm `@radix-ui/react-dialog`'s currently-published version at implementation time and match `apps/web`'s pinned `^1.1.21` exactly (do not independently pick a newer major) — two different versions of the same Radix primitive across two workspace packages risk subtly divergent focus-trap/`Portal` behavior with no benefit, since neither package imports the other's copy.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** `epic-0-readiness.md`'s `stories_covered` predates this story (it stops at 0.14 — see Story 0.18/0.17's own identical note). A fresh Gate 1/3 pass (persona Winston) found **no gap**: this story touches no DB/ORM/domain package, calls no external service, introduces no new API surface, and adds no auth/business-rule logic to the frontend — it is a pure `packages/ui`-scoped, already-pinned-dependency (`@radix-ui/react-dialog`) UI primitive with exactly the same risk profile as Story 0.18's `sonner` addition.
- **Gate 2 (UI Complexity & Reusability):** This story **is itself** a Gate 2 split — the finding and its resolution are documented above under "Why this story exists." No further split is needed within this story's own scope: a confirm/cancel dialog has no complex internal states beyond the `isConfirming` busy-state already specified (AC3), and it intentionally does not grow a form-field slot (that remains `apps/web`'s existing `dialog.tsx`'s job for its own call sites).

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No mismatch found.** No database, GraphQL schema, or `@festgrid/shared-types` involvement — a pure `packages/ui` React component operating entirely on caller-supplied props and callbacks.
- Impacted fields/contracts: None.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required — `ConfirmActionDialogProps` is a new, package-local type.
- Backward compatibility and rollout notes: Purely additive — a new component, a new `packages/ui` dependency (`@radix-ui/react-dialog`, already present elsewhere in the monorepo under `apps/web`), no existing behavior changes for any current page.
- Verification checks: `confirm-action-dialog.test.tsx` (Task 2/5); `pnpm build`/`pnpm lint` clean (Task 4).

### Project Structure Notes

- **New:** `packages/ui/src/core/confirm-action-dialog.tsx`, `confirm-action-dialog.types.ts`, `confirm-action-dialog.test.tsx`.
- **Modified:** `packages/ui/package.json` (new `@radix-ui/react-dialog` dependency), `packages/ui/src/index.ts` (new export lines).
- **Not modified:** `packages/domain`, `packages/database`, `apps/backend`, `apps/web` (including its own, separate `components/ui/dialog.tsx` — explicitly untouched, see Dev Notes), any `locales/*.json` file (no i18n strings owned by this story — every string is a plain caller-supplied prop).

### References

- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md § "Multi-Event Posts and Cross-Post Event Matching (CC-024)", item 6, final paragraph] — the exact focus-trap/focus-return confirmation contract this primitive implements.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, `components.modal`, lines ~164-166] — the shared overlay/dialog chrome tokens reused verbatim (AC4), same tokens `pwa_install_ios_modal` already cites.
- [Source: packages/ui/src/core/PwaInstallIosModal.tsx] — read in full; confirmed as a non-focus-trapping precedent this story does not reuse or retrofit.
- [Source: apps/web/src/components/ui/dialog.tsx, apps/web/package.json] — confirmed as the existing, correct, but `apps/web`-local (not `packages/ui`) Radix-`Dialog`-based wrapper and its pinned `@radix-ui/react-dialog@^1.1.21` version, matched by this story's own new dependency.
- [Source: packages/ui/src/core/ui/button.tsx] — confirmed existing `default`/`destructive`/`outline` `Button` variants this primitive reuses (AC4) rather than introducing new button styling.
- [Source: packages/ui/src/hooks/useSoftDeleteWithUndo.ts, packages/ui/src/core/blocking-loader.tsx] — version-pinning and plain-prop-copy precedents this story follows (Dev Notes).
- [Source: _bmad-output/implementation-artifacts/0-18-build-the-reusable-soft-delete-with-undo-ui-primitive.md] — the Gate-2-split-story precedent (numbering, structure, "reserved slot, first real consumer is a sibling story" framing) this story mirrors.
- [Source: _bmad-output/implementation-artifacts/3-6w-let-moderators-merge-duplicate-events-with-slug-redirects.md] — this story's own first real consumer (its merge-confirmation step), created in the same session that surfaced this Gate 2 split.
- [Source: _bmad-output/project-context.md#Code-Quality-Style-Rules] — `packages/ui` component-placement rule motivating this story's package boundary decision.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Quality & Style Rules (`packages/ui` core-primitive placement; `packages/domain` restriction, evaluated and not applicable), UI Patterns & UX Invariants, Testing Rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — reviewed; no `AD-N` rule binds this purely-frontend, no-DB, no-API primitive.
- [ ] `docs/infrastructure/index.md` — reviewed; frontend-only, `packages/ui`-scoped, no backend compute/queue/database involvement.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/ui/src/core/confirm-action-dialog.tsx`, `confirm-action-dialog.types.ts`, `confirm-action-dialog.test.tsx`.
- **Modified:** `packages/ui/package.json`, `packages/ui/src/index.ts`.
- **Not modified:** everything outside `packages/ui` (see Project Structure Notes).

### Rule Mapping

- Reusable UI primitive, `packages/ui/src/core/` placement → `project-context.md` UI Components & Scalability rule → Task 2.
- `EXPERIENCE.md`'s exact focus-trap/focus-return confirmation contract → Task 2's `Dialog.Content`/`onOpenChange` wiring (AC1).
- `DESIGN.md`'s `components.modal` tokens, reused verbatim (no new modal chrome) → Task 2 (AC4).
- Existing `Button` `default`/`destructive`/`outline` variants reused, no new button styling → Task 2 (AC4).
- `packages/domain` reusable-mechanism check → evaluated, not applicable (Dev Notes).
- Package dependency isolation (`@radix-ui/react-dialog` confined to the two packages that each independently need it, no cross-import) → Task 1, Dev Notes.

### Verification Plan

- `packages/ui/src/core/confirm-action-dialog.test.tsx`: focus-trap-in, `Escape`/overlay/Cancel-all-call-`onCancel`-and-return-focus, Confirm busy-state + success/failure paths, `confirmVariant="destructive"` rendering (Task 2/5).
- `pnpm --filter ui run test` full-suite pass, no regressions (Task 4).
- `pnpm build`/`pnpm lint` clean at the repo root (Task 4).
- Manual smoke-check harness, recorded in Completion Notes, removed before done (Task 4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build `ConfirmActionDialog` (`packages/ui/src/core/`) on top of `@radix-ui/react-dialog`, themed to `DESIGN.md`'s `components.modal` tokens and the existing `Button` variants; no feature-specific consumer built here (Story 3.6w is the first real consumer).
- [ ] Architecture and boundary confirmation: purely `packages/ui`-scoped; no `apps/web`/`apps/backend`/`packages/domain` change; `apps/web`'s existing, separate `components/ui/dialog.tsx` is explicitly left untouched, not moved or refactored.
- [ ] Testing plan confirmation: `confirm-action-dialog.test.tsx` (Vitest + Testing Library + `user-event`, no live backend involvement); manual smoke-check harness removed before completion.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 run fresh (persona Winston) — no gap. Gate 2 — this story *is* the split (documented above); no further split needed within its own scope.

## Testing Requirements

- [ ] Integration tests (required): `packages/ui/src/core/confirm-action-dialog.test.tsx` — focus-trap-on-open, `Escape`/overlay-click/Cancel-all-return-focus-and-call-`onCancel`, Confirm busy-state + resolve/reject paths, `confirmVariant` rendering.
- [ ] E2E tests: Not applicable — no product feature ships in this story; Story 3.6w owns the E2E coverage for its own real usage of this primitive.
- [ ] Manual verification (required before done): throwaway harness smoke check (Task 4), recorded in Completion Notes.

## Deliverables Checklist

- [ ] `packages/ui/src/core/confirm-action-dialog.tsx` (+ `.types.ts`, `.test.ts`) implementing the focus-trap/busy-state/variant contract above, exported from `packages/ui/src/index.ts`.
- [ ] `@radix-ui/react-dialog` added to `packages/ui/package.json`, version-matched to `apps/web`'s existing pin.
- [ ] `pnpm --filter ui run test`, `pnpm build`, `pnpm lint` all pass at the repo root.

## Out of Scope

- Moving, consolidating, or refactoring `apps/web/src/components/ui/dialog.tsx` or any of its 9+ existing call sites into `packages/ui` — a separate, larger cleanup, not required for Story 3.6w and not attempted here.
- Retrofitting `packages/ui/src/core/PwaInstallIosModal.tsx` (or any other existing bespoke modal) onto this new primitive — out of scope; flagged only as a future cleanup candidate.
- A generic form-dialog primitive (field slots, validation wiring) — this component is confirm/cancel only, by design.
- Any real feature consumer — Story 3.6w ("let moderators merge duplicate events") is the first, already written and depending on this story.
- Any PostHog/analytics event tied to opening/confirming/cancelling this dialog — this generic primitive has no domain knowledge; each consuming feature owns its own analytics instrumentation (Story 3.6w's own merge/undo events are specified in its own story file, not here).

## Definition of Done

- [ ] AC 1-6 satisfied.
- [ ] `confirm-action-dialog.test.tsx` passing (Testing Requirements — non-negotiable).
- [ ] `pnpm --filter ui run test` full-suite passing with no regressions.
- [ ] `pnpm lint` and `pnpm build` passing at the repo root, including `packages/ui`.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
