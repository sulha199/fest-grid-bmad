# Round 3, notifications and session loss: investigation report (2026-10-20)

Investigate-and-report only. Nothing fixed, deployed, sent, committed or pushed. No token, cookie, JWT, session or env value was printed or saved.
Round 3 SQL was run by me on `readonly_2` (read-only, primary, not a replica) with your approval. Code reading used the current master-based worktree, not the planning branch.

## 1. Summary block (40 lines)

ROUND 3 (measured by me today unless marked)
 8 recall-replay: 181 reachable pairs (brief said 178). 25 are in the candidate list. 33 should have scored mid/high but are not
   listed (newer full event: 4 high + 25 mid; newer stub: 4 mid). Of 58 mid/high pairs, 25 listed (43%). 123 stub pairs score low, none listed.
 9 place quality: 1,431 events (267 stub, 1,164 full; 452 open). Open full (323): 106 trusted pin, 153 untrusted pin, 42 text only, 22 none.
   Open stub (129): 49 / 60 / 16 / 4.
10 compound probe (100 Geoapify requests): right country for 21 labelled venues: stored text 4, qualifiers removed 11, venue segment only 16
   (13 with conf >= 0.5), + city 16. The Indonesia bias changed nothing. Confidence cannot separate right from wrong ("Court 2" -> Canada 1.00).
11 multi-place: 15 events hold more than one place (~1%); 7 more have several schedules and no place at all.
12 Gemini: 27-48 calls/day typical; spikes 409 (10-16), 123, 106; 1,124 in 15 days; 500/day limit never exceeded. No AI-filter rows, no manual jobs.
13 series: 59 candidates; 52 span < 1 month (196 events, max 17 members), 5 one-two months, 1 two-four, 1 > four.
14 pin trust (you labelled 87): 15 Y, 15 C, 57 N. Today's rule (0.50 + full_match): 44% Y precision, 66% Y-or-C, keeps 65% of Y pins.
   0.60 floor: 48% / 73% / 65%. All 42 pins outside the Indonesia box are N, including 0.81-1.00 confidence ones.
15 concurrent multi-place: 178 pairs: 144 same account/different posts, 34 different accounts, 0 same post. Wacoal = 3 events, 3 malls.
16 tier-1 groups: 19 groups/56 events: 15 programme-like (46 ev), 1 series-like (2), 3 mixed (8). SCH is NOT among the 19 umbrellas.
EXTRA FINDING: of 42 outside-box pins, 25 had no usable account country (no default, or default without countryCode), 12 had a
   non-Indonesian default country (lb 6, sg 3, in 2, us 1), 5 had id. 38 of 42 were stored after the bias shipped (2026-09-13). None re-geocoded.

B: WHY A SUBSCRIBED MODERATOR GETS NO PUSH OR E-MAIL (ranked)
 0. E-mail: by design. No template or code path e-mails anyone about a new event or a subscription (code, certain).
 1. No fcm_tokens row for the moderator's browser/app (token saved only from the Notifications settings page). Check: SQL set 1.
 2. Subscribed to a twin profile (BUG-059): join needs profiles.account_id = event's numeric account id. Check: SQL set 3.
 3. Events from that account never qualify (stub / curator / roundup) or arrived before the subscription (claim-before-send). Check: SQL set 3-4.
 4. user_settings row missing or push false: inner join drops the user; UI shows ON when DB is null. Check: SQL set 1.
 5. Firebase admin env missing or FCM failures: logged and e-mailed via SES, so silent if SES is unset. Check: CloudWatch counts.
 6. Device side: SW idle (a NEXT_PUBLIC_FIREBASE_* empty at build), permission blocked, token pruned. Check: browser steps.
C: SESSION LOSS: H1, H2, H7 confirmed in code; H5 refuted as a cause; H3, H4, H6 not testable. Browser observation (section 8) did NOT reproduce the logout.
OWNER CHECKLIST: section 6. COPY TO REPO: nothing copied; say the word.

