/**
 * POC (pure, no I/O): are two event names "the same activity" once each one's own place is taken out, judged by
 * phrase overlap and word ORDER instead of one exact suffix pattern ("- X", "at X", "@ X", "di X", "(X)")?
 * Spine reference: AD-36 Rule 12 (series stem) and the cross-account question left open after Round 3 item 15.
 *
 *   1. tokens        lower case, accents folded, punctuation to spaces; connectors (at, di, in, the, and, dan...) dropped.
 *   2. core          a member's name minus the longest TRAILING stretch of it that is also a stretch of ITS OWN place text
 *                    ("Wacoal 25% Off Promo at Pakuwon Mall Jogja" at "House of Wacoal 2nd Floor, Pakuwon Mall Jogja" ->
 *                    "wacoal 25% off promo"). Trailing = it ends the name, or it follows a connector (at, di, in...). A stretch at the
 *                    START of the name is never removed: production place texts often begin with the store ("Sports Station, Pakuwon
 *                    Mall Jogja"), and the name begins with the same brand. Removing it made "Minimal Store", "Sports Station" and
 *                    "Planet Sports" Buy 1 Get 1 Free promos all collapse to "buy 1 get 1 free promo" and score 1.00 (2026-10-20 data).
 *   3. phrase score  0.5 * dice(longest common SUBSEQUENCE) + 0.5 * (longest common contiguous RUN / longer core),
 *                    both over token weights (1 each, or inverse document frequency when a corpus is given). A shared
 *                    phrase in the wrong order scores low; one extra or missing word costs a share of the score that
 *                    shrinks with name length.
 *   4. guards        a number that differs ("25%" vs "30%", a year, "Week 6" vs "Week 7") caps the score: it is another
 *                    promo or another edition, not the same activity. Fewer than two shared content words caps it too: "Jazz at
 *                    Plaza Ambarrukmo" and "Jazz di Kebun" share one common word and are not one activity.
 *   5. the score is max(raw names, cores), so a leading place that is also an activity word ("Jogja Coffee Week") is not
 *      lost by the stripping. Whether two members are at DIFFERENT places is not decided here (isSamePlace, AD-38).
 *
 * Thresholds are NOT calibrated: the tests use the few real names in the repo. Round 4 ask 3 runs the formula over all
 * event names so the cut-offs can be read off real pairs.
 */

const CONNECTORS = new Set(['at', 'di', 'in', 'pada', 'the', 'a', 'an', 'of', 'and', 'dan', 'by', 'with']);
const NUMBER_CAP = 0.5;
const MIN_SHARED_TOKENS = 2;

export function tokens(text: string): string[] {
  return text
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/@/g, ' at ')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ').trim().split(' ').filter(Boolean);
}

/**
 * The name with its connectors removed and ONE stretch removed: the longest run of consecutive name tokens that is also a run of
 * consecutive tokens of the member's own place ("pakuwon mall jogja" in "... at Pakuwon Mall Jogja"). Order is what keeps the brand: the
 * place text "House of Wacoal 2nd Floor, Pakuwon Mall Jogja" shares "wacoal" with the name too, but the run "pakuwon mall jogja" is longer.
 * A run that the OTHER member's name contains as well is shared wording, not a place ("Sports Station" in both names, "Jogja" in
 * "Jogja Coffee Week"), so it is kept; among the rest the longest wins, and the later one on a tie (a place trails more often than it
 * leads). A run is never removed if it would empty the name.
 */
export function core(name: string, ownPlace: string, otherName: string): string[] {
  const nt = contentWithContext(name);
  const run = placeRun(nt, tokens(ownPlace), tokens(otherName).filter((t) => !CONNECTORS.has(t)));
  const toks = nt.map((x) => x.tok);
  return run === null ? toks : [...toks.slice(0, run.start), ...toks.slice(run.end)];
}

interface Tok { tok: string; afterConnector: boolean }
/** Content tokens, each flagged with whether a connector (at, di, in...) came right before it. */
function contentWithContext(name: string): Tok[] {
  const all = tokens(name);
  const out: Tok[] = [];
  all.forEach((t, i) => { if (!CONNECTORS.has(t)) out.push({ tok: t, afterConnector: i > 0 && CONNECTORS.has(all[i - 1]) }); });
  return out;
}

/** The [start, end) range of `nt` that core() removes, or null. Only a trailing run, or one that follows a connector, qualifies. */
function placeRun(nt: Tok[], pt: string[], other: string[]): { start: number; end: number } | null {
  const runs = Array.from({ length: nt.length + 1 }, () => new Array<number>(pt.length + 1).fill(0));
  let best = { len: 0, end: 0 };
  for (let i = 1; i <= nt.length; i++) for (let j = 1; j <= pt.length; j++) {
    if (nt[i - 1].tok !== pt[j - 1]) continue;
    runs[i][j] = runs[i - 1][j - 1] + 1;
    const maximal = i === nt.length || j === pt.length || nt[i].tok !== pt[j];
    const len = runs[i][j];
    const trailing = i === nt.length || nt[i - len].afterConnector;
    if (!maximal || !trailing || len === nt.length || containsRun(other, nt.slice(i - len, i).map((x) => x.tok))) continue;
    if (len >= best.len) best = { len, end: i };
  }
  return best.len === 0 ? null : { start: best.end - best.len, end: best.end };
}

function containsRun(haystack: string[], run: string[]): boolean {
  for (let i = 0; i + run.length <= haystack.length; i++) if (run.every((t, k) => haystack[i + k] === t)) return true;
  return false;
}

export type Weight = (token: string) => number;
const ONE: Weight = () => 1;

