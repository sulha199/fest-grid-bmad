# Target area: draft edits to the guides, prompt, schema and scorer (2026-10-27)

Status: APPLIED on 2026-10-27 (the draft text below is kept as written; where it differs, the code and the guides win). Companion to
`target-area-spec-2026-10-27.md`. Where each section landed:
- A (split of work) and F (code-side derivation): `target-areas.ts`, `hashtag-places.ts`, `implicit-level-policy.ts`, `venue-resolution.ts`, `area-resolver.ts`, `location-policy.ts`
- B and C (guides): `labelling-guide-2026-10-21.md` and `.id.md`
- D and E (prompt, schema, guards): `audience-insight.ts` (`audience-v3`), `audience-poc-lib.ts`, `run-audience-poc.ts`
- G (sheet and scorer): `label-sheets-lib.ts`, `sheet_xlsx.py`, `area-name-agreement.ts`, `audience-poc-score-lib.ts`
- H (probe set): not yet built; the cases are listed here and in the spec, section 7.
Differences from the draft: the caption/poster conflict is "nested -> widest, disjoint -> flag both" (the draft said "refuse the poster's claim");
the hashtag rule is "plain place tags only" and runs in code.

## A. Split of responsibilities (the main change)

| Who | Reports |
|---|---|
| **Model** | only what the post STATES (caption, and on production also the poster): areas with source `stated` or `stated_poster`, level, qualifier, anchor, verbatim quote |
| **Code** | everything implicit: venue area (verified pin or gazetteer), hashtags (regex + gazetteer), account (organizer default area; curator/unclassified audience area, bio allowed), the merge rule, the per-province level policy |

The old `audience-v2` prompt asked the model to derive the area "from the venue, then the hashtags, then what the posting account
covers (its name and other cues)". That moves to code, because the model cannot know the account type, the reach or the province policy.

## B. Labelling guide (EN), replace the `target_area_level` row, add two rows

| Column | What to write |
|---|---|
| `target_area_name` | The area the post says the event is for, as written ("Jogja", "DIY", "RW 05 Kelurahan X"). Leave `none` if the post states none. Read the caption AND the poster. An address line, "Tempat:", the venue name, or where performers/exhibitors/vendors come from is NOT an audience. People who attend, register or compete ARE ("peserta se-DIY"). |
| `target_area_source` | `stated` (in the caption), `stated_poster` (only on the poster), or `none` (nothing stated; the system will derive it from the venue, hashtags or account). Do not label venue/hashtag/account areas by hand. |
| `target_area_level` | The level of the area you wrote in `target_area_name`: `neighborhood` (only for RW/RT/kampung/dusun wording), `city`, `regency`, `province`, `country`, `continent`. If the name could be a city or the province (Jogja, Yogyakarta, Jakarta), pick the **wider** one. `none` when `target_area_source` is `none`. |

Decision steps to add under the table: (1) look for an audience cue in the caption, then on the poster; (2) a cue wins over the venue,
whether it is wider or narrower; (3) if there is none, write `none` and stop; (4) never use the account name or the venue as the area.

## C. Labelling guide (ID), the same rows

| Kolom | Isi |
|---|---|
| `target_area_name` | Wilayah yang disebut postingan sebagai sasaran acara, sesuai tulisan ("Jogja", "DIY", "RW 05 Kelurahan X"). Isi `none` jika tidak disebut. Baca caption DAN poster. Baris alamat, "Tempat:", nama venue, atau asal pengisi acara/penampil/peserta pameran/penjual BUKAN sasaran. Orang yang hadir, mendaftar atau berlomba TERMASUK ("peserta se-DIY"). |
| `target_area_source` | `stated` (di caption), `stated_poster` (hanya di poster), atau `none` (tidak disebut; sistem akan menurunkannya dari venue, hashtag atau akun). Jangan isi wilayah dari venue/hashtag/akun secara manual. |
| `target_area_level` | Tingkat wilayah pada `target_area_name`: `neighborhood` (hanya jika tertulis RW/RT/kampung/dusun), `city`, `regency`, `province`, `country`, `continent`. Jika namanya bisa kota atau provinsi (Jogja, Yogyakarta, Jakarta), pilih yang **lebih luas**. `none` jika `target_area_source` adalah `none`. |

## D. Model prompt (replaces the `targetAreaLevel` line in `AUDIENCE_INSIGHT_INSTRUCTION_V2`)

