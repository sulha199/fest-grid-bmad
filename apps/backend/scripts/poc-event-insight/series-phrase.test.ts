import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core, groupName, idfFrom, phraseScore, seriesNameScore, tokens, type Member } from './series-phrase.js';

const m = (name: string, place: string): Member => ({ name, place });
const BAR = 0.85; // uncalibrated start value (see the module comment); the cases below sit far from it on both sides
const score = (a: Member, b: Member) => seriesNameScore(a, b).score;

test('tokens: accents folded, punctuation and emoji dropped, "&" and "@" read as words', () => {
  assert.deepEqual(tokens('Café Fest ✨ 25% Off!'), ['cafe', 'fest', '25%', 'off']);
  assert.deepEqual(tokens('Wacoal @ Pakuwon & Co'), ['wacoal', 'at', 'pakuwon', 'and', 'co']);
});

// Real names and places from the 2026-10-19/20 production results (concurrent-multi-place, tier1, item 15 Wacoal rows).
test('real same-activity pairs at different places score at the top', () => {
  const wacoalPakuwon = m('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'House of Wacoal 2nd Floor, Pakuwon Mall Jogja');
  assert.equal(score(wacoalPakuwon, m('Wacoal 25% Off Promo', 'House of Wacoal 2nd Floor, Plaza Ambarrukmo')), 1);
  assert.equal(score(wacoalPakuwon, m('Wacoal 25% Off Promo', 'Lantai UG, Jogja City Mall')), 1);
  assert.equal(score(m('Sports Station Buy 1 Get 1 Free Promo', 'Lantai 1 Sleman City Hall'), m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station Lippo Plaza Jogja')), 1);
  assert.equal(score(m('Lomba Mata Pelajaran dan Mewarnai', 'Neo Solo Grand Mall'), m('Lomba Mata Pelajaran dan Mewarnai', 'Transmart Cirebon')), 1);
  assert.equal(score(m('J.CO ANNIVERSARY PROMO', 'J.CO Ground Floor Galeria Mall'), m('J.CO ANNIVERSARY PROMO', 'J.CO Plaza Ambarrukmo')), 1);
});

test('the place is removed wherever it sits in the name: after a dash, "@", "di", in brackets, at the start, in the middle (synthetic names)', () => {
  const kenes = 'Kenes Soho'; const mad = 'Mad Monkey';
  for (const [a, b] of [
    ['Wednesday Night Run - Kenes Soho', 'Wednesday Night Run - Mad Monkey'],
    ['Wednesday Night Run @ Kenes Soho', 'Wednesday Night Run @ Mad Monkey'],
    ['Wednesday Night Run di Kenes Soho', 'Wednesday Night Run di Mad Monkey'],
    ['Wednesday Night Run (Kenes Soho)', 'Wednesday Night Run (Mad Monkey)'],
    ['Kenes Soho Wednesday Night Run', 'Mad Monkey Wednesday Night Run'],
  ]) assert.ok(score(m(a, kenes), m(b, mad)) >= BAR, `${a} / ${b}`);
  assert.ok(score(m('Wacoal Pakuwon 25% Off Promo', 'Pakuwon Mall Jogja'), m('Wacoal Ambarrukmo 25% Off Promo', 'Plaza Ambarrukmo')) >= BAR);
});

test('the brand survives when the place text repeats it (the first version stripped "wacoal")', () => {
  assert.deepEqual(core('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'House of Wacoal 2nd Floor, Pakuwon Mall Jogja', 'Wacoal 25% Off Promo'), ['wacoal', '25%', 'off', 'promo']);
  assert.deepEqual(core('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station Lippo Plaza Jogja', 'Sports Station Buy 1 Get 1 Free Promo'), ['sports', 'station', 'buy', '1', 'get', '1', 'free', 'promo']);
});

test('wording shared by both names is not a place: "Jogja" stays in "Jogja Coffee Week"; a run is never removed if it would empty the name', () => {
  assert.deepEqual(core('Jogja Coffee Week', 'Jogja Expo Center', 'Jogja Coffee Week'), ['jogja', 'coffee', 'week']);
  assert.deepEqual(core('Pakuwon Mall Jogja', 'Pakuwon Mall Jogja', 'Plaza Ambarrukmo'), ['pakuwon', 'mall', 'jogja']);
});

test('real different activities score well below the bar', () => {
  const at = 'Atrium Rama';
  assert.ok(score(m('SCH Choir Competition 2026', at), m('SCH Halloween Dance Competition 2026', at)) < BAR);
  assert.ok(score(m('Line Dance Carnival', 'Atrium Shinta'), m('Zumba Anniversary', 'Atrium Shinta')) < BAR);
  assert.ok(score(m('Wacoal 25% Off Promo', 'Plaza Ambarrukmo'), m('J.CO ANNIVERSARY PROMO', 'Plaza Ambarrukmo')) < BAR);
  assert.ok(score(m('Wacoal 25% Off Promo', 'Plaza Ambarrukmo'), m('Sports Station Buy 1 Get 1 Free Promo', 'Plaza Ambarrukmo')) < BAR);
  assert.ok(score(m('Erafone Run 2026 Yogyakarta Series', 'Museum Gunungapi Merapi'), m('GembiRun Loka 2026', 'Gembira Loka Zoo')) < BAR);
  // rounds of one competition: the stage word differs
  assert.ok(score(m("Men's Singles Final", 'Denmark'), m("Men's Singles Quarterfinals", 'Egypt')) < BAR);
});

test('the highest-scoring real non-pair stays below the bar; same place is the matcher\'s job, not a series', () => {
  const s = score(m('Denmark Open 2026', 'Denmark'), m('Victor Denmark Open 2026', 'Denmark'));
  assert.ok(s < BAR && s > 0.7, `got ${s}`);
});

test('another edition or another discount is capped, however long the shared name (synthetic)', () => {
  assert.equal(score(m('SCH Choir Competition 2026', 'Atrium Rama'), m('SCH Choir Competition 2025', 'Atrium Rama')), 0.5);
  assert.equal(score(m('Jogja International Heritage Night Run 2026', 'Pakuwon Mall'), m('Jogja International Heritage Night Run 2025', 'Plaza Ambarrukmo')), 0.5);
  assert.equal(score(m('Wacoal 25% Off Promo', 'Plaza Ambarrukmo'), m('Wacoal 30% Off Promo', 'Pakuwon Mall Jogja')), 0.5);
});

test('word order matters: the same words in another order score low (synthetic)', () => {
  assert.ok(score(m('Promo Off 25% Wacoal', 'Plaza Ambarrukmo'), m('Wacoal 25% Off Promo', 'Pakuwon Mall Jogja')) < 0.4);
  assert.ok(phraseScore(['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a']) < 0.4);
});

test('a generic promo phrase shared by two brands is weaker when tokens are weighted by how rare they are (synthetic corpus)', () => {
  const sports = m('Sports Station Buy 1 Get 1 Free Promo', 'Plaza Ambarrukmo');
  const watsons = m('Watsons Buy 1 Get 1 Free Promo', 'Pakuwon Mall Jogja');
  const corpus = ['Sports Station Buy 1 Get 1 Free Promo', 'Watsons Buy 1 Get 1 Free Promo', 'Guardian Buy 1 Get 1 Free Promo', 'Eiger Buy 1 Get 1 Free Promo', 'J.CO ANNIVERSARY PROMO', 'Wacoal 25% Off Promo'];
  const plain = seriesNameScore(sports, watsons).score;
  const weighted = seriesNameScore(sports, watsons, idfFrom(corpus)).score;
  assert.ok(plain < BAR && weighted < plain, `plain ${plain}, weighted ${weighted}`);
});

test('KNOWN LIMITATION: a city that is part of the name but not of the place text is not removed ("Erafone Run 2026 Yogyakarta Series" / "... Bandung Series")', () => {
  // The fix is to feed the event's gazetteer area label (AD-39) in with the place text; until then this pair is missed, not mis-grouped.
  const s = score(m('Erafone Run 2026 Yogyakarta Series', 'Museum Gunungapi Merapi'), m('Erafone Run 2026 Bandung Series', 'Gedung Sate'));
  assert.ok(s < BAR, `got ${s}`);
});

test('group name: the shared words in the original spelling, the place removed wherever it sat (real and synthetic names)', () => {
  const wacoalPakuwon = m('Wacoal 25% Off Promo at Pakuwon Mall Jogja', 'House of Wacoal 2nd Floor, Pakuwon Mall Jogja');
  assert.equal(groupName(wacoalPakuwon, m('Wacoal 25% Off Promo', 'Lantai UG, Jogja City Mall')), 'Wacoal 25% Off Promo');
  assert.equal(groupName(m('Sports Station Buy 1 Get 1 Free Promo', 'Lantai 1 Sleman City Hall'), m('Sports Station Buy 1 Get 1 Free Promo', 'Sports Station Lippo Plaza Jogja')), 'Sports Station Buy 1 Get 1 Free Promo');
  assert.equal(groupName(m('J.CO ANNIVERSARY PROMO', 'J.CO Ground Floor Galeria Mall'), m('J.CO ANNIVERSARY PROMO', 'J.CO Plaza Ambarrukmo')), 'J.CO ANNIVERSARY PROMO', 'casing and punctuation are the poster\'s');
  assert.equal(groupName(m('Lomba Mata Pelajaran dan Mewarnai', 'Neo Solo Grand Mall'), m('Lomba Mata Pelajaran dan Mewarnai', 'Transmart Cirebon')), 'Lomba Mata Pelajaran dan Mewarnai', 'a connector between two kept words stays');
  assert.equal(groupName(m('Jogja Coffee Week', 'Jogja Expo Center'), m('Jogja Coffee Week', 'Plaza Ambarrukmo')), 'Jogja Coffee Week');
  for (const [a, b] of [
    ['Wednesday Night Run - Kenes Soho', 'Wednesday Night Run - Mad Monkey'],
    ['Wednesday Night Run @ Kenes Soho', 'Wednesday Night Run @ Mad Monkey'],
    ['Wednesday Night Run di Kenes Soho', 'Wednesday Night Run di Mad Monkey'],
    ['Wednesday Night Run (Kenes Soho)', 'Wednesday Night Run (Mad Monkey)'],
    ['Kenes Soho Wednesday Night Run', 'Mad Monkey Wednesday Night Run'],
  ]) assert.equal(groupName(m(a, 'Kenes Soho'), m(b, 'Mad Monkey')), 'Wednesday Night Run', `${a} / ${b}`);
});

test('group name: when one name has an extra word, the more general name wins; with nothing shared it is empty', () => {
  assert.equal(groupName(m('Wednesday Night Run', 'Kenes Soho'), m('Wednesday Night Run Special Edition', 'Mad Monkey')), 'Wednesday Night Run');
  assert.equal(groupName(m('Line Dance Carnival', 'Atrium Shinta'), m('Zumba Anniversary', 'Atrium Shinta')), '');
});

test('empty names score zero', () => {
  assert.equal(phraseScore([], ['a']), 0);
  assert.equal(score(m('', ''), m('A', '')), 0);
});
