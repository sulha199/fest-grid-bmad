/**
 * Pure scorer for the audience, language and taxonomy POC: the thresholds of plan §5 (event-insight-poc/audience-and-taxonomy-poc-plan-2026-10-21.md)
 * applied to the frozen labels and the saved model runs. It reads labels and structured run records only; it never sees a caption.
 *
 * How to read a number it returns:
 *   - accuracy is pooled over runs (every run of every post counts once); `majority` is the per-post majority of the runs;
 *   - a label of `unclear` is the labeller's abstention, so it is left out of the denominators and counted apart;
 *   - every proportion carries a 95% Wilson interval, because the held-out half is small, and a bar is marked PASS only on the point estimate:
 *     `weak` flags a pass whose lower bound is under the bar, and a stratum under MIN_STRATUM_N posts is flagged as too small to claim anything.
 */
import type { RunRecord } from './audience-poc-lib.js';

export type Row = Record<string, string>;
export const MIN_STRATUM_N = 15;

export interface Prop { k: number; n: number; pct: number; lo: number; hi: number }

/** 95% Wilson score interval. */
export function prop(k: number, n: number): Prop {
  if (n === 0) return { k, n, pct: NaN, lo: NaN, hi: NaN };
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { k, n, pct: 100 * p, lo: 100 * Math.max(0, centre - half), hi: 100 * Math.min(1, centre + half) };
}

const lc = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Groups the usable runs by post id. */
export function runsById(records: RunRecord[]): Map<string, RunRecord[]> {
  const m = new Map<string, RunRecord[]>();
  for (const r of records) if (r.ok && r.model && r.resolved) m.set(r.id, [...(m.get(r.id) ?? []), r]);
  return m;
}

// ---- strata ---------------------------------------------------------------------------------
const SHARED_LANGUAGE_STRATA = new Set(['malay-my', 'malaysia', 'expat-id']);
export const isSharedLanguage = (l: Row) => SHARED_LANGUAGE_STRATA.has(l.stratum) || ['en', 'ms'].includes(lc(l.post_language));
export const isForeign = (l: Row) => l.stratum === 'foreign-id' || !['id', 'unclear', ''].includes(lc(l.audience_country));
export const isHardStratum = (l: Row) => isSharedLanguage(l) || isForeign(l);

// ---- generic pooled accuracy ----------------------------------------------------------------
interface Acc { pooled: Prop; majority: Prop; skipped: number }