## 2. Round 3 detail

### 2.1 Item 8, recall replay (181 pairs)
| newer event | replay tier | pairs | in candidate list | should have been candidate but is not |
|---|---|--:|--:|--:|
| full | high | 5 | 1 | 4 |
| full | mid | 42 | 17 | 25 |
| stub (organizer discounted) | low | 123 | 0 | 0 |
| stub (organizer discounted) | mid | 11 | 7 | 4 |

Reading: among pairs the matcher's own scoring rates mid/high (58), 25 are in the list and 33 are not. The 123 stub pairs score low because the organizer weight is discounted; 111 of them match on venue.

### 2.2 Item 9, place quality
| detail | status | trusted pin | pin untrusted | place text only | no place |
|---|---|--:|--:|--:|--:|
| stub | open | 49 | 60 | 16 | 4 |
| stub | past | 48 | 78 | 8 | 4 |
| full | open | 106 | 153 | 42 | 22 |
| full | past | 251 | 449 | 101 | 40 |

### 2.3 Item 10, compound probe (100 requests; 50 texts x with/without bias; 192 table rows share those responses)
| variant / mode | right country | right country and conf >= 0.5 |
|---|--:|--:|
| as stored, no bias / bias | 4 / 4 | 2 / 2 |
| qualifiers removed, no bias / bias | 11 / 10 | 6 / 5 |
| venue segment, no bias / bias | 16 / 16 | 13 / 13 |
| venue segment + city, no bias / bias | 16 / 16 | 13 / 13 |

At venue-segment level (bias) seven of the 50 texts are still outside Indonesia or empty: Tennis Indoor Senayan (US 0.67), Court 2 (Canada 1.00), Online (France 1.00), Open Space JIExpo (US 0.00), Kudus City Walk Mall (India 0.00), Plaza Ambarrukmo Mall Jogja (South Africa 0.00), LA Plaza Lamongan (no result). Three Indonesian answers have confidence 0.00 (Grand Pakuwon Mall Jogja, Lembaga Indonesia Prancis, Icon Mall Gresik). City/street-level confidence is filled in only 19 of 192 rows. Two texts contain a broken dash character in the script ("Sushi Go ? Plaza Ambarrukmo"); script not edited.

### 2.4 Items 11, 12, 13
- 11: events with more than one place: 6 (no post, full) + 1 (dependent-stages, full) + 3 (program-lineup, stub) + 5 (program-lineup, full) = 15. Several schedules and no place at all: 7.
- 12: extraction calls per day, 2026-10-06 to 2026-10-20: 38, 32, 48, 43, 45, 34, 27, 36, 33, 40, 409, 123, 68, 106, 42 (total 1,124). All `gemini-3.5-flash-lite`. Classification, enrichment and location-inference calls are not in this table.
- 13: series candidates by span: 52 / 5 / 1 / 1 (196 + 14 + 2 + 2 events).

### 2.5 Item 14, pin trust (87 rows, not 96: some strata are small)
Labels: 15 Y, 15 C, 57 N. All Y and C are inside the Indonesia box; of 30 inside-box labels 15 are N; all 42 outside-box are N.

| floor | full_match required | trusted (weighted) | precision Y | precision Y or C | Y pins kept |
|--:|:-:|--:|--:|--:|--:|
| 0.30 | yes | 688 | 41% | 62% | 65% |
| 0.50 | yes (today) | 646 | 44% | 66% | 65% |
| 0.60 | yes | 584 | 48% | 73% | 65% |
| 0.70 | yes | 440 | 46% | 78% | 47% |
| 0.80 | yes | 383 | 38% | 75% | 33% |
| 0.90 | yes | 381 | 38% | 76% | 33% |
(The no-`full_match` rows are in `out/pin-trust-calibration.md`.) Small sample (15 Y). The pin-trust floor is the cloud session's decision.

