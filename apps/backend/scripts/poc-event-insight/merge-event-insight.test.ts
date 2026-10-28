import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MERGED_INTERESTS, mergeEventInsight, trackKey, type InsightPart } from './merge-event-insight.js';
import type { AudienceInsight } from './audience-insight.js';

const ins = (over: Partial<AudienceInsight> = {}): AudienceInsight => ({
  isEvent: true, postLanguage: 'id', geoScope: 'city', eligibility: 'unspecified', tracks: [], costTier: 'unspecified', sensitiveTopic: 'none',
  interests: [], evidence: [], ...over,
});
const part = (postId: string, rank: InsightPart['rank'], insight: Partial<AudienceInsight>, primary = false): InsightPart => ({ postId, rank, primary, insight: ins(insight) });

// A fictional shape of the real Erafone Run family (backlog IDEA-111): a race post and one post per category by the organizer, plus a curator repost.
const erafone = (): InsightPart[] => [
  part('main', 'organizer', { tracks: [{}], costTier: 'medium', interests: ['running', 'music'] }, true),
  part('post5k', 'organizer', { tracks: [{ label: '5K', ageMin: 12 }], costTier: 'medium', interests: ['running'] }),
  part('post10k', 'organizer', { tracks: [{ label: '10 km', ageMin: 17 }], costTier: 'high', interests: ['running', 'fitness'] }),
  part('repost', 'curator', { tracks: [], costTier: 'free', interests: ['festival'] }),
];

test('trackKey: distance and spacing variants are one track', () => {
  assert.equal(trackKey('5K'), '5k');
  assert.equal(trackKey('5 km'), '5k');
  assert.equal(trackKey('10KM'), '10k');
  assert.equal(trackKey('Kids Dash'), trackKey('kids-dash'));
  assert.equal(trackKey(undefined), '');
  assert.notEqual(trackKey('5K'), trackKey('10K'));
});

test('category siblings: the tracks of every organizer post survive, unlabelled single tier dropped (personalization Revision 10)', () => {
  const m = mergeEventInsight(erafone());
  assert.deepEqual(m.tracks.map((t) => [t.label, t.ageMin]), [['5K', 12], ['10 km', 17]]);
  assert.deepEqual(m.tracks[0].fromPosts, ['post5k']);
  assert.deepEqual(m.countedPosts, ['main', 'post5k', 'post10k'], 'the curator repost is not counted when organizer posts exist');
  assert.equal(m.costTier, 'medium', 'the cheapest tier an organizer post states; the curator\'s "free" does not lower it');
  assert.deepEqual(m.interests, ['running', 'music', 'fitness']);
});

test('the result does not depend on the order the posts arrive in', () => {
  const a = mergeEventInsight(erafone());
  const b = mergeEventInsight([...erafone()].reverse());
  assert.deepEqual(b.tracks.map((t) => t.label).sort(), a.tracks.map((t) => t.label).sort());
  assert.equal(b.costTier, a.costTier);
  assert.deepEqual([...b.interests].sort(), [...a.interests].sort());
});

test('an event with only curator posts counts them; an unlabelled single tier is kept when nothing labelled exists', () => {
  const m = mergeEventInsight([part('c1', 'curator', { tracks: [{}], costTier: 'low' }, true), part('c2', 'curator', { costTier: 'free' })]);
  assert.deepEqual(m.countedPosts, ['c1', 'c2']);
  assert.equal(m.tracks.length, 1);
  assert.equal(m.tracks[0].label, undefined);
  assert.equal(m.costTier, 'free');
});

test('a disagreement keeps the primary post\'s value and is reported', () => {
  const m = mergeEventInsight([
    part('main', 'organizer', { tracks: [{ label: '5K', ageMin: 12 }] }, true),
    part('late', 'organizer', { tracks: [{ label: '5 km', ageMin: 13, ageMax: 60 }] }),
  ]);
  assert.equal(m.tracks.length, 1);
  assert.equal(m.tracks[0].ageMin, 12);
  assert.equal(m.tracks[0].ageMax, 60, 'a value the primary post lacks is filled from the other post');
  assert.equal(m.conflicts.length, 1);
  assert.match(m.conflicts[0], /ageMin: 12 kept, 13 from post late ignored/);
});

test('sensitive topic: any post wins, curators included; eligibility: restricted from a counted post wins, a curator\'s does not', () => {
  const m = mergeEventInsight([
    part('main', 'organizer', { eligibility: 'open_to_public' }, true),
    part('repost', 'curator', { eligibility: 'restricted', sensitiveTopic: 'religion' }),
  ]);
  assert.equal(m.sensitiveTopic, 'religion');
  assert.equal(m.eligibility, 'open_to_public');
  const r = mergeEventInsight([part('main', 'organizer', { eligibility: 'open_to_public' }, true), part('second', 'organizer', { eligibility: 'restricted' })]);
  assert.equal(r.eligibility, 'restricted');
  const two = mergeEventInsight([part('a', 'organizer', { sensitiveTopic: 'religion' }), part('b', 'curator', { sensitiveTopic: 'politics_civic' })]);
  assert.equal(two.sensitiveTopic, 'religion');
  assert.match(two.conflicts[0], /sensitive topics disagree/);
});

test('interests are capped; stated areas are a union that keeps every source post', () => {
  const many = mergeEventInsight([part('a', 'organizer', { interests: ['a', 'b', 'c', 'd'] }, true), part('b', 'organizer', { interests: ['e', 'f', 'g', 'h'] })]);
  assert.equal(many.interests.length, MAX_MERGED_INTERESTS);
  const area = (name: string, level = 'province') => ({ name, level, source: 'stated', qualifier: 'none', role: 'both', quote: 'x' });
  const m = mergeEventInsight([
    part('a', 'organizer', { targetAreas: [area('DIY')] }, true),
    part('b', 'organizer', { targetAreas: [area('diy'), area('Jawa Tengah')] }),
  ]);
  assert.deepEqual(m.targetAreas.map((a) => [a.name, a.fromPosts]), [['DIY', ['a', 'b']], ['Jawa Tengah', ['b']]]);
  assert.equal('quote' in m.targetAreas[0], false, 'a quote is third-party text and is not carried');
});

test('no posts gives a neutral result and never throws', () => {
  const m = mergeEventInsight([]);
  assert.deepEqual(m, { countedPosts: [], tracks: [], costTier: 'unspecified', eligibility: 'unspecified', sensitiveTopic: 'none', interests: [], targetAreas: [], conflicts: [] });
});

test('a report post (IDEA-106) adds nothing to the event; an announcement or a mixed post does', () => {
  const m = mergeEventInsight([
    part('main', 'organizer', { postKind: 'announcement', tracks: [{ label: '5K' }], costTier: 'medium' }, true),
    part('results', 'organizer', { postKind: 'report', tracks: [{ label: 'Elite' }], costTier: 'free', sensitiveTopic: 'health_condition' }),
    part('next', 'organizer', { postKind: 'mixed', tracks: [{ label: '10K' }] }),
  ]);
  assert.deepEqual(m.tracks.map((t) => t.label), ['5K', '10K']);
  assert.equal(m.costTier, 'medium');
  assert.equal(m.sensitiveTopic, 'none', 'the report is not read at all');
  assert.deepEqual(m.countedPosts, ['main', 'next']);
});