/** Inverse document frequency over a list of event names: ln(1 + N / df). A token seen once weighs most. */
export function idfFrom(names: string[]): Weight {
  const df = new Map<string, number>();
  for (const n of names) for (const t of new Set(tokens(n))) df.set(t, (df.get(t) ?? 0) + 1);
  return (t) => Math.log(1 + names.length / (df.get(t) ?? 1));
}

function overlap(a: string[], b: string[], w: Weight): { lcs: number; run: number; shared: number } {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  const cnt = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  const runs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  let run = 0;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const same = a[i - 1] === b[j - 1];
    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], same ? dp[i - 1][j - 1] + w(a[i - 1]) : 0);
    cnt[i][j] = same ? Math.max(cnt[i - 1][j - 1] + 1, cnt[i - 1][j], cnt[i][j - 1]) : Math.max(cnt[i - 1][j], cnt[i][j - 1]);
    if (same) { runs[i][j] = runs[i - 1][j - 1] + w(a[i - 1]); run = Math.max(run, runs[i][j]); }
  }
  return { lcs: dp[a.length][b.length], run, shared: cnt[a.length][b.length] };
}

const sum = (t: string[], w: Weight) => t.reduce((s, x) => s + w(x), 0);
const numbers = (t: string[]) => new Set(t.filter((x) => /\d/.test(x)));

export function phraseScore(a: string[], b: string[], w: Weight = ONE): number {
  if (a.length === 0 || b.length === 0) return 0;
  const { lcs, run, shared } = overlap(a, b, w);
  const wa = sum(a, w); const wb = sum(b, w);
  let score = 0.5 * ((2 * lcs) / (wa + wb)) + 0.5 * (run / Math.max(wa, wb));
  const na = numbers(a); const nb = numbers(b);
  if ([...na].some((x) => !nb.has(x)) || [...nb].some((x) => !na.has(x))) score = Math.min(score, NUMBER_CAP);
  if (shared < MIN_SHARED_TOKENS) score = Math.min(score, NUMBER_CAP);
  return score;
}

export interface Member { name: string; place: string }
export interface SeriesNameResult { score: number; coreA: string[]; coreB: string[] }

export function seriesNameScore(a: Member, b: Member, w: Weight = ONE): SeriesNameResult {
  const coreA = core(a.name, a.place, b.name); const coreB = core(b.name, b.place, a.name);
  const raw = phraseScore(tokens(a.name).filter((t) => !CONNECTORS.has(t)), tokens(b.name).filter((t) => !CONNECTORS.has(t)), w);
  return { score: Math.max(raw, phraseScore(coreA, coreB, w)), coreA, coreB };
}

interface Word { raw: string; toks: string[] }
const wordsOf = (name: string): Word[] => name.split(/\s+/).filter(Boolean).map((raw) => ({ raw, toks: tokens(raw) }));
const content = (w: Word) => w.toks.filter((t) => !CONNECTORS.has(t));

/** The words of `name` left after the place run is removed (strip = false keeps every word). */
function wordsWithoutPlace(name: string, ownPlace: string, otherName: string, strip: boolean): Word[] {
  const words = wordsOf(name);
  if (!strip) return words;
  const flat: Array<Tok & { i: number }> = [];
  let prev = '';
  words.forEach((w, i) => w.toks.forEach((t) => {
    if (!CONNECTORS.has(t)) flat.push({ tok: t, afterConnector: CONNECTORS.has(prev), i });
    prev = t;
  }));
  const run = placeRun(flat, tokens(ownPlace), tokens(otherName).filter((t) => !CONNECTORS.has(t)));
  if (run === null) return words;
  const dropped = new Set(flat.slice(run.start, run.end).map((f) => f.i));
  return words.filter((_, i) => !dropped.has(i));
}

/** Indices of `a`'s content tokens that belong to one longest common subsequence with `b`. */
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

const trimPunct = (s: string) => s.replace(/^[\s,;:|/)\-\u2013\u2014]+|[\s,;:|/(\-\u2013\u2014]+$/g, '');

/**
 * The name the group would show: the words the two members' names SHARE once each place is removed, in the original spelling and casing of
 * the member with the shorter core (the more general name). A word is kept when every one of its content tokens is in the common
 * subsequence; connectors and punctuation ("dan", "-") survive only between two kept words. It uses the same winner as seriesNameScore: if
 * the raw names score at least as high as the cores, nothing is removed. Returns '' when no word is shared.
 */
export function groupName(a: Member, b: Member): string {
  const rawScore = phraseScore(contentTokens(a.name), contentTokens(b.name));
  const strip = phraseScore(core(a.name, a.place, b.name), core(b.name, b.place, a.name)) > rawScore;
  const wa = wordsWithoutPlace(a.name, a.place, b.name, strip);
  const wb = wordsWithoutPlace(b.name, b.place, a.name, strip);
  const flat = (ws: Word[]) => ws.flatMap((w, i) => content(w).map((tok) => ({ tok, i })));
  const fa = flat(wa); const fb = flat(wb);
  const [words, f, otherTokens] = fa.length <= fb.length ? [wa, fa, fb.map((x) => x.tok)] : [wb, fb, fa.map((x) => x.tok)];
  const shared = lcsPositions(f.map((x) => x.tok), otherTokens);
  const keep = words.map((_, i) => {
    const own = f.map((x, k) => (x.i === i ? k : -1)).filter((k) => k >= 0);
    return own.length > 0 && own.every((k) => shared.has(k));
  });
  const first = keep.indexOf(true); const last = keep.lastIndexOf(true);
  if (first < 0) return '';
  const inside = words.slice(first, last + 1).filter((w, k) => keep[first + k] || content(w).length === 0);
  return trimPunct(inside.map((w) => w.raw).join(' '));
}

const contentTokens = (name: string) => tokens(name).filter((t) => !CONNECTORS.has(t));
