# Open-core split: public core, private premium (plan, 2026-10-21)

Decision (owner, 2026-10-21): FestDaily becomes **open-core**. The core stays public under MIT. Premium code (personalization is the first premium feature) lives in a private package and private repository. This plan says what that needs; nothing in it has been executed. See FIND-093 (the repository is public today and already contains premium planning and production findings).

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
