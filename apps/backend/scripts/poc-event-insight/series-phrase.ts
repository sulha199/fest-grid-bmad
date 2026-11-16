/**
 * POC (pure, no I/O): when are two events "the same activity" posted for different places, judged by phrase and word ORDER, not by a list of
 * suffix patterns? Spine reference: AD-36 Rule 12. Revision 3 (2026-10-20), after the code review and the two architect reviews of revision 2.
 *
 * Two separate jobs, with different strength:
 *
 *   COLLAPSE  `canonicalKey(member)`: a per-event string. Two events with the SAME key collapse in Discovery. It does not depend on the other
 *             event, on weights or on arrival order, so it is an equivalence relation (no chains, no drift). The key is the event's content
 *             words (accents folded, apostrophes removed, connectors such as at/di/dan dropped) minus ONE trailing run of words that is a
 *             KNOWN VENUE of its own place text. "Known venue" = that phrase occurs in the place text of at least MIN_VENUE_EVENTS distinct
 *             events (malls and halls occur in 16 to 236 events of the 2026-10-20 export, store brands in 1 to 9), so "Pakuwon Mall Jogja"
 *             is removed from "Wacoal 25% Off Promo at Pakuwon Mall Jogja" but "Planet Sports" is kept in "Buy 1 Get 1 Free Promo at Planet
 *             Sports", even when the place text repeats the store. Never removed: a run at the START of the name, a bare number, the whole name.
 *             Without a venue test nothing is removed (the safe default).
 *   LINK      `seriesNameScore(a, b, weights)`: 0.5 x dice over the longest common word SUBSEQUENCE + 0.5 x (longest common contiguous RUN /
 *             longer name), over word weights (1 each, or ln(1 + N / df) when a corpus is given). A reordering or an extra word costs score.
 *             Caps at 0.5: a number that differs ("25%" vs "30%", 2025 vs 2026, "Week 6" vs "Week 7"), and fewer than two distinct shared
 *             NON-numeric words ("Jazz at Plaza" vs "Jazz di Kebun" share one word and a year). Used for the link-only tier (0.85 and above).
 *
 * `groupName(a, b)` is the display name: the words both names share, once the venue is removed, in the poster's spelling and casing.
 *
 * Known limits: a city that is in the name but not in the place text ("Erafone Run 2026 Yogyakarta Series" and "... Bandung Series") is
 * missed; a translation or synonym is invisible; single-word names with a year ("BIOSFERUN 2026") never reach the bar; word ORDER matters, so
 * "Buy 1 Get 1 Free Promo at Sports Station" and "Sports Station Buy 1 Get 1 Free Promo" have different keys. Thresholds are not calibrated:
 * the data is one snapshot of 1,467 event names that the formula was tuned on (in-sample).
 */

const CONNECTORS = new Set(['at', 'di', 'in', 'pada', 'the', 'of', 'and', 'dan', 'by', 'with']);
const CAP = 0.5;
const MIN_SHARED_WORDS = 2;
export const MIN_VENUE_EVENTS = 15;

const isPureNumber = (t: string) => /^\d+(?:st|nd|rd|th)?%?$/.test(t);

