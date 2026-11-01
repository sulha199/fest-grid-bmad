---
backlog_id: IDEA-035
title: "Formalize scroll-to-top-on-filter-reset as a cross-surface EXPERIENCE.md convention"
captured: 2026-09-15
---

# IDEA-035: Formalize scroll-to-top-on-filter-reset as a cross-surface EXPERIENCE.md convention

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Surfaced during Story 0.i5b (bmad-create-story, 2026-09-15): Gate 2 found neither DESIGN.md nor EXPERIENCE.md addresses whether a filter change should scroll a list view back to top. User chose (via AskUserQuestion) to add this behavior to Discovery's home-content.tsx now — window.scrollTo({top:0}) fired from useListPaginationController's onReset, reusing useCollapseHeaderOnScroll.ts's existing reduced-motion-aware convention — but explicitly as a single-surface implementation, not a binding EXPERIENCE.md rule. This idea tracks formalizing it into a documented cross-surface convention if/when Feed/Favorites or other useListPaginationController adopters need the same treatment. Not promoted to a story; no adoption story references it yet. UPDATED 2026-09-30 (Story 0-i5e): Feed (feed-content.tsx) and Favorites (favorites-content.tsx) now also implement scroll-to-top-on-filter-reset the same way, via AskUserQuestion during Story 0.i5e's creation. All 3 current useListPaginationController adopters (Discovery, Feed, Favorites) now implement this behavior — still recorded here as a documented convention, not promoted to a binding EXPERIENCE.md rule by this story. CLOSED 2026-10-07 (bmad-quick-dev, documentation-only): formalized as a new 'Scroll-to-Top on Filter Reset' subsection under EXPERIENCE.md's Component Patterns, documenting the onReset snippet and its reuse of useCollapseHeaderOnScroll.ts's reduced-motion convention. No application code touched — the three existing adopters already matched the documented behavior exactly.
