# Open-core split: public core, private premium (plan, 2026-10-21)

Decision (owner, 2026-10-21): FestDaily becomes **open-core**. The core stays public under MIT. Premium code (personalization is the first premium feature) lives in a private package and private repository. This plan says what that needs; nothing in it has been executed. See FIND-093 (the repository is public today and already contains premium planning and production findings).

## 0. Revision, later on 2026-10-21: a paid app, a secret recipe, a portfolio

The owner then said: the app will be **paid**; everything about personalization is the **secret recipe**, including the BMad documents, the POC and the personalization backend; and the project should also be a **portfolio** piece. The owner's idea: one **private parent repository** with a **public child sub-repository** (a git submodule) that can be changed from the parent. The owner asked for a recommendation. Sections 1 to 7 below were written before this and assume the premium code is a private package beside a public core; they still hold, with the following changed.

### Structures compared

| | A. Private parent + public submodule (the owner's idea) | B. Private monorepo + generated public mirror (recommended) | C. Public core + private premium overlay repo |
|---|---|---|---|
| Source of truth | Core in the public repo, the rest in the parent | One private repository holds everything | Core public, premium private |
| Deploys from | The parent (checks out the submodule) | The private repository | The premium repository (checks out the core at a pinned version) |
| Public repo | A real repository; accepts pull requests | A read-only mirror of an allow-list of paths, republished by a script; fresh history | A real repository |
| Day-to-day | Two repositories and a pointer commit; the child must be pushed before the parent | One checkout, one CI, atomic changes across core and premium | Two repositories, version pinning |
| Main risk | One `git push` from inside the submodule folder publishes whatever is in it | A bad allow-list publishes a file; a CI check on the mirror tree catches it | Version drift, two CIs |
| Existing history | Needs a new, clean public repository for the child anyway | The current repository becomes the private one and keeps issues, secrets and the Vercel link; the public mirror is new | Same problem as A |
| Fit for a paid app and a portfolio | Good | Best: premium and every BMad document never touch a public remote | Good for community-driven cores, more than needed here |

### Recommendation: B

Make the existing repository private (it becomes the working repository and keeps its history, issues, Actions secrets and Vercel link). Publish a **clean, new public repository** as the portfolio from an allow-list of paths, by a script and a workflow, with a CI test that fails if a premium path or a banned string reaches the mirror. The mirror has none of the existing history, so what is public today (the planning documents, the POC, the production findings) is not carried into the portfolio. Choose A if the owner wants the public repository to be a living repository that takes outside contributions; the cost is the submodule friction and the accidental-publish risk above.

### What changes in the earlier sections

* Everything under `_bmad-output/` and the BMad tooling configuration stays private; the public mirror carries `docs/infrastructure/` (the architecture diagram and tech stack, which suit a portfolio), a README written for the portfolio, and the core code.
* "Premium" now means **personalization as a whole** (AD-42, the proposal, the audience, tracks, taxonomy, profile and ranking work, the POC code and results, and the premium parts of the PRD and spine). The core keeps duplicate merging, event groups, the place model and the area filter and label, moderator queues, scraping, AI extraction of events, the AI prompt filter. The ports of section 3 are how the core calls premium code, so the public mirror still builds with no-op defaults.
* Because the repository stops being public, sections 3 and 5 no longer need a private registry for the package: premium code can live in the private repository's own workspace packages and be left out of the mirror by the allow-list. The ports and the stub stay, so the mirror compiles and runs.
* **License.** The existing code was published under MIT and copies already taken stay MIT. Private code can be proprietary. The mirror's license is a choice: MIT (anyone may fork the core) or a source-available license that forbids commercial use (a portfolio that cannot be resold as a competing product). Take advice.
* **Costs to check:** GitHub Actions minutes for a private repository; Vercel's free plan is for non-commercial use, so a paid product probably needs a paid plan.

## 0b. Revision 3, still 2026-10-21: split by client and server (the owner's axis), recommended over section 0

The owner proposed: the **frontend public** (it changes most and benefits from the free GitHub Actions minutes of a public repository) and the **backend and database private** (they change less and hold the secret recipe), and named the package/domain boundary as the likely conflict. Nothing is migrated until all personalization epics are ready for development. This replaces the recommendation of section 0: it follows the client/server line, which is also the line the secret follows.

### Why this line is better

* The secret recipe is server-side (extraction contract, guards, taxonomy, profile, ranking). The frontend bundle is downloadable by every user, so publishing its source loses little, provided no scoring weights or guard rules ever reach it.
* Dependencies already point the right way: the private side may depend on public packages, never the reverse.
* Vercel can deploy the frontend straight from the public repository, so no private submodule access is needed; the backend and infrastructure deploy from the private repository.
* A Next.js PWA with i18n, a design system and tests is a strong portfolio; the backend architecture can be shown through public documents and diagrams without its code.

### Topology

* **Private parent repository** (today's repository, made private; it keeps history, issues, secrets): `apps/backend`, `apps/infrastructure`, `packages/database`, `packages/graphql-select`, the new premium packages, `_bmad*`, `.claude`, `_bmad-output`, private documents. It contains the public repository as a **git submodule** (the owner's original idea) so one checkout still builds and tests everything and a change can be made from the parent.
* **Public child repository** (new, created by extracting the history of the public paths with `git filter-repo`, after a secret scan): `apps/web`, `packages/ui`, `packages/analytics`, `packages/shared-types`, `packages/domain`, the config packages (`eslint-config`, `typescript-config`, `testing-config`), `packages/visual-audit`, the portfolio README and sanitized `docs/infrastructure`.

### The package boundary, from the real imports (2026-10-21)

| Package | Imported by the web app | Imported by the backend | Side |
|---|--:|--:|---|
| `ui` | 94 files | 0 | public |
| `analytics` | 59 | 0 | public |
| `shared-types` | 9 | 17 | public (shared) |
| `domain` | 26 (about 20 symbols: platform helpers, the query-condition builders, `selectDisplaySchedule`, `computeDistanceKm`, the filter types and summary) | 84 | public as it is |
| `database` | 0 | 198 | private |
| `graphql-select` | 0 | 16 | private |
| `eslint-config`, `typescript-config`, `testing-config`, `visual-audit` | 0 | 0 | public (tooling) |

* **`packages/domain` can stay public unchanged.** The secret recipe is new code, not code that lives there today; the existing contents (dedup scoring, group detection, filters, geolocation, email templates, gateway helpers) are core features. So no refactor of the 84 backend files is needed. The rule that replaces it: **premium logic never goes into a public package**; it lives in new private packages (for example `packages/premium-domain`) that only the backend imports. (A quick audit of `domain/ai-gateway` and `domain/scraper` for anything that should not be public comes before the migration.)
* **AD-42 Rule 9 changes.** The reference scorer was to live in `packages/domain` and the chips were to be derived in the browser from the same function; that would put the weights in the public bundle. Instead the scorer lives in the private premium package and the server returns coarse match reasons per event (for example the matched interest keys), never weights.
* **GraphQL contract.** The web `codegen.ts` reads `../backend/src/schema/**/*.graphql`. After the split the private repository exports the schema to the public one (a CI job commits `contract/schema.graphql`, or the submodule path is the contract). The schema lists every type, including moderation; the moderation screens are already in the web bundle, so little is added. Premium-only internals can be stripped by a marker.
* **Tests.** Web end-to-end tests that call the backend run against a mock server in the public repository; the full end-to-end run is a scheduled job in the private one.
* **CI minutes.** The public repository gets unlimited standard-runner minutes; the private one has a monthly allowance on a free plan, so use path filters and run backend integration tests only on backend changes.
* **Documents.** `_bmad-output`, the memlogs and the BMad tooling configuration are private. Public documents are the portfolio README, the architecture diagram and tech stack (sanitized), and the frontend documentation.

### Before and after the migration

* The migration waits until the personalization epics are ready for development, then happens before any premium code is written, so no premium code is ever pushed to a public remote. Until then the planning documents stay in this repository, which is public: the AD-42 text, the proposal, the POC and its findings, the labelling guide. The owner may flip the repository to private at any time without migrating anything (a settings change, reversible); doing so now closes that exposure and takes the portfolio offline until the public child exists.
* Costs to check: the GitHub plan for the private repository; Vercel's free plan is for non-commercial use, so a paid product probably needs Pro; the licenses (the existing MIT copies stay MIT; the public child can keep MIT or use a source-available license; the private code is proprietary). Take advice.

## 0c. Adopted (owner, 2026-10-21): the client/server split, three repositories, and how the interim works

Adopted as the plan: the split of section 0b. The owner changed one point: the **current repository stays as it is**, paused (no GitHub Actions), as a public portfolio artifact with a link to the new public repository; the migration creates **two new repositories**, a private parent and a public child (the frontend and shared public packages).

| Repository | Visibility | Role |
|---|---|---|
| Today's `sulha199/fest-grid-bmad` | public, frozen | Portfolio artifact of the project and its method on `master`; GitHub Actions disabled (or the repository archived); a README link to the public child; its Vercel connection, secrets and integrations removed after the cut-over. |
| New private parent | private | Backend, infrastructure, database, `graphql-select`, the premium packages, all BMad documents and tooling; includes the public child as a submodule; deploys the backend. |
| New public child | public | Frontend and shared public packages (section 0b); Vercel deploys the production frontend from it, so the production URL does not change. |

### Interim rules (owner decision: keep the repository public, work only on this branch)

* All work goes to the branch `claude/ecstatic-shannon-e8eh9h` and nowhere else. No pull request and no merge into `master`: on 2026-10-21 `master` holds none of the personalization planning, the POC, the production findings or this plan (the branch is 93 commits ahead of it and holds all of them; `master` has 2 commits the branch does not), so the artifact repository stays clean of them.
* The migration starts only when the personalization epics are ready for development. Before it, merge `master` into the branch once more (other work lands there), run the secret scan, and migrate from that merged state. Premium code is written only after the migration.
* After the migration the branch is deleted. Deleting it does not unpublish what was pushed: the commits stay fetchable by their hash on GitHub until it collects them, clones and caches may keep copies, and the repository has 0 forks and 1 star today. If something in the branch must not stay (a key, a person's data), GitHub's sensitive-data removal process is the route, not branch deletion. The interim exposure (the planning documents on the branch) is accepted by the owner.
* Until then the production frontend and backend keep deploying from `master` of this repository as they do today.

### Still open

How much history the new repositories carry (the private parent can start from the branch with its history; the public child either keeps only the history of its paths, after a secret scan, or starts fresh); the licenses of the public child and the artifact; whether to archive the old repository or only disable Actions; the registry or submodule details; the GraphQL contract export; the Vercel plan.

## 0d. Recommendations on the open items of section 0c (architect, 2026-10-21; for the owner to decide)

| Item | Recommendation | Why |
|---|---|---|
| History in the new repositories | **Private parent:** start from the merged branch with its full history. **Public child:** keep the filtered history of its paths only if a secret scan and a commit-message audit pass (no premium, AD-42 or BMad references; rewrite the few that fail with `git filter-repo --message-callback`); otherwise start with one clean commit that links to the artifact repository. | The private history is not exposed and is worth keeping (blame, the decision trail). A real history is better portfolio evidence than a squash. |
| Licenses | Artifact repository: stays MIT (cannot be retracted) with a "frozen, development moved" note. Public child: a source-available license that forbids commercial use, such as PolyForm Noncommercial 1.0.0 (MIT only if maximum friendliness matters more than blocking a resold copy). Private code: all rights reserved. Take a short legal check before charging. | The frontend is useless to a competitor without the backend, but a license that says so costs nothing. Not legal advice. |
| Archive or only disable Actions | **Archive**, after: the README link is added, workflows disabled, repository secrets deleted, the Vercel project and any GitHub App disconnected, and the work branch deleted. | Archived is read-only (no Actions, no accidental pushes) and reversible. |
| Registry or submodule | **No registry.** The parent includes the public child as a submodule at a fixed path and lists its `apps/*` and `packages/*` in the pnpm workspace, so the backend uses the public packages as workspace links; the child builds standalone. Pin the child's commit in the parent. Rule: deploy the backend first and keep changes additive, so the deployed web never meets a schema it does not know. | Simplest thing that works with Vercel and CDK; no tokens in the build. |
| GraphQL contract | The backend owns it. A script in the parent (`contract:export`) writes `contract/schema.graphql` into the child (premium-only internals stripped by a marker); the private CI fails when the child's copy is stale; the public CI generates its types from that file and runs end-to-end tests against a mock server. | No bot and no registry; staleness cannot go unnoticed. |
| Vercel and GitHub plans | **Vercel Pro as soon as you charge** (Vercel's documentation limits Hobby to non-commercial personal use). GitHub: standard runners are free in the public child; the private parent has a monthly allowance on a free plan (2,000 minutes; Pro and Team 3,000), so use path filters and run backend integration tests only on backend changes. | Both from the providers' own documentation, checked 2026-10-21. |
| Secret scan | Run it **now** on this repository, not at the migration. | The history is already public; a leaked key must be rotated whenever it is found. |

## 1. Why the timing is good

No premium code exists in production yet. What exists is planning (AD-42, the proposal), a POC under `apps/backend/scripts/poc-event-insight/`, and its analysis files. So the split costs a documentation move and a seam, not a rewrite. The longer premium code is written in the public repository first, the more has to be extracted later.

## 2. The line between core and premium (needs the owner)

| Capability | Recommended side | Reason |
|---|---|---|
| Duplicate merging, event groups, the place model and precision, moderator queues | core | Catalogue quality; the free product needs it. |
| Date-ordered Discovery, FilterHub, the area filter, "in your area" by the viewer's location | core | The base product. |
| Audience extraction (country, geo scope, language) as stored data | core data, premium logic `[to decide]` | Needed to filter by area for everyone; the guards, prompt and ladder are the valuable part. |
| Tracks and eligibility, the "for age N" filter | premium | Personalization. |
| Interest taxonomy, the interest profile, onboarding chips, the sensitive-interests switch | premium | Personalization. |
| Recommended sort (the bounded date discount) and its replay and experiments | premium | The headline premium feature. |
| AI prompt filter (PRD 3.15) | core today | Already shipped and free. |

## 3. How the seam works

* **Ports in the core.** The public code defines narrow interfaces with a no-op default: `InsightProvider` (extract and guard an event's insight), `RankingStrategy` (the order of a Discovery page), `InterestProfileStore`, `EntitlementPolicy` (may this user use premium feature X). The core builds, runs and passes its tests with the no-op defaults. The spine already uses this shape for scrapers (the adapter pattern rule).
* **Private package.** `@festgrid/premium` (private repository) implements the ports. The production build installs it from a private registry (GitHub Packages or a private npm scope) with a read token in the Vercel and CDK builds; a public build installs a stub and sees "premium not available".
* **Entitlements on the backend.** A resolver or job checks the user's plan before calling a premium port; the plan lives in the database. Hiding a button is not protection: frontend code is readable whatever the repository visibility.
* **Database.** Open choice: (a) the public schema carries generic nullable columns (`insight` jsonb) and premium tables are created by migrations that ship in the private package; or (b) all migrations stay public and reveal the premium table names. (a) hides more but fights the single migration journal and the CI rule that journal times strictly increase; (b) is simpler.
* **GraphQL.** Premium fields (the RECOMMENDED sort, profile queries) either live in a schema extension merged at build time from the private package, or appear in the public schema as unavailable-by-default. The first hides the feature, the second is simpler.
* **Frontend.** Premium screens (chips, the sort toggle, the Settings switch) can live in the private repository as a web package loaded when present. Their text and layout still ship to every browser that uses them.

## 4. Splitting the BMad documents

The planning artifacts under `_bmad-output/` and the memlogs are one tree in one repository. Proposed classification:

| Path | Side | Note |
|---|---|---|
| `planning-artifacts/prds/.../prd.md` | public core PRD; premium sections move to a private PRD addendum | The second PRD pass for personalization is written in the private repository. |
| `planning-artifacts/festgrid-architecture-spine.md` | public, minus AD-42 and the premium parts of AD-39 Rule 8 | A private `festgrid-architecture-spine-premium.md` holds AD-42; the public spine lists "AD-42: defined in the private architecture; the core exposes the ports of Rule 3 of AD-43". |
| `planning-artifacts/event-insight-poc/` (proposal, plan, labelling guides, analyses, `results/`) | **private** | Premium design and production findings (counts, AWS facts, the user count). |
| `planning-artifacts/event-insight-poc/prod-readonly/` (briefs, role scripts) | private | Operational and security detail. |
| `implementation-artifacts/backlog.yaml` and `backlog/*.md` | split: premium and production-security rows move | IDEA-074, 092, 093, BUG-073 and FIND-093 are the first candidates. |
| `.memlog.md` files | private copy from now on; public copy keeps core entries | Decisions about premium and production belong with the private tree. |
| `epics.md`, stories, sprint status | core public; premium epics private | Epic 10 (personalized Discovery) is premium. |
| `apps/backend/scripts/poc-event-insight/*.ts` | move to the private repository when the split happens | Already public and MIT; copies already taken stay MIT. |

What cannot be undone: everything pushed so far is in the public history and in anyone's clone. Removing files going forward is possible; rewriting history (`git filter-repo` and a force push) removes it from this repository but not from copies, breaks forks and open branches, and is only worth it for something that must not stay (a key, a person's data), which the secret scan should settle first.

## 5. Phases

1. **Now:** agree the boundary (section 2); decide where new premium and production-sensitive documents go (the private repository, created now and added to this session's scope, or the public one until the split).
2. **Private repository:** create it, move the classified documents with their history if wanted, give each repository its own `CLAUDE.md` and BMad paths; the cloud session adds both repositories.
3. **Seam:** define the ports in the core with no-op defaults and an architecture decision for them (AD-43), before any premium code is written for production.
4. **Premium package:** the AD-42 implementation is built in the private repository on the ports.
5. **Pipeline:** the private registry, the read token in Vercel and the CDK build, a stub fallback, CI for both repositories.

## 6. Risks

Two repositories double the pull requests, CI and secrets for anything that spans both; the version of `@festgrid/premium` and the core can drift (pin it, test the pair); a public contributor cannot run the premium tests; the Vercel plan and GitHub Actions minutes for private repositories need checking; a bug in the seam fails open or closed and needs a test either way (no premium without entitlement; the core still works without the package).

## 7. Decisions still open

The boundary in section 2; where new premium documents go meanwhile; the registry (GitHub Packages, private npm, or a git submodule); the schema choice (a) or (b); the GraphQL choice; whether to remove production findings from the public history.