```
- targetAreas: the places the post says the event is FOR, as a list of {name, level, source, qualifier, anchor, quote}. Report ONLY what
  the post states. Do not use the venue, the hashtags or the posting account's name or location as an area: they are handled elsewhere.
  * source "stated": the caption says who the event is for, open to, aimed at or invited from, including the people who attend,
    register or compete: "warga Jogja", "se-DIY", "mahasiswa se-Bantul", "peserta dari seluruh Indonesia", "khusus warga RW 05".
    source "stated_poster": the same, but only the poster image says it.
  * quote: the exact words that state it (at most 100 characters), copied from the caption or read from the poster.
  * NOT an audience: an address or "Tempat:" line; the venue's name; where performers, artists, exhibitors, vendors or guests come from;
    a place inside a name ("Java Jazz"); "terbuka untuk umum" or "free entry".
  * level: neighbourhood only when the post says RW, RT, kampung, dusun or lingkungan (put the kelurahan or desa in anchor if named);
    otherwise city, regency, province, country or continent. If a name could be a city or its province, give the wider one.
  * qualifier: "only" for "khusus", "hanya", "... saja"; "and_surroundings" for "dan sekitarnya"; "part_of" for "bagian selatan"; else "none".
  * Several areas -> several entries (a tour lists each stop). Nothing stated -> an empty list. Do not guess.
```

Output schema change (`audienceInsightSchema` / `AudienceInsight`): drop `targetAreaLevel: string`; add

```ts
targetAreas: Array<{
  name: string;
  level: 'neighborhood'|'city'|'regency'|'province'|'country'|'continent';
  source: 'stated'|'stated_poster';
  qualifier: 'only'|'and_surroundings'|'part_of'|'none';
  anchor?: string;
  quote: string;
}>;
```

The caption-only POC call cannot emit `stated_poster`; the production call (which already sends the images) can.

## E. Guards (`guardAudienceInsight`)

1. `source: 'stated'`: the quote must occur verbatim in the caption (existing `quoteIsVerbatim`); otherwise the entry is dropped and counted as an abstention.
2. `source: 'stated_poster'`: the quote cannot be checked against the caption. Keep it, but (a) refuse it if the caption states a different area
   (conflict is flagged), (b) cap it at 100 characters, (c) count it separately so the report shows how often the poster is the only source.
3. `national`/`international` still needs nationwide wording (`hasNationwideWording`) in the caption or in a `stated_poster` quote.
4. `qualifier: 'only'` requires one of khusus / hanya / saja / "residents only" in the quote; otherwise downgrade to `none` (log-only first).
5. `level: 'neighborhood'` requires RW / RT / kampung / dusun / lingkungan in the quote; otherwise widen to the next level.

## F. Code-side derivation (not model)

| Step | Where | Notes |
|---|---|---|
| Hashtags -> places | new pure function in `packages/domain` | tag must be a gazetteer alias, or alias + generic word (event, info, kuliner, wisata, agenda, kajian); compound brand/origin tags ignored |
| Venue -> area | existing geocode + gazetteer | verified pin first; else venue text through the gazetteer (PRD 3.20) |
| Level policy | new config table: venue type x province -> level | mall / stadium / convention centre / university: province in DIY and DKI Jakarta; otherwise the venue's city or regency; Batam stays city |
| Account | extend `effectiveAudienceAreas` (`location-policy.ts`) | unclassified accounts follow the curator branch; bio-stated audience area allowed, tagged `account_bio` |
| Merge | extend `effectiveAudienceAreas` | nested signals -> widest; disjoint -> venue > account > hashtag, conflict flagged |
| Siblings | gazetteer | Kota X / Kabupaten X -> a set of both |

## G. Label sheet and scorer

- `label-sheets-lib.ts`: add columns `target_area_name`, `target_area_source` (`stated | stated_poster | none`); validate with the enums above; keep `target_area_level`.
- `audience-poc-score-lib.ts`: score the **model** only on rows where `target_area_source` is `stated` or `stated_poster`: area name (resolved to a gazetteer key through `area-resolver.ts`, so "Jogja" and "DIY" compare equal) and level. Rows with `none` are scored on "model returned an empty list".
- Score the **code policy** (venue, hashtag, account, merge, level table) with unit-test fixtures, not with the model, using the probe set cases in the spec.
- The 3% `target_area_level` agreement seen on 2026-10-26 was a guide-reading difference; re-label the owner's 36 posts for the three columns before re-running.

## H. Probe set additions made necessary by these decisions

Add to the 10 cases in the spec: (11) a poster-only "khusus warga DIY" post (stated_poster); (12) a hashtag-only post with a plain place tag;
(13) a hashtag brand-origin post (`#bandungcheesecuit`-style) that must NOT produce an area; (14) a stadium or convention-centre post in DIY (province)
versus the same venue type in another province (city). Real candidates for 13: the Galeria Jogja "Cheesecuit Bandung" post and the Jogja Expo Center `#sanubarimalang` post (found in prod 2026-10-27; confirm before use).
