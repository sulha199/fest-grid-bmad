/**
 * POC (pure, no I/O): the target-area DECISION TREE of target-area-spec-2026-10-27.md as code.
 *
 * An event has a SET of target areas at mixed levels (a city, a province, an aggregate such as "Solo Raya"). Each member is
 * `{key, level, sources, role, qualifier, ...}`. The tree, first rule that answers:
 *   1. STATED (the model, grounded in the caption or poster): a stated audience wins outright; no implicit area is added.
 *   2. SCOPE GATE: nationwide stated scope -> no area; an online event takes only a local organizer's own area.
 *   3. IMPLICIT, signals tagged by source, merged: venue, then account, then hashtags.
 *      Signals that NEST (one inside the other) resolve to the widest container; signals that are DISJOINT are not merged: the higher-priority
 *      signal stays, the other is dropped and the conflict is reported.
 *   4. Nothing -> unknown (an empty set; the event is published with a lower rank, PRD FR123).
 *
 * Normalisation (owner decisions, 2026-10-27): members that nest collapse to the widest; at most MAX_TARGET_AREA_MEMBERS members, more are
 * stored as the covering aggregate or ancestor; a national stated audience with a local venue keeps BOTH (country as `participant`, the venue
 * as `attendee`); a caption and a poster that disagree (disjoint) are both kept and the conflict is flagged.
 */
import type { GazetteerIndex } from './area-resolver.js';
import { implicitAreaKey, type VenueClass } from './implicit-level-policy.js';
import { mayUseAccountLocation, type AccountReach, type AccountType, type AccountTypeStatus } from './location-policy.js';

export const MAX_TARGET_AREA_MEMBERS = 8;

export type TargetAreaSource = 'stated' | 'stated_poster' | 'venue' | 'hashtag' | 'account' | 'account_bio';
export type AreaRole = 'participant' | 'attendee' | 'both';
export type AreaQualifier = 'only' | 'and_surroundings' | 'part_of' | 'none';

export interface TargetAreaMember {
  /** A gazetteer key, an aggregate key (a compressed large set), or the anchor key of a neighbourhood. */
  key: string;
  /** The gazetteer level, 'aggregate', or 'neighborhood'. */
  level: string;
  sources: TargetAreaSource[];
  role: AreaRole;
  qualifier: AreaQualifier;
  /** Neighbourhood only: the kelurahan/desa it sits in, and the label as written ("RW 05"). */
  anchor?: string;
  label?: string;
  quotes: string[];
  ambiguous?: boolean;
}

export interface TargetAreaConflict { kept: string; dropped: string; reason: string }

export interface DeriveInput {
  geoScope: string;
  /** Resolved and guarded model output (source stated | stated_poster). */
  stated: TargetAreaMember[];
  /** An ACCEPTED venue (`decideVenue`): the gazetteer keys of its area, its class, and the pin precision. */
  venue?: { keys: string[]; venueClass: VenueClass; precision: 'EXACT' | 'AREA' };
  hashtagKeys: string[];
  account: {
    type: AccountType;
    status: AccountTypeStatus;
    reach?: AccountReach;
    /** The area of an organizer's default location. */
    defaultAreaKeys: string[];
    /** The audience area of a curator (or an unclassified account), from its profile or bio. */
    audienceAreaKeys: string[];
    audienceFromBio?: boolean;
  };
}

export interface DeriveResult {
  members: TargetAreaMember[];
  conflicts: TargetAreaConflict[];
  basis: TargetAreaSource | 'nationwide' | 'none';
  flags: string[];
}

const SOURCE_PRIORITY: TargetAreaSource[] = ['stated', 'stated_poster', 'venue', 'account', 'account_bio', 'hashtag'];

// ---- relations ---------------------------------------------------------------------------------------------------------
/** The ancestor path used for nesting; a neighbourhood nests through its anchor, an unanchored one nests nowhere. */
function pathOf(m: TargetAreaMember, ix: GazetteerIndex): string[] {
  if (m.level === 'neighborhood') return m.anchor ? [...ix.pathOf(m.anchor), `${m.anchor}#${m.label ?? 'nbh'}`] : [];
  return ix.pathOf(m.key);
}

const same = (a: TargetAreaMember, b: TargetAreaMember): boolean =>
  a.key === b.key && a.level === b.level && (a.label ?? '') === (b.label ?? '');

/** `a` lies inside `b` (and is not the same member). */
function inside(a: TargetAreaMember, b: TargetAreaMember, ix: GazetteerIndex): boolean {
  if (same(a, b)) return false;
  if (b.level === 'neighborhood') return false;
  return pathOf(a, ix).includes(b.key);
}

