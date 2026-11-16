import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_VENUE_EVENTS, canonicalKey, groupName, idfFrom, phraseScore, seriesNameScore, tokens, venueTestFrom, type Member } from './series-phrase.js';

const m = (name: string, place: string | null): Member => ({ name, place });
const BAR = 0.85; // start value of the link tier; uncalibrated (one in-sample snapshot)
const times = (n: number, s: string) => Array.from({ length: n }, () => s);

// Place texts of a pretend corpus. The counts mirror the 2026-10-20 export: malls and halls occur in 16 to 236 events' place text, store brands in
// 1 to 9 (Sports Station 9, Planet Sports 2). "Kenes Soho" and "Mad Monkey" are synthetic venues used by the synthetic name forms.
const PLACES = [
  ...times(40, 'Pakuwon Mall Jogja'), ...times(40, 'Plaza Ambarrukmo'), ...times(30, 'Sleman City Hall'), ...times(20, 'Jogja City Mall'), ...times(20, 'Galeria Mall'),
  ...times(20, 'Mall of Indonesia'), ...times(20, 'Kenes Soho'), ...times(20, 'Mad Monkey'),
  ...times(9, 'Sports Station, Pakuwon Mall Jogja'), ...times(2, 'Planet Sports Pakuwon Mall Jogja'), 'Minimal Store, Lantai 1 Galeria Mall',
];
const VENUES = venueTestFrom(PLACES);
const score = (a: Member, b: Member) => seriesNameScore(a, b, undefined, VENUES).score;
const key = (a: Member) => canonicalKey(a, VENUES);

test('tokens: accents folded on Latin letters only, punctuation and emoji dropped, "&" and "@" read as words, possessives joined', () => {
  assert.deepEqual(tokens('Café Fest ✨ 25% Off!'), ['cafe', 'fest', '25%', 'off']);
  assert.deepEqual(tokens('Wacoal @ Pakuwon & Co'), ['wacoal', 'at', 'pakuwon', 'and', 'co']);
  assert.deepEqual(tokens("Mother's Day"), ['mothers', 'day']);
  assert.equal(tokens('คอนเสิร์ต').length, 1, 'Thai combining marks are not separators');
  assert.equal(tokens('संगीत महोत्सव').length, 2, 'Devanagari words are not shredded');
  assert.deepEqual(tokens(null), []);
});