export function tokens(text: string | null | undefined): string[] {
  return (text ?? '')
    .normalize('NFKD')
    .replace(/(?<=\p{Script=Latin})\p{M}+/gu, '') // fold accents on Latin letters only; other scripts keep their combining marks
    .toLowerCase()
    .replace(/['’`´]/g, '') // men's -> mens, so a possessive is not an extra one-letter word
    .replace(/&/g, ' and ').replace(/@/g, ' at ')
    .replace(/[^\p{L}\p{N}\p{M}%]+/gu, ' ').trim().split(' ').filter(Boolean);
}

const content = (s: string | null | undefined) => tokens(s).filter((t) => !CONNECTORS.has(t));

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Venue test

export type VenueTest = (run: string[]) => boolean;

/** A phrase of 1 to 4 words is a venue when it occurs in the place text of at least `minEvents` distinct events. */
export function venueTestFrom(places: Array<string | null | undefined>, minEvents = MIN_VENUE_EVENTS): VenueTest {
  const df = new Map<string, number>();
  for (const p of places) {
    const pt = content(p); const seen = new Set<string>();
    for (let n = 1; n <= 4; n++) for (let i = 0; i + n <= pt.length; i++) seen.add(pt.slice(i, i + n).join(' '));
    for (const g of seen) df.set(g, (df.get(g) ?? 0) + 1);
  }
  return (run) => (df.get(run.join(' ')) ?? 0) >= minEvents;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// One analysis of a member, shared by the key, the score and the group name

export interface Member { name: string; place: string | null }

interface Word { raw: string; all: string[]; toks: string[] }
interface Flat { tok: string; w: number; after: boolean } // a content word, the word it came from, and whether a connector came right before it
interface Analysis { words: Word[]; flat: Flat[]; run: { s: number; e: number } | null; core: string[] }

function wordsOf(name: string): Word[] {
  return (name ?? '').replace(/[@()|:,–—]/g, ' $& ').split(/\s+/).filter(Boolean)
    .map((raw) => { const all = tokens(raw); return { raw, all, toks: all.filter((t) => !CONNECTORS.has(t)) }; });
}

function flatten(words: Word[]): Flat[] {
  const out: Flat[] = []; let prev = '';
  words.forEach((word, w) => word.all.forEach((t) => { if (!CONNECTORS.has(t)) out.push({ tok: t, w, after: CONNECTORS.has(prev) }); prev = t; }));
  return out;
}

function containsRun(haystack: string[], run: string[]): boolean {
  for (let i = 0; i + run.length <= haystack.length; i++) if (run.every((t, k) => haystack[i + k] === t)) return true;
  return false;
}

/** The longest trailing run (it ends the name, or follows a connector) that is a run of the place text and a known venue; the later one on a tie. */
function placeRun(flat: Flat[], place: string[], isVenue: VenueTest | undefined): { s: number; e: number } | null {
  if (!isVenue || isVenue(flat.map((x) => x.tok))) return null; // a name that is itself a venue ("Pakuwon Mall Jogja") is left whole
  let best: { s: number; e: number } | null = null;
  for (let e = flat.length; e >= 1; e--) for (let s = 0; s < e; s++) {
    if (e - s === flat.length) continue; // never empty the name
    if (!(e === flat.length || flat[s].after)) continue; // trailing only
    const run = flat.slice(s, e).map((x) => x.tok);
    if (run.every(isPureNumber) || !containsRun(place, run) || !isVenue(run)) continue;
    if (best === null || e - s > best.e - best.s || (e - s === best.e - best.s && e > best.e)) best = { s, e };
  }
  return best;
}

function analyse(m: Member, isVenue?: VenueTest): Analysis {
  const words = wordsOf(m.name); const flat = flatten(words);
  const run = placeRun(flat, content(m.place), isVenue);
  return { words, flat, run, core: flat.filter((_, i) => run === null || i < run.s || i >= run.e).map((x) => x.tok) };
}

/** Per-event key for COLLAPSE: equal keys collapse. Independent of every other event. */
export const canonicalKey = (m: Member, isVenue?: VenueTest): string => analyse(m, isVenue).core.join(' ');

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Weights and the phrase score (LINK tier)

export type Weight = (token: string) => number;
const ONE: Weight = () => 1;

/** ln(1 + N / df) over the DISTINCT names of a corpus, so a promo posted by many accounts does not make its own brand look common. */
export function idfFrom(names: string[]): Weight {
  const unique = new Map<string, Set<string>>();
  for (const n of names) { const t = content(n); if (t.length) unique.set(t.join(' '), new Set(t)); }
  const total = unique.size;
  const df = new Map<string, number>();
  for (const set of unique.values()) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  return (t) => (total === 0 ? 1 : Math.log(1 + total / (df.get(t) ?? 1)));
}

function overlap(a: string[], b: string[], w: Weight): { lcs: number; run: number; shared: string[] } {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  const runs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  let run = 0;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const same = a[i - 1] === b[j - 1];
    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], same ? dp[i - 1][j - 1] + w(a[i - 1]) : 0);
    if (same) { runs[i][j] = runs[i - 1][j - 1] + w(a[i - 1]); run = Math.max(run, runs[i][j]); }
  }
  const shared: string[] = [];
  for (let i = a.length, j = b.length; i > 0 && j > 0;) {
    if (a[i - 1] === b[j - 1]) { shared.push(a[i - 1]); i--; j--; } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  return { lcs: dp[a.length][b.length], run, shared };
}

const sum = (t: string[], w: Weight) => t.reduce((s, x) => s + w(x), 0);
const numbers = (t: string[]) => new Set(t.filter((x) => /\d/.test(x)));

export function phraseScore(a: string[], b: string[], w: Weight = ONE): number {
  if (a.length === 0 || b.length === 0) return 0;
  const wa = sum(a, w); const wb = sum(b, w);
  if (!(wa + wb > 0)) return 0;
  const { lcs, run, shared } = overlap(a, b, w);
  let score = 0.5 * ((2 * lcs) / (wa + wb)) + 0.5 * (run / Math.max(wa, wb));
  const na = numbers(a); const nb = numbers(b);
  if ([...na].some((x) => !nb.has(x)) || [...nb].some((x) => !na.has(x))) score = Math.min(score, CAP);
  if (new Set(shared.filter((t) => !isPureNumber(t))).size < MIN_SHARED_WORDS) score = Math.min(score, CAP);
  return score;
}

export interface SeriesNameResult { score: number; coreA: string[]; coreB: string[]; stripped: boolean }

/** The larger of the raw-name score and the core score, each venue-stripped independently of the other member. */
export function seriesNameScore(a: Member, b: Member, w: Weight = ONE, isVenue?: VenueTest): SeriesNameResult {
  const A = analyse(a, isVenue); const B = analyse(b, isVenue);
  const raw = phraseScore(A.flat.map((x) => x.tok), B.flat.map((x) => x.tok), w);
  const stripped = phraseScore(A.core, B.core, w);
  return { score: Math.max(raw, stripped), coreA: A.core, coreB: B.core, stripped: stripped > raw };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Group name

const trimPunct = (s: string) => s.replace(/^[\s,;:|/)\-–—]+|[\s,;:|/(\-–—]+$/g, '');

/** Words of the analysis left after the venue run is removed, with the connector word right before the run removed too. */
function wordsAfterStrip(an: Analysis, strip: boolean): Word[] {
  const run = an.run;
  if (!strip || run === null) return an.words;
  const dropped = new Set<number>();
  for (const w of new Set(an.flat.slice(run.s, run.e).map((f) => f.w))) {
    const idx = an.flat.map((f, i) => (f.w === w ? i : -1)).filter((i) => i >= 0);
    if (idx.every((i) => i >= run.s && i < run.e)) dropped.add(w); // a word only partly inside the run is kept
  }
  if (dropped.size === 0) return an.words;
  const first = Math.min(...dropped);
  if (first > 0 && an.words[first - 1].toks.length === 0) dropped.add(first - 1); // the "at" / "di" that introduced the venue
  return an.words.filter((_, i) => !dropped.has(i));
}

/** Indices of `a` that belong to one longest common subsequence with `b`. */
function lcsPositions(a: string[], b: string[]): Set<number> {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const hit = new Set<number>();
  for (let i = a.length, j = b.length; i > 0 && j > 0;) {
    if (a[i - 1] === b[j - 1]) { hit.add(i - 1); i--; j--; } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  return hit;
}

/** The words the two names share, in the poster's spelling, from the more general name; '' when nothing is shared. Same strip decision as the score. */
export function groupName(a: Member, b: Member, w: Weight = ONE, isVenue?: VenueTest): string {
  const A = analyse(a, isVenue); const B = analyse(b, isVenue);
  const strip = seriesNameScore(a, b, w, isVenue).stripped;
  const wa = wordsAfterStrip(A, strip); const wb = wordsAfterStrip(B, strip);
  const flat = (ws: Word[]) => ws.flatMap((word, i) => word.toks.map((tok) => ({ tok, i })));
  const fa = flat(wa); const fb = flat(wb);
  const [words, f, otherTokens] = fa.length <= fb.length ? [wa, fa, fb.map((x) => x.tok)] : [wb, fb, fa.map((x) => x.tok)];
  const shared = lcsPositions(f.map((x) => x.tok), otherTokens);
  const keep = words.map((_, i) => {
    const own = f.map((x, k) => (x.i === i ? k : -1)).filter((k) => k >= 0);
    return own.length > 0 && own.every((k) => shared.has(k));
  });
  const first = keep.indexOf(true); const last = keep.lastIndexOf(true);
  if (first < 0) return '';
  const inside = words.slice(first, last + 1).filter((word, k) => keep[first + k] || word.toks.length === 0);
  return trimPunct(inside.map((word) => word.raw).join(' '));
}