const nests = (a: TargetAreaMember, b: TargetAreaMember, ix: GazetteerIndex): boolean => same(a, b) || inside(a, b, ix) || inside(b, a, ix);

function mergeInfo(target: TargetAreaMember, other: TargetAreaMember): TargetAreaMember {
  const role: AreaRole = target.role === other.role ? target.role : 'both';
  const qualifier: AreaQualifier = target.qualifier === other.qualifier ? target.qualifier : 'none';
  return {
    ...target,
    sources: [...new Set([...target.sources, ...other.sources])].sort((x, y) => SOURCE_PRIORITY.indexOf(x) - SOURCE_PRIORITY.indexOf(y)),
    role,
    qualifier,
    quotes: [...new Set([...target.quotes, ...other.quotes])],
    ambiguous: target.ambiguous || other.ambiguous || undefined,
  };
}

// ---- normalisation -----------------------------------------------------------------------------------------------------
/** Nested members collapse to the widest container (quotes and sources are kept); disjoint members stay separate. */
export function mergeMembers(members: readonly TargetAreaMember[], ix: GazetteerIndex): TargetAreaMember[] {
  let result: TargetAreaMember[] = [];
  for (const m of members) {
    let current: TargetAreaMember = { ...m };
    const keep: TargetAreaMember[] = [];
    let absorbed = false;
    for (const r of result) {
      // A participant area and an attendee area are different audiences (national registration, local final): never collapse one into the other.
      const sameAudience = r.role === 'both' || current.role === 'both' || r.role === current.role;
      if (same(r, current)) current = mergeInfo(current, r);
      else if (sameAudience && inside(current, r, ix)) { keep.push(mergeInfo(r, current)); absorbed = true; }
      else if (sameAudience && inside(r, current, ix)) current = mergeInfo(current, r);
      else keep.push(r);
    }
    if (!absorbed) keep.push(current);
    result = keep;
  }
  return result.length > MAX_TARGET_AREA_MEMBERS ? [compress(result, ix)] : result;
}

/**
 * More than the cap: store the smallest aggregate that covers every member, else their deepest common ancestor, else the country. A large set is
 * also what a stated aggregate ("seluruh Jawa") expands to, so this is the same shape the PRD already uses for very large sets.
 */
function compress(members: TargetAreaMember[], ix: GazetteerIndex): TargetAreaMember {
  const paths = members.map((m) => pathOf(m, ix));
  const aggregates = new Map<string, string[]>();
  for (const a of ix.aggByAlias.values()) aggregates.set(a.key, a.members);
  const covers = (aggMembers: string[]): boolean => paths.every((p) => p.some((k) => aggMembers.includes(k)));
  let best: { key: string; size: number } | undefined;
  for (const [key, mem] of aggregates) if (covers(mem) && (!best || mem.length < best.size)) best = { key, size: mem.length };
  let key: string;
  let level: string;
  if (best) { key = best.key; level = 'aggregate'; }
  else {
    const first = paths[0] ?? [];
    let common = '';
    for (let i = 0; i < first.length; i++) if (paths.every((p) => p[i] === first[i])) common = first[i]; else break;
    key = common || 'id';
    level = ix.byKey.get(key)?.level ?? 'country';
  }
  const base: TargetAreaMember = { key, level, sources: [], role: 'both', qualifier: 'none', quotes: [] };
  return members.reduce((acc, m) => mergeInfo(acc, m), base);
}

// ---- the decision tree ---------------------------------------------------------------------------------------------------
function memberFor(key: string, source: TargetAreaSource, ix: GazetteerIndex, role: AreaRole = 'both'): TargetAreaMember {
  return { key, level: ix.byKey.get(key)?.level ?? 'aggregate', sources: [source], role, qualifier: 'none', quotes: [] };
}

const isCountryLevel = (m: TargetAreaMember, ix: GazetteerIndex): boolean => {
  const level = ix.byKey.get(m.key)?.level;
  return level === 'country' || m.key === 'id';
};