### 2.6 Account default country vs the wrong-country pins (your idea)
Commit `04df5334` (2026-09-13 02:52 +0700, Story 0.i7a) added `bias=countrycode:XX`, fed from the account's default-location country (`resolve-account-and-locations.ts:60`). It is a bias, not a filter, and does nothing when the account has no default location or its default has no `countryCode`.

| account default country, 42 outside-box pins | rows | effect |
|---|--:|---|
| `id` | 5 | right direction, still landed abroad |
| default stored, no country code | 19 | no bias (15 stored after the commit, 4 before) |
| no default at all | 6 | no bias |
| `lb` 6, `sg` 3, `in` 2, `us` 1 | 12 | bias pointed at a non-Indonesian country |
Caveats: the country is the account's current default, which may have been set after the pin; the counts are sample rows, not prevalence. None of the 42 was updated after creation, so none was re-geocoded. Inside-box N and C pins are wrong places in the right country, which a country bias cannot fix, and show no pattern by date.

### 2.7 Items 15 and 16
- 15: 178 concurrent pairs, 144 same account/different posts (39 names), 34 different accounts (21 names), none same post. Many large clusters are one place spelled several ways (Jogja Coffee Week 6 at JEC, SCH Choir Competition, Obral Obrolan Buku). Real multi-place cases exist (Sports Station promo: 5 events, 4 accounts, a store each). Wacoal: 3 separate events, one per mall (Plaza Ambarrukmo, Pakuwon Mall Jogja, Jogja City Mall), different date ranges. BWF World Junior Championships has 11 events with pins in Denmark and Egypt.
- 16: 19 groups (brief said 17), 56 events: 15 programme-like (46), 1 series-like (2), 3 mixed (8). SCH does not appear as an umbrella, so item 16 does not confirm SCH as a programme.

## 3. Job B, code trace (ingestion to device)

| # | Step | Where it can stop silently | File:line | Status |
|--:|---|---|---|---|
| 1 | Eligibility: `shouldNotify = !isStub` for new events; `becameOrganizerAuthored` for enriched ones | stub, curator-only post, roundup, or no `sourceSocialMediaAccountId` -> no notification, no log | process-ingestion-job.ts:92, 110, 138-148; is-organizer-authored-post.ts:25-45 | ruled in / test with SQL set 3-4 |
| 2 | `notifyNewEvent` claims `notified_at` before sending | if no subscriber exists at that moment the event is never notified later | notify-new-event.ts:27-37 | ruled in (by design) |
| 3 | `getSubscribersForNotification` (3 inner joins) | no subscription to the profile whose `account_id` equals the event's account (twin profiles), no `user_settings` row, push not true, no `fcm_tokens` row, subscription soft-deleted | get-subscribers-for-notification.ts:7-33 | ruled in; owner SQL decides |
| 4 | Zero tokens | returns with a console.log only | send-event-notifications.ts:41-44 | ruled in |
| 5 | `buildFcmPayload` | no link/click target in the payload (title, body, data only) | packages/domain/src/notifications/build-fcm-payload.ts:15-35 | tap behaviour not testable here |
| 6 | `getAdminApp` | throws if any of FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY is empty; caught, logged, then alerted by e-mail | firebase-admin.ts:20-34; send-event-notifications.ts:70-77 | not testable here |
| 7 | `sendEachForMulticast` result | only two error codes delete the token; other failures are not retried; the alert e-mail goes through `sendTemplatedEmail`, which is a stub when SES_FROM_EMAIL_ADDRESS is empty | send-event-notifications.ts:57-68; email/adapter.ts:19-31 | not testable here |
| 8 | Token registration | token saved only when the Notifications settings page loads with push enabled, or the toggle is switched on; needs a valid login (`requireAuth`); one token per browser or installed app | notifications-content.tsx:107-130, 150-155; resolvers.ts:1330-1343 | ruled in |
| 9 | Service worker | with `apiKey` or `messagingSenderId` empty it starts idle and shows nothing; the URL is built from build-time `NEXT_PUBLIC_FIREBASE_*` values; no `notificationclick` handler | push-notifications.ts:57-66; firebase-messaging-sw.js:27-50 | not testable here |
| 10 | Settings default | UI shows ON when the DB value is null and only writes `true` once the page has loaded | notifications-content.tsx:72-73, 94-101 | ruled in |

