# FIND-022 forged handoff

- Separate scraping source, canonical publisher, and coauthor identities during vendor normalization; never infer ownership from producer array order.
- Create deduplicated unsubscribed profiles for verified identities; retain incomplete identities only as internal provisional records until a stable platform ID is backfilled.
- Verified IDs are subscribable from event detail/direct lookup. Broad account discovery excludes scrape-only profiles until intentional demand.
- Add normalized post-account role associations. Preserve `posts.accountId`; migrate legacy rows as scraping-source/publisher-unknown without historical guessing.
- Filter by the union of publisher, coauthor, and scraping-source associations.
- Event detail shows posted-at via the existing short-date formatter and coauthors below the original-post link. Shared account info uses a confirmed accessible subscribe/unsubscribe icon toggle; provisional identities are display-only.
- Track toggle success/failure with sanitized PostHog dimensions. Keep the toggle cap-agnostic; IDEA-008 owns the cap and upgrade CTA.
- Apify/Bright Data role normalization is a prerequisite. The PRD's “2” and IDEA-008's “5” cap conflict and remain out of scope.
- Next workflow: `bmad-spec`, then epic/story decomposition if needed.
