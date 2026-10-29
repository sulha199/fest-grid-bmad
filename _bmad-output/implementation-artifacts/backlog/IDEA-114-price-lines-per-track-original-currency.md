---
backlog_id: IDEA-114
title: "Store price lines per track in the original currency and derive price bands per country at read time (cost as a list, not a stored tier)"
captured: 2026-10-29
---

# IDEA-114 — Price lines per track, original currency; bands per country at read time

## Decision (owner, 2026-10-29)

Cost becomes a list. The price of each track is stored with its ORIGINAL amount and currency. The cost filter ("cost collection") is tuned per country later, in the UI, from the viewer's country. The app has to scale to other countries, and today it is built for one.

## What breaks if a tier is stored (the current POC `costTier`)

- The cut-offs are Rupiah numbers fixed inside the extraction prompt ("low: under about Rp 50,000 ... or the equivalent in another currency"). Another country needs another currency and other bands, and the model's "equivalent" is a guess.
- The cut-offs are not even settled for Indonesia: the labelling guide uses Rp 50,000 and 250,000, the older insight schema Rp 100,000 and 500,000 (open in `poc-status.md`). Stored tiers would have to be re-extracted every time a threshold moves (inflation, a new market). Stored amounts are re-bucketed for free.
- The first blind labelling agreement on the tier was 67%. A tier is a judgement; an amount written in the post is a fact. Labelling amounts removes the judgement from the human side too.
- Production's only price filter is `isFree`, a SQL text match on `ticket_price` equal to "free" or "gratis". Malay says "percuma", other languages other words. A language-free `free` flag fixes it.

## Shape

The model returns the price LINES a post states and chooses no tier:

| Field | Meaning |
|---|---|
| `trackLabel` | the track the line belongs to ("5K"), or none for an event-wide price |
| `label` | the ticket name as written ("early bird", "regular", "VIP"); a price point, not a category |
| `amount` | the number as written (150000), `null` when only "free" is said |
| `currency` | ISO code (IDR, MYR, SGD ...), from the symbol or word, resolved with the country cues when ambiguous ("$") |
| `free` | true when the post says the line is free (any language) |

Code derives, never the model: the tier or band per track, the event-level "from" price (`priceMin`, `priceMax` per currency, indexable), and the free flag for filters. Production already keeps the original text per schedule (`schedules.ticket_price`); it stays as display text and as the migration source.

Merging posts (personalization Revision 11) becomes a union of price lines, so the "cheapest or most common tier" question disappears.

## Read time: bands per country

- A small configuration per country holds the currency, the bands of the price filter (for Indonesia, free / under 50k / 50k to 250k / above) and the number format. Changing a band changes nothing in the data.
- The filter shows the bands of the viewer's country; an event matches when any track line falls in the band. Prices display in their own currency, no conversion on screen.
- The stored currency is also a cue for the audience country: the ladder already counts "a currency with an amount" as a strong cue (`audience-country.ts`), so extraction and ladder agree.

## Parsing is per country too (code, not model)

"Rp 25.000,-", "150k", "150 ribu", "RM 25.50", "IDR 150,000" and a range "100-150rb" use different thousand and decimal marks and shorthands. The number parser takes the country context; a symbol that is not unique (`$`) is resolved from the place or audience country and left unresolved when they disagree. A number counts only if it is written in the post (the same grounding rule as ages).

## What changes

- Extraction prompt and schema: price lines instead of a tier (production keeps its `ticketPrice` string until then).
- POC: prompt `audience-v3` asks for `costTier` today; the label sheet has `cost_tier` and `cost_source`. Proposal: new label columns `price_min`, `price_max`, `price_currency` (per post, cheap to label); the tier is computed from them with the Indonesian bands, so the owner stops labelling a tier. Keep the tier until the agreement problem is understood.
- Personalization Revision 11: the cost rule becomes the union of price lines (see Revision 12 in the plan). The prototype `merge-event-insight.ts` still merges a tier and is provisional.
- Production: `isFree` reads a flag, not two words.

## Open questions

1. An event priced in a currency other than the viewer's: convert with a coarse rate table (versioned, refreshed rarely) or leave it out of the price filter and still show its own price?
2. Which country's bands apply: the viewer's saved location or country, or the event's place country?
3. An event with a free category and a paid category: does the "free" filter show it? (proposal: yes, any track.)
4. A price only on the poster: production sees the image, the POC call does not (`cost_source`).
5. Mapping price lines to tracks: production stores the price per schedule, tracks are an insight; a line the post does not tie to a track is event-wide.

Related: IDEA-111 (Erafone: 5K and 10K prices), personalization plan Revisions 10 to 12, PRD 3.19, AD-42, IDEA-105 (target area: same idea of keeping the source value and deriving per country).