Moderator e-mail: `EMAIL_TEMPLATES` holds 8 templates (quota warning, invalid API key, dangerous-event moderator alert, system error, two default-location alerts, scraper audit failure, scraper provider down). None concerns a new event or a subscription, so a subscribed moderator can never be e-mailed about an event. Moderator alerts go to every `users.role = 'moderator'` row; `Failed to notify moderator` is logged per failed recipient. All e-mail is skipped, with only an `[Email Stub]` log line, when SES_FROM_EMAIL_ADDRESS is empty.

### Ranked explanations for B
1. **E-mail does not exist for this** (certain, code). Evidence: template list above. Check: none needed; this is a product gap (BUG-069 / IDEA-090 territory).
2. **No `fcm_tokens` row for the moderator's actual browser or installed app.** For: the token is only written from one page, per browser, and needs a login (C below makes a logged-out registration likely). Against: unknown. Cheapest check: owner SQL set 1 (token count for the moderator).
3. **Subscribed to a twin profile.** For: BUG-059 twins exist and the join needs the numeric `account_id`. Against: unknown. Check: owner SQL set 3 (`other_profiles_same_username`).
4. **No qualifying event.** For: claim-before-send never retries; stubs, curator-typed and roundup events never notify. Check: owner SQL set 3-4 (events in 30 days, stubs, notified).
5. **`user_settings` missing or push disabled.** For: inner join; UI default differs from DB. Check: owner SQL set 1.
6. **Firebase or FCM failure.** For: the brief's lead. Against: no evidence. Check: CloudWatch strings (section 6).
7. **Device side** (SW idle, permission blocked, token pruned). Check: browser steps (section 6).

## 4. Job C, code reading

- `graphql-client.ts:12-35`: the first GraphQL response whose first error has `extensions.code = UNAUTHENTICATED` calls `auth.signOut()` and shows a toast "Session expired. Please log in again."
- `auth-session-provider.tsx:35-92`: the Authorization header is a module-level value set after `getSession()` resolves and on every `onAuthStateChange`; it is empty until then.
- `context.ts:20-42`: any missing or unverifiable bearer makes `user: null`; `requireAuth` then throws `UNAUTHENTICATED`.
- `verify-jwt.ts:16-27`, `jwks.ts:5-15`: `jwtVerify` against the project's remote JWKS; every error, expiry and JWKS-fetch failure included, returns null. No audience or issuer check, no distinct error code.
- `apps/web/src/middleware.ts` runs next-intl only, matcher excludes `api` and `auth`. The build manifest in the main checkout lists only `src/middleware` (matcher `/((?!api|auth|_next|_vercel|.*\..*).*)`), so the root `apps/web/middleware.ts` is not built and its widget framing rules do not run.
- `get-event-by-slug-cached.ts:28-36` + `supabase/server.ts:25-33`: server components call `getSession()`; the cookie write in `setAll` is wrapped in try/catch and ignored.
- Verified in installed `@supabase/auth-js` 2.111.0 (`GoTrueClient.ts:3045-3089`): `getSession()` refreshes the session when the access token is within the expiry margin (`EXPIRY_MARGIN_MS`, 90 seconds), using the single-use refresh token. The `@supabase/ssr` 0.12.4 README documents that a second refresh with a consumed token fails and recommends the middleware pattern.
- `@supabase/ssr` cookie defaults: path `/`, SameSite `lax`, not HttpOnly, max-age 400 days; browser client uses PKCE. The OAuth callback (`auth/callback/route.ts`) exchanges the code with the server client in a route handler, where cookie writes succeed.
- `firebase-messaging-sw.js`: no `fetch` listener. `instagram-embed-cache-sw.js:69-77`: responds only to `instagram.com/embed.js`; every other request is untouched.
- `manifest.ts`: `display: 'standalone'`, `start_url: '/'`.

