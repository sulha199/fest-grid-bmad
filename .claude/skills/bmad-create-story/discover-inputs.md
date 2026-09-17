# Discover Inputs Protocol

**Objective:** Intelligently load project files (whole or sharded) based on the workflow's Input Files configuration.

**Prerequisite:** Only execute this protocol if the workflow defines an Input Files section. If no input file patterns are configured, skip this entirely.

---

## Step 1: Parse Input File Patterns

- Read the Input Files table from the workflow configuration.
- For each input group (prd, architecture, epics, ux, etc.), note the **load strategy** if specified.

## Step 2: Load Files Using Smart Strategies

For each pattern in the Input Files table, work through the following substeps in order:

### 2a: Try Sharded Documents First

If a sharded pattern exists for this input, determine the load strategy (defaults to **FULL_LOAD** if not specified), then apply the matching strategy:

#### FULL_LOAD Strategy

Load ALL files in the sharded directory. Use this for PRD, Architecture, UX, brownfield docs, or whenever the full picture is needed.

1. Use the glob pattern to find ALL `.md` files (e.g., `{planning_artifacts}/*architecture*/*.md`).
2. Load EVERY matching file completely.
3. Concatenate content in logical order: `index.md` first if it exists, then alphabetical.
4. Store the combined result in a variable named `{pattern_name_content}` (e.g., `{architecture_content}`).

#### SELECTIVE_LOAD Strategy

Load a specific shard using a template variable. Example: used for epics with `{{epic_num}}`.

1. Check for template variables in the sharded pattern (e.g., `{{epic_num}}`).
2. If the variable is undefined, ask the user for the value OR infer it from context.
3. Resolve the template to a specific file path.
4. Load that specific file.
5. Store in variable: `{pattern_name_content}`.

#### INDEX_GUIDED Strategy

Load index.md, analyze the structure and description of each doc in the index, then intelligently load relevant docs.

**DO NOT BE LAZY** -- use best judgment to load documents that might have relevant information, even if there is only a 5% chance of relevance.

1. Load `index.md` from the sharded directory.
2. Parse the table of contents, links, and section headers.
3. Analyze the workflow's purpose and objective.
4. Identify which linked/referenced documents are likely relevant.
   - *Example:* If the workflow is about authentication and the index shows "Auth Overview", "Payment Setup", "Deployment" -- load the auth docs, consider deployment docs, skip payment.
5. Load all identified relevant documents.
6. Store combined content in variable: `{pattern_name_content}`.

**When in doubt, LOAD IT** -- context is valuable, and being thorough is better than missing critical info.

---

After applying the matching strategy, mark the pattern as **RESOLVED** and move to the next pattern.

### 2b: Try Whole Document if No Sharded Found

If no sharded matches were found OR no sharded pattern exists for this input:

1. Attempt a glob match on the "whole" pattern (e.g., `{planning_artifacts}/*prd*.md`).
2. If the declared load strategy is **FULL_LOAD** (or unspecified), load ALL matching files completely (no offset/limit) -- this is correct and intentional for inputs that genuinely need the whole picture (e.g. bmad-retrospective/bmad-correct-course's own PRD/epics rows).
3. **If the declared load strategy is SELECTIVE_LOAD or INDEX_GUIDED, do NOT fall back to a full load just because there's no sharded directory.** A single large whole file can still be read selectively via `scripts/md-outline.py`, which prints heading text and line ranges without ever printing body content:
   - **SELECTIVE_LOAD with a resolvable template variable** (e.g. epics + `{{epic_num}}`, where headings are uniformly `### Epic N: ...` / `### Story N.M: ...`): run
     `python3 {project-root}/scripts/md-outline.py find "^Epic {{epic_num}}:|^Story {{epic_num}}\." <file> --all`
     to get every matching heading's line range in one call, then Read each range via `offset`/`limit` and concatenate. If this finds nothing (exit 1) -- heading conventions may not match what was assumed -- fall back to a full load rather than silently returning nothing.
   - **SELECTIVE_LOAD with no resolvable template variable, or INDEX_GUIDED** (e.g. the PRD, whose sections don't key off `{{epic_num}}`): first check for a hand-authored outline doc sitting next to the whole file (e.g. `PRD-OUTLINE.md` alongside `prd.md`) -- if one exists, read it first; its grouped sections and one-line purposes make relevance judgment more reliable than bare heading text, and it already carries current line ranges (verify a range still looks right before trusting it blindly, since a hand-authored doc can drift after the source file changes). If no such doc exists, run
     `python3 {project-root}/scripts/md-outline.py outline <file> --max-depth 3`
     to get the full heading list cheaply (no body content), judge relevance from heading text the same way INDEX_GUIDED judges an index.md ("when in doubt, load it" still applies to this judgment call), then Read only the relevant ranges via `offset`/`limit`.
   - If `scripts/md-outline.py` fails to run (not "no match," but a real execution failure), fall back to a full load.
4. Store content in variable: `{pattern_name_content}` (e.g., `{prd_content}`), noting in the discovery report whether it was a full load or a selective range-read (so downstream steps know the content may be partial).
5. Mark pattern as **RESOLVED** and move to the next pattern.

### 2c: Handle Not Found

If no matches were found for either sharded or whole patterns:

1. Set `{pattern_name_content}` to empty string.
2. Note in session: "No {pattern_name} files found" -- this is not an error, just unavailable. Offer the user a chance to provide the file.

## Step 3: Report Discovery Results

List all loaded content variables with file counts. Example:

```
OK Loaded {prd_content} from 5 sharded files: prd/index.md, prd/requirements.md, ...
OK Loaded {architecture_content} from 1 file: Architecture.md
OK Loaded {epics_content} from selective load: epics/epic-3.md
-- No ux_design files found
```

This gives the workflow transparency into what context is available.
