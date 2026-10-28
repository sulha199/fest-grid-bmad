/**
 * PROPOSED (personalization plan, Revision 11; the owner confirms or changes the rules, plan section 6.2 #4): the insight of ONE event that several
 * posts describe. The 2026-10-28 prod evaluation showed why this is needed: the Erafone Run family has a race post, a 5K post and a 10K post by the
 * organizer, programme posts, and curator reposts, and event dedup (AD-30 Rule 7) links them into one event. Revision 10: category siblings are one
 * event whose tracks carry the difference, so the tracks of every linked post must survive the link instead of the last post overwriting them.
 *
 * The rules, per field:
 *   - A post classified `report` (IDEA-106: results, a recap, news) announces nothing upcoming, so it adds no audience fields to the event.
 *   - Whose word counts: posts by the event's organizer outrank curator reposts. Curator posts only count when no organizer post exists, except for the
 *     sensitive topic (the safe side: any post that flags one wins).
 *   - Set-like fields (tracks, interests, stated areas) are the UNION over the counted posts. Tracks are matched by label ("5K" = "5 km").
 *   - Cost: the cheapest tier any counted post states. Eligibility: restricted if a counted post says so.
 *   - A disagreement on one value (two ages for the same track) keeps the first counted post (primary first) and is reported in `conflicts`.
 *   - The result does not depend on the order the posts are passed in, except through `primary` and the rank.
 */
import type { AudienceInsight } from './audience-insight.js';

export type PostRank = 'organizer' | 'curator';

export interface InsightPart {
  postId: string;
  rank: PostRank;
  /** The event's primary post (AD-30). It is read first among posts of the same rank. */
  primary?: boolean;
  insight: AudienceInsight;
}

export interface MergedTrack { label?: string; ageMin?: number; ageMax?: number; fromPosts: string[] }
export interface MergedArea { name: string; level: string; source: string; qualifier: string; role: string; fromPosts: string[] }

export interface MergedInsight {
  /** Which posts were counted: the organizer's, or all of them when no organizer post exists. */
  countedPosts: string[];
  tracks: MergedTrack[];
  costTier: string;
  eligibility: string;
  sensitiveTopic: string;
  interests: string[];
  targetAreas: MergedArea[];
  conflicts: string[];
}

export const MAX_MERGED_INTERESTS = 6;
const COST_ORDER = ['free', 'low', 'medium', 'high'] as const;

/** "5K", "5 k", "5 km" and "5KM" are one track; so are "Kids Dash" and "kids-dash". */
export function trackKey(label: string | undefined): string {
  const flat = (label ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
  return flat.replace(/^(\d+)km$/, '$1k');
}

function ordered(parts: InsightPart[]): InsightPart[] {
  const score = (p: InsightPart) => (p.rank === 'organizer' ? 2 : 0) + (p.primary ? 1 : 0);
  return parts.map((p, i) => ({ p, i })).sort((a, b) => score(b.p) - score(a.p) || a.i - b.i).map((x) => x.p);
}

export function mergeEventInsight(allParts: InsightPart[]): MergedInsight {
  const parts = ordered(allParts.filter((p) => p.insight.postKind !== 'report'));
  const hasOrganizer = parts.some((p) => p.rank === 'organizer');
  const counted = hasOrganizer ? parts.filter((p) => p.rank === 'organizer') : parts;
  const conflicts: string[] = [];

  // tracks: union by label; an unlabelled track ("one tier open to everybody") is dropped once any labelled track exists
  const byKey = new Map<string, MergedTrack>();
  for (const part of counted) {
    for (const t of part.insight.tracks) {
      const key = trackKey(t.label);
      const have = byKey.get(key);
      if (!have) {
        byKey.set(key, { ...(t.label ? { label: t.label } : {}), ...(t.ageMin != null ? { ageMin: t.ageMin } : {}), ...(t.ageMax != null ? { ageMax: t.ageMax } : {}), fromPosts: [part.postId] });
        continue;
      }
      if (!have.fromPosts.includes(part.postId)) have.fromPosts.push(part.postId);
      for (const field of ['ageMin', 'ageMax'] as const) {
        const next = t[field];
        if (next == null) continue;
        if (have[field] == null) have[field] = next;
        else if (have[field] !== next) conflicts.push(`track "${have.label ?? '(unlabelled)'}" ${field}: ${have[field]} kept, ${next} from post ${part.postId} ignored`);
      }
    }
  }
  const labelled = [...byKey.entries()].filter(([k]) => k !== '').map(([, v]) => v);
  const tracks = labelled.length > 0 ? labelled : [...byKey.values()];

  // cost: the cheapest tier a counted post states
  const tiers = counted.map((p) => COST_ORDER.indexOf(p.insight.costTier as (typeof COST_ORDER)[number])).filter((i) => i >= 0);
  const costTier = tiers.length ? COST_ORDER[Math.min(...tiers)] : 'unspecified';

  const eligibilities = counted.map((p) => p.insight.eligibility);
  const eligibility = eligibilities.includes('restricted') ? 'restricted' : eligibilities.includes('open_to_public') ? 'open_to_public' : 'unspecified';

  // sensitive topic: any post at all (the safe side)
  const topics = [...new Set(parts.map((p) => p.insight.sensitiveTopic).filter((t) => t && t !== 'none'))];
  if (topics.length > 1) conflicts.push(`sensitive topics disagree (${topics.join(', ')}); ${topics[0]} kept`);
  const sensitiveTopic = topics[0] ?? 'none';

  // interests: union, most-mentioned first, capped
  const seen = new Map<string, { n: number; first: number }>();
  let order = 0;
  for (const part of counted) {
    for (const tag of new Set(part.insight.interests.map((t) => t.trim().toLowerCase()).filter(Boolean))) {
      const have = seen.get(tag);
      if (have) have.n++;
      else seen.set(tag, { n: 1, first: order++ });
    }
  }
  const interests = [...seen.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first).map(([tag]) => tag).slice(0, MAX_MERGED_INTERESTS);

  // stated areas: union (the implicit venue, hashtag and account areas are derived from the event, not from its posts)
  const areas = new Map<string, MergedArea>();
  for (const part of counted) {
    for (const a of part.insight.targetAreas ?? []) {
      const key = `${a.name.trim().toLowerCase()}|${a.level}`;
      const have = areas.get(key);
      if (have) { if (!have.fromPosts.includes(part.postId)) have.fromPosts.push(part.postId); continue; }
      areas.set(key, { name: a.name, level: a.level, source: a.source, qualifier: a.qualifier, role: a.role, fromPosts: [part.postId] });
    }
  }

  return { countedPosts: counted.map((p) => p.postId), tracks, costTier, eligibility, sensitiveTopic, interests, targetAreas: [...areas.values()], conflicts };
}