### Hypothesis verdicts
| H | Verdict | Evidence / what would settle it |
|---|---|---|
| H1 forced logout | **Confirmed mechanism, not observed on production** | One UNAUTHENTICATED response signs the user out even if a refresh would have worked. A token that expires while a tab sleeps, or a request sent before `getSession()` finishes, can trigger it. Settle: DevTools script (section 6). |
| H2 no refresh middleware | **Confirmed** | Only next-intl middleware is built; server `getSession()` can consume the refresh token without persisting the new cookies. |
| H3 cookie attributes and OAuth | **Defaults read; production values not testable here** | Defaults above. Settle: read cookie names and expiry in the browser. |
| H4 browser vs installed app | **Not testable here** | Standalone display mode; on iOS the Home Screen app has separate storage; each context needs its own login and its own token. Settle: owner states platform and browser; log in once in the installed app. |
| H5 service workers | **Refuted as a cause of logout and of missed pushes** | Neither worker intercepts navigation, `/api` or Supabase. Receiving a push does not depend on the session. What does depend on it: saving the token and the page the notification opens. |
| H6 refresh-token rotation | **Not testable here; mechanism plausible** | Server refresh on the event page plus a second tab or the installed app can spend the token twice. Settle: Supabase dashboard settings (section 6). |
| H7 JWT check | **Confirmed** | Any verification failure is reported as UNAUTHENTICATED, which triggers H1. A JWKS fetch failure on a cold Lambda looks the same as an expired token. |

Link between B and C: `registerFcmToken` needs a valid session. A moderator who is logged out (or force-logged-out) when the Notifications page loads saves no token, and one forced logout also leaves the browser with a token that is not tied to a login. This makes explanation B-2 the most likely together with H1/H2. This is an inference from the code, not an observation.

## 5. Not done and why
- AWS/CloudWatch and Firebase were not touched (AWS identity not confirmed read-only). Browser observation was done after your approval; see section 8 (logout not reproduced).
- `owner-notification-checks.sql` was not run: it needs your privileged access and your own e-mail address.
- Item 14 labels are yours; I recorded them exactly as given.

## 6. Owner checklist
1. Run `results/prod-findings-review-2026-10-19-queries/owner-notification-checks.sql` with your privileged access, typing your own e-mail where it asks, and paste the four result sets back (counts and flags only).
2. SES: the value of SES_FROM_EMAIL_ADDRESS on the ingestor, AI-processor and API Lambdas; whether SES is still in sandbox; verified sender; SYSTEM_ERROR_ALERT_EMAIL.
3. Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY set on the ingestor Lambda; the five `NEXT_PUBLIC_FIREBASE_*` values and the VAPID key present in the web build.
4. The moderator's `users.role` is `moderator`, and which e-mail address the account uses.
5. Supabase Auth settings: JWT expiry, refresh-token reuse interval, "detect and revoke potentially compromised refresh tokens", any session time-box or inactivity timeout, "single session per user".
6. CloudWatch Logs Insights over 14 days, counts per day only (`stats count() by bin(1d)`), for the ingestor, AI-processor and API Lambdas, filtering on these strings: `[sendEventNotifications]`, `No subscribers with active device tokens`, `FCM batch dispatch failed`, `[Email Stub]`, `Failed to notify moderator`. Avoid `filter-log-events`, which returns message bodies (and `[Email Stub]` lines contain the recipient and body).
7. The configured AWS identity here is the `festdaily-dev` IAM user: check what it can do before anyone uses it for logs.
8. Browser steps for the logout (five steps, DevTools only, report names and status codes, never values):
   1. Open the production site in the browser you normally use; open DevTools, Application tab. Note the names and expiry of the `sb-*` cookies and any Supabase keys in Local Storage.
   2. Open the Network tab, filter `auth/v1` and `graphql`; reload and wait until you feel logged out.
   3. For each request note: path or operation name and status only.
   4. Open the Console and copy any lines around the moment of logout (remove tokens).
   5. In the Application tab check Service Workers: script path, scope, status; whether `Notification.permission` is granted for the site. Tell me the platform (Android, iOS or desktop) and browser, and whether you use the installed app.