export function deriveTargetAreas(input: DeriveInput, ix: GazetteerIndex): DeriveResult {
  const conflicts: TargetAreaConflict[] = [];
  const flags: string[] = [];
  const venueMembers = (role: AreaRole): TargetAreaMember[] =>
    input.venue ? [...new Set(input.venue.keys.map((k) => implicitAreaKey(k, input.venue!.venueClass, ix)))].map((k) => memberFor(k, 'venue', ix, role)) : [];

  // 1. STATED wins outright.
  if (input.stated.length > 0) {
    let members = mergeMembers(input.stated, ix);
    // A nationwide registration with a local event: keep the venue as the place people attend.
    if (members.some((m) => isCountryLevel(m, ix)) && input.venue) {
      members = mergeMembers([...members.map((m) => ({ ...m, role: m.role === 'both' ? 'participant' : m.role })), ...venueMembers('attendee')], ix);
      flags.push('dual-audience: national participants, local attendees');
    }
    const caption = members.filter((m) => m.sources.every((s) => s === 'stated'));
    const poster = members.filter((m) => m.sources.every((s) => s === 'stated_poster'));
    if (caption.length > 0 && poster.length > 0) {
      conflicts.push({ kept: caption.map((m) => m.key).join(','), dropped: poster.map((m) => m.key).join(','), reason: 'caption and poster state disjoint areas; both kept, review' });
    }
    return { members, conflicts, basis: members[0]?.sources[0] ?? 'stated', flags };
  }

  // 2. SCOPE GATE.
  if (input.geoScope === 'national' || input.geoScope === 'international') return { members: [], conflicts, basis: 'nationwide', flags };
  const mayLend = mayUseAccountLocation(input.account.type, input.account.status, input.account.reach ?? 'unknown');
  if (input.geoScope === 'online') {
    const reach = input.account.reach ?? 'unknown';
    const members = mayLend && (reach === 'local' || reach === 'regional') ? input.account.defaultAreaKeys.map((k) => memberFor(k, 'account', ix)) : [];
    return { members, conflicts, basis: members.length > 0 ? 'account' : 'none', flags };
  }

  // 3. IMPLICIT signals, in priority order: venue, account, hashtags.
  const accountMembers: TargetAreaMember[] = mayLend
    ? input.account.defaultAreaKeys.map((k) => memberFor(k, 'account', ix))
    : input.account.audienceAreaKeys.map((k) => memberFor(k, input.account.audienceFromBio ? 'account_bio' : 'account', ix));
  const hashtagMembers = input.hashtagKeys.map((k) => memberFor(k, 'hashtag', ix));
  const groups: Array<{ name: string; members: TargetAreaMember[] }> = [
    { name: 'venue', members: venueMembers('both') },
    { name: 'account', members: accountMembers },
    { name: 'hashtag', members: hashtagMembers },
  ].filter((g) => g.members.length > 0);

  let result: TargetAreaMember[] = [];
  for (const g of groups) {
    const usable = g.name === 'hashtag' && result.length > 0 ? g.members.filter((m) => !isCountryLevel(m, ix)) : g.members;
    if (usable.length === 0) continue;
    if (result.length === 0 || usable.some((m) => result.some((r) => nests(r, m, ix)))) {
      result = mergeMembers([...result, ...usable], ix);
    } else {
      conflicts.push({ kept: result.map((r) => r.key).join(','), dropped: usable.map((m) => m.key).join(','), reason: `${g.name} area is disjoint from the higher-priority signal; dropped, review` });
    }
  }
  if (result.length === 0) return { members: [], conflicts, basis: 'none', flags };
  const present = SOURCE_PRIORITY.filter((s) => result.some((m) => m.sources.includes(s)));
  return { members: result, conflicts, basis: present[0] ?? 'none', flags };
}

// ---- the ranking relation against a USER's set (best over both sets) ------------------------------------------------------
export type MatchRelation = 'same' | 'inside' | 'covers' | 'neighbour' | 'other';
const RELATION_ORDER: MatchRelation[] = ['same', 'inside', 'covers', 'neighbour', 'other'];

/**
 * The best relation between the event's set and the user's set (the user has a home, a work place, ...). `inside`: the event's member lies in
 * the user's area; `covers`: it contains the user's area; `neighbour`: a sibling under the same parent.
 */
export function bestRelation(eventMembers: readonly TargetAreaMember[], userKeys: readonly string[], ix: GazetteerIndex): MatchRelation {
  let best = RELATION_ORDER.length - 1;
  for (const m of eventMembers) {
    const mPath = pathOf(m, ix);
    for (const u of userKeys) {
      const uPath = ix.pathOf(u);
      let rel: MatchRelation = 'other';
      if (m.key === u) rel = 'same';
      else if (mPath.includes(u)) rel = 'inside';
      else if (uPath.includes(m.key)) rel = 'covers';
      else if (ix.byKey.get(m.key)?.parent && ix.byKey.get(m.key)?.parent === ix.byKey.get(u)?.parent) rel = 'neighbour';
      best = Math.min(best, RELATION_ORDER.indexOf(rel));
    }
  }
  return RELATION_ORDER[best];
}
