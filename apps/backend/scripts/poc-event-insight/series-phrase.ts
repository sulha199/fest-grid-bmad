/**
 * POC (pure, no I/O): are two event names "the same activity" once each one's own place is taken out, judged by
 * phrase overlap and word ORDER instead of one exact suffix pattern ("- X", "at X", "@ X", "di X", "(X)")?
 * Spine reference: AD-36 Rule 12 (series stem) and the cross-account question left open after Round 3 item 15.
 *
 *   1. tokens        lower case, accents folded, punctuation to spaces; connectors (at, di, in, the, and, dan...) dropped.
 *   2. core          a member's name minus the longest stretch of it that is also a stretch of ITS OWN place text
 *                    ("Wacoal 25% Off Promo at Pakuwon Mall Jogja" at "House of Wacoal 2nd Floor, Pakuwon Mall Jogja" ->
 *                    "wacoal 25% off promo"). Where the place sits in the name (end, start, middle, after a dash, in brackets)
 *                    does not matter, and the brand survives even when the place text repeats it.
 *   3. phrase score  0.5 * dice(longest common SUBSEQUENCE) + 0.5 * (longest common contiguous RUN / longer core),
 *                    both over token weights (1 each, or inverse document frequency when a corpus is given). A shared
 *                    phrase in the wrong order scores low; one extra or missing word costs a share of the score that
 *                    shrinks with name length.
 *   4. guards        a number that differs ("25%" vs "30%", a year, "Week 6" vs "Week 7") caps the score: it is another
 *                    promo or another edition, not the same activity.
 *   5. the score is max(raw names, cores), so a leading place that is also an activity word ("Jogja Coffee Week") is not
 *      lost by the stripping. Whether two members are at DIFFERENT places is not decided here (isSamePlace, AD-38).
 *
 * Thresholds are NOT calibrated: the tests use the few real names in the repo. Round 4 ask 3 runs the formula over all
 * event names so the cut-offs can be read off real pairs.
 */

const CONNECTORS = new Set(['at', 'di', 'in', 'pada', 'the', 'a', 'an', 'of', 'and', 'dan', 'by', 'with']);
const NUMBER_CAP = 0.5;

export function tokens(text: string): string[] {
  return text
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
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
  const nt = tokens(name).filter((t) => !CONNECTORS.has(t));
  const pt = tokens(ownPlace);
  const other = tokens(otherName).filter((t) => !CONNECTORS.has(t));
  const runs = Array.from({ length: nt.length + 1 }, () => new Array<number>(pt.length + 1).fill(0));
  let best = { len: 0, end: 0 };
  for (let i = 1; i <= nt.length; i++) for (let j = 1; j <= pt.length; j++) {
    if (nt[i - 1] !== pt[j - 1]) continue;
    runs[i][j] = runs[i - 1][j - 1] + 1;
    const maximal = i === nt.length || j === pt.length || nt[i] !== pt[j];
    const len = runs[i][j];
    if (!maximal || len === nt.length || containsRun(other, nt.slice(i - len, i))) continue;
    if (len >= best.len) best = { len, end: i };
  }
  return best.len === 0 ? nt : [...nt.slice(0, best.end - best.len), ...nt.slice(best.end)];
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

function overlap(a: string[], b: string[], w: Weight): { lcs: number; run: number } {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  const runs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  let run = 0;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const same = a[i - 1] === b[j - 1];
    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], same ? dp[i - 1][j - 1] + w(a[i - 1]) : 0);
    if (same) { runs[i][j] = runs[i - 1][j - 1] + w(a[i - 1]); run = Math.max(run, runs[i][j]); }
  }
  return { lcs: dp[a.length][b.length], run };
}

const sum = (t: string[], w: Weight) => t.reduce((s, x) => s + w(x), 0);
const numbers = (t: string[]) => new Set(t.filter((x) => /\d/.test(x)));

export function phraseScore(a: string[], b: string[], w: Weight = ONE): number {
  if (a.length === 0 || b.length === 0) return 0;
  const { lcs, run } = overlap(a, b, w);
  const wa = sum(a, w); const wb = sum(b, w);
  let score = 0.5 * ((2 * lcs) / (wa + wb)) + 0.5 * (run / Math.max(wa, wb));
  const na = numbers(a); const nb = numbers(b);
  if ([...na].some((x) => !nb.has(x)) || [...nb].some((x) => !na.has(x))) score = Math.min(score, NUMBER_CAP);
  return score;
}

export interface Member { name: string; place: string }
export interface SeriesNameResult { score: number; coreA: string[]; coreB: string[] }

export function seriesNameScore(a: Member, b: Member, w: Weight = ONE): SeriesNameResult {
  const coreA = core(a.name, a.place, b.name); const coreB = core(b.name, b.place, a.name);
  const raw = phraseScore(tokens(a.name).filter((t) => !CONNECTORS.has(t)), tokens(b.name).filter((t) => !CONNECTORS.has(t)), w);
  return { score: Math.max(raw, phraseScore(coreA, coreB, w)), coreA, coreB };
}