9. Role changes on `readonly_2` that you made (schema USAGE; search_path if applied) are yours to keep or revert.
10. Decide whether to copy the results into the repo (list in the 2026-10-20 brief section 6). Nothing has been copied, committed or pushed.

## 7. Files (scratchpad `out/`, nothing committed)
`recall-replay.txt`, `events-place-quality.txt`, `events-multi-place.txt`, `gemini-usage.txt`, `series-candidates.txt`, `concurrent-multi-place.txt`, `tier1-group-members.txt`, `pin-trust-sample.csv`, `pin-trust-links.csv`, `pin-trust-times.csv`, `pin-trust-labelled.csv`, `pin-trust-calibration.md`, `geocode-compound-probe.md`, `compound-dry.txt`. The post links file holds Instagram URLs and must not be staged.

## 8. Browser observation addendum (done with your approval; desktop Chrome, https://fest-grid.vercel.app)
Only names, attributes and status codes were recorded; no cookie, storage or response value, no raw objects. I did not sign in, toggle any setting or send anything; you signed in yourself. The Chrome tab I opened was closed at the end.

What I saw:
- On first load the profile was signed out: no `sb-*` session cookies, no Supabase keys and no `festgrid_has_session` in local storage (only PostHog cookies and a PWA visit counter).
- Device side in that same browser: `Notification.permission` = granted; `firebase-messaging-sw.js` activated at scope `/` with all five parameters (apiKey, authDomain, projectId, messagingSenderId, appId) non-empty; a push subscription exists (endpoint host `fcm.googleapis.com`). So the service worker is not idle and push is not blocked in this browser; a missing token row or a logged-out registration remains the open question.
- Service workers: `instagram-embed-cache-sw.js` is registered under three scopes, `/en/events/`, `/id/events/` and `/api/events/`. The brief expected locale scopes only; not traced; the worker answers only `embed.js` requests.
- After you signed in: two chunked session cookies `sb-<ref>-auth-token.0` and `.1`; host-only (no domain), path `/`, SameSite lax, Secure off, expiry about 400 days out (the `@supabase/ssr` defaults); `festgrid_has_session` created. The PKCE cookies `…-flow-<id>-code-verifier` and `…-flows-code-verifier` were left behind after sign-in (the older `…-code-verifier` was removed); not concluded.
- Over about three minutes after sign-in: session cookies stayed in place, no Supabase auth request was seen (no token refresh), 15 POSTs to `/api/graphql` (11 HTTP 200, 3 still pending in the tool, 1 HTTP 502), console empty. GraphQL returns HTTP 200 even when the body carries `UNAUTHENTICATED`, so status codes alone cannot show the logout trigger; operation names and error codes were not captured (my in-page fetch hook did not see the calls).
- The page was fully reloaded once during the session, which cleared my in-page watchers; they were reinstalled.

Not done: the logout was **not reproduced**. The access token normally lives about an hour, so a short session cannot show an expiry-driven logout. H1, H3, H4 and H6 therefore remain as in section 4.

To settle H1/H6 later: leave a signed-in tab for longer than the JWT lifetime (or the lifetime in your Supabase settings), then reopen the app and, in DevTools Network (filter `auth/v1` and `graphql`), note the status of any `token?grant_type=refresh_token` call and whether the first `/api/graphql` response carries `UNAUTHENTICATED` (Response tab, error code only).