function accuracy(labels: Row[], runs: Map<string, RunRecord[]>, truth: (l: Row) => string | undefined, pick: (r: RunRecord) => string | undefined): Acc {
  let k = 0, n = 0, mk = 0, mn = 0, skipped = 0;
  for (const l of labels) {
    const t = truth(l);
    const rs = runs.get(l.id);
    if (t === undefined || t === 'unclear' || t === '') { skipped++; continue; }
    if (!rs?.length) continue;
    const answers = rs.map((r) => pick(r));
    for (const a of answers) { n++; if (a === t) k++; }
    const tally = new Map<string, number>();
    for (const a of answers) tally.set(a ?? '', (tally.get(a ?? '') ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    mn++; if (top[0] === t) mk++;
  }
  return { pooled: prop(k, n), majority: prop(mk, mn), skipped };
}

// ---- the report data -------------------------------------------------------------------------
export interface Verdict { measure: string; bar: string; value: string; status: 'PASS' | 'FAIL' | 'INFO' | 'N/A'; weak?: boolean; note?: string }

export interface Report {
  posts: number;
  postsWithRuns: number;
  runs: number;
  failedRuns: number;
  verdicts: Verdict[];
  byStratum: Array<{ stratum: string; posts: number; country: Prop; tooSmall: boolean }>;
  countryBySource: Array<{ source: string; country: Prop }>;
  countryErrors: Array<{ id: string; stratum: string; label: string; answered: string; source: string }>;
  critical: Array<{ id: string; kind: string }>;
  fields: Array<{ field: string; accuracy: Prop }>;
  interests: { meanJaccard: number; mappedShare: number; distinctPer100: number; tags: number };
  sensitive: Array<{ variant: string; recall: Prop; precision: Prop }>;
  cost: { calls: number; meanInput: number; meanOutput: number; p50Ms: number; p95Ms: number; rateLimitRetries: number };
}

const pctStr = (p: Prop) => (Number.isNaN(p.pct) ? 'n/a' : `${p.pct.toFixed(1)}% (${p.k}/${p.n}; 95% CI ${p.lo.toFixed(0)}–${p.hi.toFixed(0)})`);
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function atLeast(measure: string, bar: number, p: Prop, note?: string): Verdict {
  if (p.n === 0) return { measure, bar: `≥ ${bar}%`, value: 'n/a', status: 'N/A', note };
  return { measure, bar: `≥ ${bar}%`, value: pctStr(p), status: p.pct >= bar ? 'PASS' : 'FAIL', weak: p.pct >= bar && p.lo < bar, note };
}

// Keywords that map a free interest tag to one of the 18 existing EventCategory values (indicative: the real mapping table is what AD-42 Rule 7 builds).
const CATEGORY_WORDS: Record<string, RegExp> = {
  MUSIC: /\b(music|concert|festival|band|dj|live music|orchestra|choir|singing|karaoke)\b/,
  ARTS_AND_CULTURE: /\b(art|arts|culture|cultural|exhibition|theatre|theater|dance|craft|batik|museum|heritage|film|cinema|photography|painting|opera|literature|reading|books?)\b/,
  FOOD_AND_DRINK: /\b(food|culinary|coffee|dining|cuisine|restaurant|drink|bakery|chocolate|tea|baking|cooking)\b/,
  SPORTS_AND_FITNESS: /\b(run|running|marathon|sport|sports|fitness|yoga|zumba|badminton|football|futsal|cycling|gym|padel|kickboxing|hiking|swimming|walk|walking|trail|esports?)\b/,
  FAMILY_AND_KIDS: /\b(kids?|children|family|families|toddlers?|parenting)\b/,
  HOBBIES_AND_INTERESTS: /\b(hobby|hobbies|gaming|games?|collecting|diy|pottery|animals?|wildlife|zoo|nature|garden|gardening|fashion|shopping)\b/,
  BUSINESS_AND_NETWORKING: /\b(business|networking|entrepreneur\w*|marketing|sales|startup|finance|investment|stocks?|economy|industry|summit|expo)\b/,
  HEALTH_AND_WELLNESS: /\b(health|wellness|mental|meditation|spa|therapy|mindfulness|self-?care|digital detox|well-?being)\b/,
  HOLIDAY: /\b(halloween|christmas|new year|eid|lebaran|diwali|holiday|easter|valentine)\b/,
  CHARITY_AND_CAUSES: /\b(charity|donation|fundrais\w*|volunteer\w*|cause|sustainability|environment\w*|climate)\b/,
  CIVIC_AND_COMMUNITY: /\b(community|civic|government|public service|local community)\b/,
  RELIGION_AND_SPIRITUALITY: /\b(religio\w*|islam\w*|christian\w*|catholic|church|mosque|prayer|spiritual\w*|faith|worship|hajj|umrah)\b/,
  TECHNOLOGY: /\b(tech\w*|ai|artificial intelligence|software|digital|data|coding|programming|hackathon|gadget)\b/,
  TRAVEL_AND_TOURISM: /\b(travel|tourism|tour|trip|holiday package|sightseeing|honeymoon|wisata)\b/,
  EDUCATION: /\b(education|learning|school|university|campus|scholarship|academic|research|workshop|webinar|seminar|training|course|english)\b/,
  CAREER: /\b(career|job|jobs|recruitment|professional development|skills?)\b/,
  AUTOMOTIVE: /\b(automotive|car|cars|motorcycle|custom culture|kustom)\b/,
};
export const mapsToCategory = (tag: string): boolean => Object.values(CATEGORY_WORDS).some((re) => re.test(tag));

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

export function score(labelsAll: Row[], records: RunRecord[]): Report {
  const runs = runsById(records);
  const labels = labelsAll.filter((l) => runs.has(l.id));
  const usable = [...runs.values()].flat();
  const verdicts: Verdict[] = [];
  // Posts the labeller marked is_event = no (a recap, a repost, news, a shop promo) have no schedule: event-specific fields are not scored on them.
  const eventLabels = labels.filter((l) => lc(l.is_event) !== 'no');

  // ---- audience country (the ladder's output)
  const country = (l: Row) => lc(l.audience_country);
  const ladder = (r: RunRecord) => r.resolved!.audienceCountry;
  const all = accuracy(labels, runs, country, ladder);
  const hard = accuracy(labels.filter(isHardStratum), runs, country, ladder);
  verdicts.push(atLeast('Audience country, exact, all events', 95, all.pooled, `majority of runs: ${pctStr(all.majority)}; labelled unclear and left out: ${all.skipped}`));
  verdicts.push(atLeast('Audience country, exact, foreign and shared-language strata', 90, hard.pooled, `majority of runs: ${pctStr(hard.majority)}`));
  const modelOnly = accuracy(labels, runs, country, (r) => (r.model!.statedCountry && r.model!.statedVerified ? r.model!.statedCountry : r.model!.eventCountry ?? 'unclear'));
  verdicts.push({ measure: 'Audience country from the model alone (stated, else event place), for comparison', bar: 'reported', value: pctStr(modelOnly.pooled), status: 'INFO', note: 'shows what the ladder adds' });

  // ---- critical errors
  const critical: Array<{ id: string; kind: string }> = [];
  for (const l of labels) {
    for (const r of runs.get(l.id) ?? []) {
      if (r.model!.ageWritten === 'yes' && lc(l.age_written) === 'no') critical.push({ id: l.id, kind: 'invented age' });
      if (r.model!.geoScope === 'national' && lc(l.geo_scope) !== 'national' && lc(l.geo_scope) !== 'unclear') critical.push({ id: l.id, kind: 'wrongly national' });
      if (r.resolved!.audienceSource === 'stated' && country(l) !== 'unclear' && r.resolved!.audienceCountry !== country(l)) critical.push({ id: l.id, kind: 'wrong country on a stated audience' });
    }
  }
  const nonVerbatim = usable.reduce((n, r) => n + (r.claims?.nonVerbatimQuotes ?? 0), 0);
  verdicts.push({ measure: 'Critical errors (invented age, wrongly national, wrong country on a stated audience)', bar: '0', value: String(critical.length), status: critical.length === 0 ? 'PASS' : 'FAIL', note: `non-verbatim quotes the guard removed before they could surface: ${nonVerbatim} (a surviving one would be critical; none can, by construction)` });

  // ---- geoScope
  const geo = accuracy(eventLabels, runs, (l) => lc(l.geo_scope), (r) => r.model!.geoScope);
  const geoRaw = accuracy(eventLabels, runs, (l) => lc(l.geo_scope), (r) => r.model!.geoScopeRaw);
  verdicts.push(atLeast('geoScope exact (after the guards)', 90, geo.pooled, `before the guards: ${pctStr(geoRaw.pooled)}`));

  // ---- run-to-run agreement on the audience country
  let agreeing = 0, multi = 0;
  for (const l of labels) {
    const rs = runs.get(l.id) ?? [];
    if (rs.length < 2) continue;
    multi++;
    if (new Set(rs.map(ladder)).size === 1) agreeing++;
  }
  verdicts.push(atLeast('Run-to-run agreement on audience country (every run of a post gives the same answer)', 95, prop(agreeing, multi)));

  // ---- abstention
  const proposed = usable.reduce((n, r) => n + (r.claims?.proposed ?? 0), 0);
  const dropped = usable.reduce((n, r) => n + (r.claims?.dropped ?? 0), 0);
  const abst = prop(dropped, proposed);
  verdicts.push({ measure: 'Abstention (checkable claims a guard dropped), reported apart from wrong claims', bar: '≤ 15%', value: pctStr(abst), status: abst.n === 0 ? 'N/A' : abst.pct <= 15 ? 'PASS' : 'FAIL', weak: abst.n > 0 && abst.pct <= 15 && abst.hi > 15 });
  const unclearAnswers = usable.filter((r) => ladder(r) === 'unclear').length;
  verdicts.push({ measure: 'Runs where the ladder answered unclear', bar: 'reported', value: pctStr(prop(unclearAnswers, usable.length)), status: 'INFO' });

  // ---- language
  const msLabels = labels.filter((l) => lc(l.post_language) === 'ms');
  const msResolved = accuracy(msLabels, runs, (l) => lc(l.post_language), (r) => r.resolved!.postLanguage);
  const msModel = accuracy(msLabels, runs, (l) => lc(l.post_language), (r) => r.model!.postLanguage);
  verdicts.push(atLeast('Post language on the Malay sample, with one extra cue', 90, msResolved.pooled, `model alone: ${pctStr(msModel.pooled)}`));
  const langAll = accuracy(labels, runs, (l) => lc(l.post_language), (r) => r.resolved!.postLanguage);

  // ---- sensitive screen
  const sens = (variant: string, pick: (r: RunRecord) => string) => {
    let tp = 0, pos = 0, predPos = 0, predTp = 0;
    for (const l of labels) {
      const truePositive = lc(l.sensitive) !== 'none' && lc(l.sensitive) !== 'unclear' && lc(l.sensitive) !== '';
      for (const r of runs.get(l.id) ?? []) {
        const said = pick(r) !== 'none';
        if (truePositive) { pos++; if (said) tp++; }
        if (said) { predPos++; if (truePositive) predTp++; }
      }
    }
    return { variant, recall: prop(tp, pos), precision: prop(predTp, predPos) };
  };
  const sensitive = [
    sens('model flag only', (r) => r.model!.sensitiveTopic),
    sens('word list only', (r) => r.resolved!.sensitiveListHit ?? 'none'),
    sens('model flag or word list (what ships)', (r) => r.resolved!.sensitive),
  ];
  verdicts.push(atLeast('Sensitive screen recall on the labelled sensitive events (model flag or word list)', 95, sensitive[2].recall, `precision ${pctStr(sensitive[2].precision)}`));

  // ---- other fields, reported
  const captionPriced = eventLabels.filter((l) => ['caption', 'none', ''].includes(lc(l.cost_source)));
  const fields: Report['fields'] = [
    { field: 'is_event', accuracy: accuracy(labels, runs, (l) => lc(l.is_event), (r) => (r.model!.isEvent === undefined ? undefined : r.model!.isEvent ? 'yes' : 'no')).pooled },
    { field: 'eligibility (events only, after the guards)', accuracy: accuracy(eventLabels, runs, (l) => lc(l.eligibility), (r) => r.model!.eligibility).pooled },
    { field: 'costTier (events whose price is in the caption or absent)', accuracy: accuracy(captionPriced, runs, (l) => lc(l.cost_tier), (r) => r.model!.costTier).pooled },
    { field: 'costTier (all events, including prices only in the image)', accuracy: accuracy(eventLabels, runs, (l) => lc(l.cost_tier), (r) => r.model!.costTier).pooled },
    { field: 'track count (events only; none listed counts as 1)', accuracy: accuracy(eventLabels, runs, (l) => lc(l.track_count), (r) => String(Math.max(1, r.model!.trackCount))).pooled },
    { field: 'age written (events only)', accuracy: accuracy(eventLabels, runs, (l) => lc(l.age_written), (r) => r.model!.ageWritten).pooled },
    { field: 'target area level (events only)', accuracy: accuracy(eventLabels, runs, (l) => lc(l.target_area_level), (r) => r.model!.targetAreaLevel).pooled },
    { field: 'post language (resolved)', accuracy: langAll.pooled },
    { field: 'sensitive topic (exact, any variant)', accuracy: accuracy(labels, runs, (l) => lc(l.sensitive), (r) => r.resolved!.sensitive).pooled },
  ];

  // ---- interests
  const jac: number[] = [];
  const allTags: string[] = [];
  const distinct = new Set<string>();
  for (const l of labels) {
    const rs = runs.get(l.id) ?? [];
    const sets = rs.map((r) => new Set(r.model!.interests));
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) jac.push(jaccard(sets[i], sets[j]));
    if (rs[0]) for (const t of rs[0].model!.interests) { allTags.push(t); distinct.add(t); }
  }
  const interests = {
    meanJaccard: mean(jac),
    mappedShare: allTags.length ? allTags.filter(mapsToCategory).length / allTags.length : NaN,
    distinctPer100: labels.length ? (100 * distinct.size) / labels.length : NaN,
    tags: allTags.length,
  };
  verdicts.push({ measure: 'Interest tags: mean Jaccard between runs; share mapping to an existing category; distinct tags per 100 events', bar: 'reported (no bar)', value: `${interests.meanJaccard.toFixed(2)}; ${(100 * interests.mappedShare).toFixed(0)}%; ${interests.distinctPer100.toFixed(0)}`, status: 'INFO', note: 'the category mapping is a keyword approximation, not the AD-42 Rule 7 table' });

  // ---- cost
  const cost = {
    calls: usable.length,
    meanInput: mean(usable.map((r) => r.usage.inputTokens ?? NaN).filter((x) => !Number.isNaN(x))),
    meanOutput: mean(usable.map((r) => (r.usage.outputTokens ?? 0) + (r.usage.thoughtTokens ?? 0))),
    p50Ms: quantile(usable.map((r) => r.usage.latencyMs), 0.5),
    p95Ms: quantile(usable.map((r) => r.usage.latencyMs), 0.95),
    rateLimitRetries: records.reduce((n, r) => n + r.usage.rateLimitRetries, 0),
  };
  verdicts.push({ measure: 'Cost per post', bar: 'reported', value: `${Math.round(cost.meanInput)} in / ${Math.round(cost.meanOutput)} out tokens, p50 ${Math.round(cost.p50Ms)} ms, p95 ${Math.round(cost.p95Ms)} ms, ${cost.rateLimitRetries} rate-limit retries`, status: 'INFO' });

  // ---- by stratum and by ladder source, and every miss
  const strata = [...new Set(labels.map((l) => l.stratum))].sort();
  const byStratum = strata.map((s) => {
    const ls = labels.filter((l) => l.stratum === s);
    return { stratum: s, posts: ls.length, country: accuracy(ls, runs, country, ladder).pooled, tooSmall: ls.length < MIN_STRATUM_N };
  });
  const sources = [...new Set(usable.map((r) => r.resolved!.audienceSource))].sort();
  const countryBySource = sources.map((source) => {
    let k = 0, n = 0;
    for (const l of labels) for (const r of runs.get(l.id) ?? []) {
      if (r.resolved!.audienceSource !== source || country(l) === 'unclear') continue;
      n++; if (r.resolved!.audienceCountry === country(l)) k++;
    }
    return { source, country: prop(k, n) };
  });
  const countryErrors: Report['countryErrors'] = [];
  for (const l of labels) {
    if (country(l) === 'unclear') continue;
    const r = (runs.get(l.id) ?? []).find((x) => x.resolved!.audienceCountry !== country(l));
    if (r) countryErrors.push({ id: l.id, stratum: l.stratum, label: country(l), answered: r.resolved!.audienceCountry, source: r.resolved!.audienceSource });
  }

  return {
    posts: labelsAll.length, postsWithRuns: labels.length, runs: usable.length, failedRuns: records.filter((r) => !r.ok).length,
    verdicts, byStratum, countryBySource, countryErrors, critical, fields, interests, sensitive, cost,
  };
}

export function formatReport(rep: Report, title: string): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  L.push(`${rep.postsWithRuns} of ${rep.posts} labelled posts have model runs; ${rep.runs} usable runs; ${rep.failedRuns} failed runs. Counts and enum values only; no caption.`, '');
  L.push('## Plan §5 thresholds', '', '| Measure | Bar | Result | Status | Note |', '|---|---|---|---|---|');
  for (const v of rep.verdicts) L.push(`| ${v.measure} | ${v.bar} | ${v.value} | ${v.status}${v.weak ? ' (weak: lower bound under the bar)' : ''} | ${v.note ?? ''} |`);
  L.push('', '## Audience country by stratum', '', '| Stratum | Posts | Exact | Note |', '|---|--:|---|---|');
  for (const s of rep.byStratum) L.push(`| ${s.stratum} | ${s.posts} | ${pctStr(s.country)} | ${s.tooSmall ? `under ${MIN_STRATUM_N} posts: too few to claim anything` : ''} |`);
  L.push('', '## Audience country by the ladder step that decided it', '', '| Source | Exact |', '|---|---|');
  for (const s of rep.countryBySource) L.push(`| ${s.source} | ${pctStr(s.country)} |`);
  L.push('', '## Other fields (pooled over runs)', '', '| Field | Exact |', '|---|---|');
  for (const f of rep.fields) L.push(`| ${f.field} | ${pctStr(f.accuracy)} |`);
  L.push('', '## Sensitive screen', '', '| Variant | Recall | Precision |', '|---|---|---|');
  for (const s of rep.sensitive) L.push(`| ${s.variant} | ${pctStr(s.recall)} | ${pctStr(s.precision)} |`);
  L.push('', `## Critical errors: ${rep.critical.length}`, '');
  for (const c of rep.critical.slice(0, 40)) L.push(`- ${c.id}: ${c.kind}`);
  L.push('', `## Posts whose audience country was wrong in at least one run: ${rep.countryErrors.length}`, '', '| Post | Stratum | Label | Answered | Decided by |', '|---|---|---|---|---|');
  for (const e of rep.countryErrors.slice(0, 80)) L.push(`| ${e.id} | ${e.stratum} | ${e.label} | ${e.answered} | ${e.source} |`);
  L.push('', '## Limits to state', '', '- Text only: the face-blurred image the real pipeline sends was not part of these runs.', '- One standalone call per post, not the production combined call; every post is treated as an event, including recaps and shop promos.', '- One model; the labels are the owner’s (held-out half also the second labeller’s, if agreed); strata under the size above prove nothing.');
  return L.join('\n') + '\n';
}
