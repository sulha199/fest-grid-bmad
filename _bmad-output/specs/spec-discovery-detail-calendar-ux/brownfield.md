# Brownfield Notes — Discovery, Event Detail & Calendar UI Refinements

Current-state references and implementation-shape notes for `SPEC.md`'s capabilities. HOW-level detail; the kernel holds WHAT/success only.

## Shared prerequisite: missing shadcn primitives

`apps/web/src/components/ui/` currently has only: `button.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `switch.tsx`, `table.tsx`, `select.tsx`, `radio-group.tsx`, `textarea.tsx`.

Missing and required by this work: **popover** (CAP-1, CAP-4), **badge** (CAP-1), **carousel** (CAP-2, pulls in `embla-carousel-react`), **calendar** (CAP-4, month-grid date picker). Add all four via the shadcn CLI in one pass before starting CAP-1/CAP-2/CAP-4.

## CAP-1 — FilterHub compact dropdown

- Component: `packages/ui/src/features/events/FilterHub.tsx`, composing two `MultiSelect` instances from `packages/ui/src/core/multi-select.tsx` (type, category) above `LocationRadiusFilter`.
- Current layout: `flex-col gap-6`, each `MultiSelect` always-rendered as a labeled, wrapped row of pill-toggle buttons (`role="group"`, `aria-pressed` per option).
- Current selected-state styling is hardcoded (`bg-blue-100`/`text-blue-800` light, `bg-blue-900/50`/`text-blue-100` dark) — not theme-token-driven. Moving to a shadcn `Button` `variant="default"`/`"outline"` trigger fixes this incidentally (uses `bg-primary`/`text-primary-foreground` tokens).
- Target shape: each facet's label + pill row moves inside `PopoverContent`, behind a `Button` trigger showing the facet label; trigger variant flips on `selectedValues.length > 0`; a `Badge` positioned `absolute -top-1.5 -right-1.5 rounded-full text-[10px]` shows the count, rendered only when count > 0.
- `FilterHub`'s existing top-of-panel "Clear all" (`hasSelection` gate, right-aligned button) moves inline into the new single-row layout alongside the three triggers (type, category, location).
- `MultiSelect`'s own per-item `hideClearAction` prop is currently passed `true` by `FilterHub` for both instances (relies solely on FilterHub's top-level clear). **Decision:** stop passing `hideClearAction` for the type/category instances — each popover now also shows `MultiSelect`'s existing per-facet Clear button (already implemented and gated by `hideClearAction`, just currently suppressed) alongside the top-level Clear-all.
- `useOptimistic` + `startTransition` toggle pattern inside `multi-select.tsx` should be preserved as-is inside whatever wraps the list in the popover.

## CAP-2 & CAP-3 — Event detail navigation and modal close

- File: `apps/web/src/features/events/EventDetailWrapper.tsx`.
- Current prev/next: a hand-built `navigationHeader` block (~lines 302–350) with two `<button>`s (`ChevronLeft`/`ChevronRight` from `lucide-react` + visible `t("previous")`/`t("next")` text), calling `handlePrevious`/`handleNext`.
- `handleNext` awaits `nav.requestNext()` (from `useListNavigationForEvent`, in `./navigation-hook`) and, if a target exists, does `router.replace('/events/${target.item.slug}${paramsStr}')`. `handlePrevious` reads `nav.previous.target` synchronously and does the same replace. This is **async, route-driven, single-item navigation** — a new event is fetched by slug on each step, not a pre-loaded set of slides.
- Existing state to preserve when remapping onto Carousel controls: `nav.previous.disabled`, `nav.next.disabled`, `nav.next.loading` (shows an inline spinner in place of the "next" label today).
- `nav.hasListContext` gates whether prev/next render at all; when false and not `isModal`, a "Back to Events" button renders instead — that branch is unaffected by this work.
- Modal close button (~lines 340–348): a bare `<button>` with `onClick={() => router.back()}`, visible text `{t("closeModal")}`, and `aria-label={t("closeModal")}` — no icon today, and this button does **not** go through the shared `apps/web/src/components/ui/dialog.tsx` `DialogClose` (that file already does the target pattern correctly: `<X className="h-4 w-4" /><span className="sr-only">Close</span>`, no visible text). CAP-3 brings this button in line with that existing pattern — swap the visible `{t("closeModal")}` text for an `X` icon, keep `aria-label`, add a `sr-only` span.
- i18n: `t("closeModal")`, `t("previous")`, `t("next")` come from the `EventDetailsPage` namespace (`useTranslations("EventDetailsPage")`). Check `apps/web/locales/{en,id}.json` under that namespace — `closeModal`'s value becomes the `aria-label`/`sr-only` text only; `previous`/`next` may still be needed as `aria-label`s on the carousel's arrow controls even though their visible text goes away.
- Governing project rule (`project-context.md`, "Context-Aware Detail Views"): detail-view navigation must inherit list context (search/filters/sort) and must seamlessly background-fetch the next page at a list boundary. CAP-2 must not regress this — it only changes the control chrome, not `useListNavigationForEvent`'s contract.

## CAP-4 & CAP-5 — Calendar week picker and Monday week start

- Hook: `packages/ui/src/hooks/useWeeklyCalendarController.ts`.
- Current week-start logic:
  ```ts
  export const getSunday = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 = Sunday
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);
    return sunday.toISOString().split('T')[0];
  };
  export const getSaturday = (sundayStr: string) => { /* +6 days */ };
  ```
  `weekStart = getSunday(week)`, `weekEnd = getSaturday(weekStart)`. `handlePrevWeek`/`handleNextWeek` shift `weekStart` by ∓7 days and re-derive from there.
- CAP-5 changes the boundary math to Monday-start (`getDay() - ((day + 6) % 7)` or equivalent) and the paired end-of-week helper to Sunday (+6 from the new Monday start). Rename `getSunday`/`getSaturday` to boundary-accurate names (e.g. `getWeekStart`/`getWeekEnd`) since "Sunday" becomes inaccurate; update every call site.
- Test file `packages/ui/src/hooks/useWeeklyCalendarController.test.tsx` currently asserts Sunday-start behavior — these assertions need updating to Monday-start, not just the implementation.
- Consumers: `WeeklyCalendarView.tsx` (`packages/ui/src/features/events/`) and the higher-level controller extraction in `3-7a-extract-shared-weekly-calendar-controller-hook.md` — not read line-by-line in this pass; verify at implementation time that no other consumer hardcodes Sunday-specific assumptions (e.g. a 7-day grid header starting "Sun").
- CAP-4's new control: a `Button` + `Popover` + `Calendar` (shadcn date picker) placed alongside the existing prev/next buttons. On date selection, derive that date's week start via the same (now-Monday) helper used everywhere else in the hook, then call the existing `setWeek(...)` / fire `onNavigate` exactly as `handlePrevWeek`/`handleNextWeek`/`handleToday` already do — no parallel boundary math.

## Placement convention (all capabilities)

Per `project-context.md`: reusable domain-feature components live in `packages/ui/src/features/<domain>/` (e.g. `events/`); generic, domain-agnostic primitives (new popover/badge/carousel/calendar wrappers if any app-specific wrapping is needed beyond the raw shadcn generation) live in `packages/ui/src/core/`.