test('venueTestFrom: a phrase is a venue only when many distinct events have it in their place text', () => {
  assert.ok(VENUES(['pakuwon', 'mall', 'jogja']) && VENUES(['plaza', 'ambarrukmo']));
  assert.ok(!VENUES(['sports', 'station']) && !VENUES(['planet', 'sports']));
  assert.equal(MIN_VENUE_EVENTS, 15);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// COLLAPSE: canonicalKey

test('real branch promos get the SAME key at different malls (production names)', () => {
  const keys = new Set([
    key(m('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'House of Wacoal 2nd Floor, Pakuwon Mall Jogja')),
    key(m('Wacoal 25% Off Promo', 'House of Wacoal 2nd Floor, Plaza Ambarrukmo')),
    key(m('Wacoal 25% Off Promo', 'Lantai UG, Jogja City Mall')),
  ]);
  assert.deepEqual([...keys], ['wacoal 25% off promo']);
  assert.equal(new Set([
    key(m('Sports Station Buy 1 Get 1 Free Promo', 'Lantai 1, Sleman City Hall')),
    key(m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station, Pakuwon Mall Jogja')),
    key(m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station – Plaza Ambarrukmo')),
  ]).size, 1);
  assert.equal(key(m('J.CO ANNIVERSARY PROMO', 'J.CO, Plaza Ambarrukmo')), key(m('J.CO Anniversary Promo', 'J.CO, Ground Floor, Galeria Mall')));
});

test('different brands sharing a generic promo phrase get DIFFERENT keys, even when the place text repeats the store (the case that broke revision 2)', () => {
  const sportsStation = m('Buy 1 Get 1 Free Promo at Sports Station', 'Sports Station, 2nd Floor Galeria Mall');
  const planetSports = m('Buy 1 Get 1 Free Promo at Planet Sports', 'Planet Sports Pakuwon Mall Jogja');
  assert.equal(key(sportsStation), 'buy 1 get 1 free promo sports station');
  assert.equal(key(planetSports), 'buy 1 get 1 free promo planet sports');
  assert.notEqual(key(sportsStation), key(planetSports));
  assert.notEqual(key(m('Minimal Store Buy 1 Get 1 Free Promo', 'Minimal Store, Lantai 1 Galeria Mall')), key(m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station, Pakuwon Mall Jogja')));
});

test('what is never removed: a leading run, a bare number, the whole name; and without a venue test nothing is removed', () => {
  assert.equal(key(m('Kenes Soho Wednesday Night Run', 'Kenes Soho')), 'kenes soho wednesday night run');
  assert.equal(key(m('Jogja Coffee Week 6', 'Lantai 6 Jogja City Mall')), 'jogja coffee week 6');
  assert.equal(key(m('Pakuwon Mall Jogja', 'Pakuwon Mall Jogja')), 'pakuwon mall jogja');
  assert.equal(canonicalKey(m('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'Pakuwon Mall Jogja')), 'wacoal 25% off promo pakuwon mall jogja');
  assert.equal(key(m('Heritage Night Run 2025', 'Gedung 2025')), 'heritage night run 2025');
});

test('a trailing venue is removed after a dash, "@", "di", "at", in brackets, and in the middle after a connector (synthetic names)', () => {
  for (const name of ['Wednesday Night Run - Kenes Soho', 'Wednesday Night Run @ Kenes Soho', 'Wednesday Night Run di Kenes Soho', 'Wednesday Night Run at Kenes Soho', 'Wednesday Night Run (Kenes Soho)']) {
    assert.equal(key(m(name, 'Kenes Soho')), 'wednesday night run', name);
  }
  assert.equal(key(m('Night Run at Kenes Soho Edition', 'Kenes Soho')), 'night run edition');
});

test('a connector inside the place text does not stop the venue from matching ("Mall of Indonesia")', () => {
  assert.equal(key(m('Jogja Night Run at Mall of Indonesia', 'Mall of Indonesia')), 'jogja night run');
  assert.equal(key(m('Jogja Night Run at Mall of Indonesia', 'Mall of Indonesia')), key(m('Jogja Night Run - Kenes Soho', 'Kenes Soho')));
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// LINK: seriesNameScore

test('same-activity pairs at different places score 1.00 (production names)', () => {
  assert.equal(score(m('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'House of Wacoal 2nd Floor, Pakuwon Mall Jogja'), m('Wacoal 25% Off Promo', 'Lantai UG, Jogja City Mall')), 1);
  assert.equal(score(m('Lomba Mata Pelajaran dan Mewarnai', 'Neo Solo Grand Mall'), m('Lomba Mata Pelajaran dan Mewarnai', 'Transmart Cirebon')), 1);
  assert.equal(score(m('Gimbap Attack at Chadol Gujeolpan', 'Chadol Gujeolpan – Lantai GF, Plaza Ambarrukmo'), m('Gimbap Attack di Chadol Gujeolpan', 'Pakuwon Mall Jogja, Chadol Gujeolpan')), 1);
});

test('real different activities score well below the bar', () => {
  const at = 'Atrium Rama';
  assert.ok(score(m('SCH Choir Competition 2026', at), m('SCH Halloween Dance Competition 2026', at)) < BAR);
  assert.ok(score(m('Line Dance Carnival', 'Atrium Shinta'), m('Zumba Anniversary', 'Atrium Shinta')) < BAR);
  assert.ok(score(m('Wacoal 25% Off Promo', 'Plaza Ambarrukmo'), m('J.CO ANNIVERSARY PROMO', 'Plaza Ambarrukmo')) < BAR);
  assert.ok(score(m('Erafone Run 2026 Yogyakarta Series', 'Museum Gunungapi Merapi'), m('GembiRun Loka 2026', 'Gembira Loka Zoo')) < BAR);
  assert.ok(score(m("Men's Singles Final", 'Denmark'), m("Men's Singles Quarterfinals", 'Egypt')) < BAR);
});

test('guards: a differing number, a year as the only shared "word", one shared word, a possessive, a group letter', () => {
  assert.equal(score(m('SCH Choir Competition 2026', 'Atrium Rama'), m('SCH Choir Competition 2025', 'Atrium Rama')), 0.5);
  assert.equal(score(m('Wacoal 25% Off Promo', 'Plaza Ambarrukmo'), m('Wacoal 30% Off Promo', 'Pakuwon Mall Jogja')), 0.5);
  // a bare number in the place text is not a venue, so the edition number stays and the differing-number guard fires
  assert.equal(score(m('Jogja Coffee Week 6', 'Lantai 6 Jogja City Mall'), m('Jogja Coffee Week 7', 'Lantai 7 Pakuwon Mall')), 0.5);
  // the year is a number, not a shared word: "jazz" alone is not an activity
  assert.ok(score(m('Jazz at Plaza Ambarrukmo 2026', 'Plaza Ambarrukmo'), m('Jazz di Kebun 2026', 'Kebun Raya Bogor')) <= 0.5);
  assert.ok(score(m('Promo 50% Amplaz', 'Amplaz'), m('Promo 50% FitFlop', 'FitFlop, Pakuwon Mall Jogja')) <= 0.5);
  // "Mother's" and "Father's" no longer share an extra one-letter word
  assert.ok(score(m("Mother's Day Mega Sale Promo 2026", 'Pakuwon Mall Jogja'), m("Father's Day Mega Sale Promo 2026", 'Plaza Ambarrukmo')) < BAR);
  // "Group A" is kept, so A and no-letter differ
  assert.ok(score(m('Badminton Cup Group A Final', 'GOR X'), m('Badminton Cup Group Final', 'GOR Y')) < BAR);
});

test('word order matters: the same words in another order score low (synthetic)', () => {
  assert.ok(score(m('Promo Off 25% Wacoal', 'Plaza Ambarrukmo'), m('Wacoal 25% Off Promo', 'Pakuwon Mall Jogja')) < 0.4);
  assert.ok(phraseScore(['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a']) < 0.4);
});

test('with rarity weights, two brands sharing a generic promo phrase stay under the bar (production names as the corpus)', () => {
  const corpus = [
    'Minimal Store Buy 1 Get 1 Free Promo', 'Sports Station Buy 1 Get 1 Free Promo', 'Sports Station Buy 1 Get 1 Free Promo', 'Buy 1 Get 1 Free Promo at Planet Sports',
    'Buy 1 Get 1 Free Promo at Sports Station', 'SATURDAYS Buy 1 Get 1 Free Promo', 'LocknLock Buy 1 Get 1 Free Promo', 'Sports Direct Buy 1 Get 1 Free',
    'Wacoal 25% Off Promo', 'J.CO Anniversary Promo', 'Jazz at Plaza Ambarrukmo', 'Dance Phoria', 'Lomba Mata Pelajaran dan Mewarnai', 'Gimbap Attack at Chadol Gujeolpan',
    'Mid Season Sale at Sports Station', 'Beauty Class at Plaza Ambarrukmo', 'Sushi Go Crazy Monday',
  ];
  const w = idfFrom(corpus);
  const saturdays = m('SATURDAYS Buy 1 Get 1 Free Promo', 'SATURDAYS Pakuwon Mall Jogja');
  const planet = m('Buy 1 Get 1 Free Promo at Planet Sports', 'Planet Sports Pakuwon Mall Jogja');
  assert.ok(seriesNameScore(saturdays, planet, w, VENUES).score < BAR);
  assert.ok(seriesNameScore(m('Minimal Store Buy 1 Get 1 Free Promo', 'x'), m('Sports Station Buy 1 Get 1 Free Promo', 'y'), w, VENUES).score < BAR);
  assert.ok(seriesNameScore(m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station, Pakuwon Mall Jogja'), m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station – Plaza Ambarrukmo'), w, VENUES).score >= BAR);
});

test('idfFrom: an empty corpus gives weight 1 (no NaN); repeated names count once', () => {
  assert.equal(idfFrom([])('anything'), 1);
  assert.ok(Number.isFinite(seriesNameScore(m('A B', ''), m('A B', ''), idfFrom([])).score));
  const once = idfFrom(['Sports Station Promo', 'Planet Sports Promo']);
  const repeated = idfFrom(['Sports Station Promo', 'Sports Station Promo', 'Sports Station Promo', 'Planet Sports Promo']);
  assert.equal(once('station'), repeated('station'));
});

test('a missing place does not throw', () => {
  assert.equal(seriesNameScore(m('Online Quiz Night', null), m('Online Quiz Night', null)).score, 1);
  assert.equal(canonicalKey(m('Online Quiz Night', null), VENUES), 'online quiz night');
});

test('KNOWN LIMITATION: a city in the name but not in the place text is not removed ("Erafone Run 2026 Yogyakarta Series" / "... Bandung Series")', () => {
  assert.ok(score(m('Erafone Run 2026 Yogyakarta Series', 'Museum Gunungapi Merapi'), m('Erafone Run 2026 Bandung Series', 'Gedung Sate')) < BAR);
});

test('KNOWN LIMITATION: word order changes the key ("... at Sports Station" and "Sports Station ...")', () => {
  assert.notEqual(key(m('Buy 1 Get 1 Free Promo at Sports Station', 'Lantai 1, Sleman City Hall')), key(m('Sports Station Buy 1 Get 1 Free Promo', 'Lantai 1, Sleman City Hall')));
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Group name

test('group name: the shared words in the original spelling and casing, the venue removed wherever it sat', () => {
  assert.equal(groupName(m('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'House of Wacoal 2nd Floor, Pakuwon Mall Jogja'), m('Wacoal 25% Off Promo', 'Lantai UG, Jogja City Mall'), undefined, VENUES), 'Wacoal 25% Off Promo');
  assert.equal(groupName(m('J.CO ANNIVERSARY PROMO', 'J.CO Ground Floor Galeria Mall'), m('J.CO ANNIVERSARY PROMO', 'J.CO Plaza Ambarrukmo'), undefined, VENUES), 'J.CO ANNIVERSARY PROMO');
  assert.equal(groupName(m('Lomba Mata Pelajaran dan Mewarnai', 'Neo Solo Grand Mall'), m('Lomba Mata Pelajaran dan Mewarnai', 'Transmart Cirebon'), undefined, VENUES), 'Lomba Mata Pelajaran dan Mewarnai', 'a connector between two kept words stays');
  for (const [a, b] of [
    ['Wednesday Night Run - Kenes Soho', 'Wednesday Night Run - Mad Monkey'],
    ['Wednesday Night Run @ Kenes Soho', 'Wednesday Night Run @ Mad Monkey'],
    ['Wednesday Night Run di Kenes Soho', 'Wednesday Night Run di Mad Monkey'],
    ['Wednesday Night Run (Kenes Soho)', 'Wednesday Night Run (Mad Monkey)'],
    ['Wednesday Night Run@Kenes Soho', 'Wednesday Night Run@Mad Monkey'], // no space before the separator: the word "Run" must survive
  ]) assert.equal(groupName(m(a, 'Kenes Soho'), m(b, 'Mad Monkey'), undefined, VENUES), 'Wednesday Night Run', `${a} / ${b}`);
});

test('group name: a connector left behind by a mid-name venue is removed; the more general name wins; nothing shared gives empty', () => {
  assert.equal(groupName(m('Night Run at Kenes Soho Edition', 'Kenes Soho'), m('Night Run at Mad Monkey Edition', 'Mad Monkey'), undefined, VENUES), 'Night Run Edition');
  assert.equal(groupName(m('Wednesday Night Run', 'Kenes Soho'), m('Wednesday Night Run Special Edition', 'Mad Monkey'), undefined, VENUES), 'Wednesday Night Run');
  assert.equal(groupName(m('Line Dance Carnival', 'Atrium Shinta'), m('Zumba Anniversary', 'Atrium Shinta'), undefined, VENUES), '');
});

test('empty names score zero', () => {
  assert.equal(phraseScore([], ['a']), 0);
  assert.equal(score(m('', ''), m('A', '')), 0);
});
