---
name: bmad-png-to-html
description: 'Reconstructs a UI element''s design-reference PNG(s) into a validated static HTML/Tailwind prototype, screenshot-checked against the source image, before DESIGN.md/EXPERIENCE.md tokens are authored from it. Use when the user says "generate html from this design", "convert this png to a tailwind template", or "png to html". Only applies when the target element already has a reference image/layout -- not for prose-only UX work. Also invocable as a bmad-ux creative tool.'
---

# PNG to HTML

## Why this exists

A raster reference image that gets redescribed in prose (as `DESIGN.md`/`EXPERIENCE.md` tokens) can silently drift from what the image actually shows -- nothing forces the description to match the picture. This skill closes that gap: it produces a faithful, code-native HTML/Tailwind reconstruction of the PNG(s), built from the project's *real* Tailwind theme, stores it as a versioned file, and validates it against the source image *before* anything downstream is allowed to treat it as ground truth.

## When to use

Only when the element already has a reference PNG/image with an established layout. Skip for prose-only design work, or for early/exploratory mockups still expected to be redrawn -- a faithful pixel-level prototype of something that will be thrown away next iteration is wasted effort. If unsure whether a design is "established" enough to warrant this, ask.

## Inputs

- One or more PNGs, grouped by component + state. If the project already uses a `<component>/<state>.png` folder convention (e.g. `design-artifacts/<run>/imports/<component>/<state>.png`), respect it; if given loose files, group them by component + state before proceeding -- output paths depend on this grouping.
- The project's real Tailwind theme/tokens: `tailwind.config.*`, a shared UI package's theme file, and/or the relevant `DESIGN.md` component tokens if any already exist for this area.

## Process

### Step 1: Locate the theme

Read the project's actual Tailwind config and (if present) `DESIGN.md`'s existing token vocabulary for this component family. Reuse existing token names/classes; never invent a new arbitrary value when an existing token already covers it -- that's exactly the kind of divergence this skill exists to prevent further downstream.

### Step 2: Reconstruct each PNG as HTML

For each PNG, view it directly and author one static HTML file at `<design-artifacts-run>/prototypes/<component>/<state>.html` (mirroring the source PNG's `imports/<component>/<state>.png` path, extension swapped):

- Self-contained: inline `<style>` or the Tailwind CDN play script, no build step, no JS, no network calls -- must render fully offline from a plain `file://` open.
- Real content copied from the PNG (exact strings, not lorem/placeholder) so a later comparison isn't confounded by different text.
- Match structure, spacing, hierarchy, and sizing as closely as literal inspection of the PNG allows. Fidelity is the entire point -- this file stands in for "someone describing the image in words."
- A one-line comment at the top of the file naming the source PNG and the component/state it represents.

### Step 3: Validate

**Automated self-check -- always required, never skip:**

1. Render the HTML headlessly and screenshot it (see `references/validation-script.md` for a ready-to-run Playwright driver).
2. Compare the rendered screenshot against the source PNG directly (side-by-side, multimodal). Name every structural/spacing/sizing/color discrepancy explicitly -- "looks close" is not a finding.
3. Fix the HTML and re-render until no discrepancy remains, or a discrepancy is a deliberate, explicitly-called-out deviation (state it in the file's top comment and in the validation log below).

**Human sign-off -- optional, off by default:** publish the HTML as an Artifact so the user can open it live and comment on anything the automated check can't judge (subjective intent calls, e.g. "make this more prominent than the PNG even shows"). Only do this when the user asks for it, or when the automated check surfaces something genuinely ambiguous.

### Step 4: Record and report

Append one line per prototype to `<design-artifacts-run>/prototypes/validation-log.md` (create if absent):

```markdown
- `<component>/<state>.html` -- validated <date> -- <"exact match" or a one-line summary of accepted deviations>
```

Report back to the caller only: the prototype file paths written, their validation status, and a one-line caption per file. Do not dump the full HTML or the intermediate screenshot comparisons into the response.

## Output contract (for `bmad-ux` or any caller)

Downstream token authoring (`DESIGN.md`/`EXPERIENCE.md`) should read tokens **from these validated HTML files' actual classes**, not re-describe the source PNG directly, whenever a validated prototype exists for the component being specified. Fall back to describing the raw PNG only when no prototype exists.

## Anti-patterns

- Do not invent layout details the PNG doesn't clearly show -- if something is ambiguous or cropped out, ask rather than guess.
- Do not skip the automated screenshot comparison, even for a visually "simple" component -- that check is the entire reason this skill exists.
- Do not treat human Artifact sign-off as required by default -- it is opt-in only.
- Do not reach for an arbitrary Tailwind value (`w-[123px]`, a one-off hex color) when an existing project token already covers the same value.

## Integration with `bmad-ux`

Can be registered in `bmad-ux`'s `{workflow.creative_tools}` (via `bmad-customize`, entry `skill:bmad-png-to-html`) so its "Layout extracted, artifacts promoted" Finalize step invokes it automatically for any `imports/` entry that is an image, before lifting visual decisions into `DESIGN.md`. Until wired in that way, invoke this skill directly ahead of any design-token authoring pass over a reference PNG.
