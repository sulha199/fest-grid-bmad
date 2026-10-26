# Labelling guide: who is this event for? (English; the Indonesian version is `labelling-guide-2026-10-21.id.md`)

For the two people who label the posts of the audience, language and taxonomy POC (`audience-and-taxonomy-poc-plan-2026-10-21.md`). Your labels are the answer key the model is scored against, so they have to be careful, independent and consistent. About 2 minutes per post.

## Ground rules

1. **Label from the post only**: its caption, hashtags, the tagged place and any text you can read on its image. Not from what you happen to know about the organizer. The only outside knowledge you may use is geography (which country a named city is in).
2. **Work alone.** Do not look at the other labeller's sheet or at any model output, and do not discuss labels until both of you have finished. Agreement is measured, so a shared answer ruins it.
3. **Never guess.** If, after about two minutes, you cannot decide a field, write `unclear` and say why in the notes. `unclear` is a useful answer; a guess is not.
4. **The posts are other people's content.** They are shown to you on the owner's machine only. Do not copy, screenshot, forward or post any caption. The sheet is deleted when the POC ends.
5. Use the exact words in the lists below, so the sheets can be compared by a program.

## The fields

| Column | What to write |
|---|---|
| `is_event` | `yes` if the post advertises or reports on something with a date: an event coming up or running. `no` if it has no schedule: a recap or thank-you after the event, a repost of a personal vlog, news, a shop or restaurant promo, a quote or greeting. For a `no` post fill only `audience_country`, `post_language`, `sensitive` and `unsure`; write `unclear` in the other label columns and say why in the notes (name the event in the notes if the post is about a known event). |
| `audience_country` | The country the post is written for, as a two-letter code (`id` Indonesia, `my` Malaysia, `sg` Singapore, `au` Australia, `dk` Denmark ...), or `international` if it is aimed at people in several countries, or `unclear`. See the decision steps below. |
| `geo_scope` | `venue_local` (a venue is named), `city` (only a city or area, no venue), `region`, `national`, `international`, `online` or `unspecified`. See the table below. |
| `post_language` | `id`, `en`, `ms` (Malay), `mixed` (Indonesian and English in one caption), `other`, or the main language if one clearly dominates. |
| `target_area_level` | The finest area the audience is drawn from: `neighborhood`, `city`, `regency`, `province`, `country`, `continent`. Take it from the venue, then the hashtags, then the coverage of the posting account. For a repost use what the post itself shows (the original account is not looked up in this POC). `none` only if nothing points to any area. |
| `eligibility` | `restricted` only if the post limits who may take part by membership (invitation only, one school, one company, members only); otherwise `open_to_public`: an event with no restriction is open. `unspecified` only for a post that is not an event. Age and gender are not eligibility. |
| `track_count` | How many separately qualifying categories the event lists (for example "Kids Dash 6-10, 5K 12+, 10K 17+" is 3). If it lists none, it is one tier open to everybody: `1`. Ticket packs and prices are not categories. `unclear` for a post that is not an event. |
| `age_written` | `yes` if any age number is written in the text (a number next to an age word), otherwise `no`. Do not infer an age from "SD" or "mahasiswa". |
| `cost_tier` | `free`, `low`, `medium`, `high` or `unspecified`. Low is roughly under Rp 50,000, medium up to Rp 250,000, high above that, or the equivalent. You may read the price from the image. |
| `cost_source` | Where you read the price: `caption`, `image` (the price is only in the picture) or `none` (no price anywhere). The model reads the caption only, so cost is scored on `caption` and `none` rows. |
| `sensitive` | `none`, or one of `religion`, `politics_civic`, `health_condition`, `sexuality`, `ethnicity`: the topic the event is about, if it is one of these. A mosque's open iftar is `religion`; a fitness class is `none`; a diabetes screening is `health_condition`. |
| `unsure` | `yes` or `no`. |
| `notes` | One short line when you wrote `unclear` or `unsure`. |

## Audience country: decide in this order

1. **Does the post state who may take part or who it is for?** A named country, "seluruh Indonesia", "se-ASEAN", "open worldwide": that is the answer (`id`, or the country, or `international`).
2. **If it states nothing, who is it written for?** Look at the language together with where the account is based. A post in Indonesian from an Indonesian account is written for Indonesia (`id`), **even if the event is abroad** (for example an Indonesian account writing in Indonesian about a badminton tournament in Denmark). Currency (Rp or RM), a phone number (+62, +60), a time zone (WIB, MYT) and local words help.
3. **If the language is shared** (English, Spanish, Arabic, Portuguese, and Malay, which is close to Indonesian), the language alone says nothing. You need a second clue: the currency, a phone code, where the account is based, a time zone. If there is none, write `unclear`.
4. **An online event with no stated audience** is `international`.
5. **Only if nothing above helps**, use the country where the event takes place.

## geo_scope

| Value | Meaning | Not this |
|---|---|---|
| `venue_local` | A venue is named: the people around it. | |
| `city` | Only a city or regency is named, no venue. | |
| `region` | A province, or several named areas ("se-DIY dan Jawa Tengah"). | |
| `national` | The post invites people from anywhere in the country ("seluruh Indonesia", "tingkat nasional", entrants from many cities). A contest held at a local campus that invites the whole country is `national`. | "Open to the public" or "free entry" says who may attend, not how far they live: not `national`. A venue called "Galeri Nasional" is just a venue. |
| `international` | Several countries or a continent. | |
| `online` | Attendance is remote and open regardless of location. | An event with a livestream next to a local venue is not `online`. |
| `unspecified` | The post gives no basis. A post with no place and no audience, only "daftar lewat link di bio". | |

## Examples (invented, not real posts)

| Post (summary) | audience_country | geo_scope | eligibility | track_count | Why |
|---|---|---|---|---|---|
| Indonesian caption from a mall account: "Bazaar kuliner 12-14 Okt, Plaza X, gratis masuk" | `id` | `venue_local` | `open_to_public` | 1 | Nothing wider is stated; written for people near the mall. |
| Indonesian caption: "Lomba esai tingkat nasional, terbuka untuk mahasiswa seluruh Indonesia", held at a Surabaya campus | `id` | `national` | `open_to_public` | 1 | The whole country is invited; the campus is only the venue. |
| Indonesian caption from an Indonesian curator: "Jadwal Denmark Open 2026, dukung wakil Indonesia!" | `id` | `unspecified` | `open_to_public` | 1 | Written for Indonesian followers although the event is in Denmark. Nobody is invited to attend, so there is no attendance scope: a follow-only post gets `unspecified`; its audience is still `id`. |
| English caption, prices in Rp, WIB time, Bali account: "Sunset yoga for expats, Rp 150k" | `id` | `city` | `open_to_public` | 1 | English alone says nothing; Rp, WIB and the account say Indonesia. |
| English caption, prices in S$, a Singapore account | `sg` | `city` | `open_to_public` | 1 | Same language, different clues. |
| English caption, no price, no place clue, no account clue | `unclear` | `unspecified` | `open_to_public` | 1 | Shared language and no second clue: do not guess. |
| "Kids Dash 6-10 th, 5K 12+, 10K 17+, Master 45+" | per the other clues | per the other clues | `open_to_public` | 4 | Four separate categories; ages are written. |
| "Webinar karir untuk mahasiswa Yogyakarta via Zoom" | `id` | `region` or `city` (write what the text supports) | `open_to_public` | 1 | Online, but the audience is named (Yogyakarta students). |

## When you finish

Save the sheet, tell the owner, and only then compare. Disagreements are expected; the owner settles each one once, after both sheets are final.
