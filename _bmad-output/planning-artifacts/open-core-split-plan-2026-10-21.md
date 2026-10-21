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
