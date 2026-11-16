import test from 'node:test';
import * as assert from 'node:assert';
import { MIN_TOKENS_FOR_CONTAINMENT, venuePlaceTokens, venueTextsSamePlace } from './venue-text-match.js';

test('venuePlaceTokens', async (t) => {
  await t.test('lowercases, folds accents and splits on punctuation', () => {
    assert.deepStrictEqual([...venuePlaceTokens('  Saarlandhalle, Saarbrücken! ')], ['saarlandhalle', 'saarbrucken']);
  });

  await t.test('drops the words that say where inside a place, with the number that follows one', () => {
    assert.deepStrictEqual([...venuePlaceTokens('Atrium Rama, Ground Floor, Lantai 3, X Hall')], ['atrium', 'rama', 'x', 'hall']);
    assert.deepStrictEqual([...venuePlaceTokens('Atrium Rama, Lantai GF, X Hall')], ['atrium', 'rama', 'x', 'hall']);
    assert.deepStrictEqual([...venuePlaceTokens('Level 2 Food Court')], ['food', 'court']);
  });

  await t.test('keeps a number that is part of the place name, and a position word at the very end', () => {
    assert.deepStrictEqual([...venuePlaceTokens('Hall 3 Convention Centre')], ['hall', '3', 'convention', 'centre']);
    assert.deepStrictEqual([...venuePlaceTokens('Main Hall Floor')], ['main', 'hall']);
  });

  await t.test('spells out the common abbreviations and drops connectives', () => {
    assert.deepStrictEqual([...venuePlaceTokens('Lap. Danyang di Purwodadi')], ['lapangan', 'danyang', 'purwodadi']);
    assert.deepStrictEqual([...venuePlaceTokens('Gd. Serbaguna and the Annex of Jl Raya')], ['gedung', 'serbaguna', 'annex', 'jalan', 'raya']);
  });

  await t.test('ignores symbols such as a replacement character from a broken encoding', () => {
    assert.deepStrictEqual([...venuePlaceTokens('QUALI � Plaza Ambar')], ['quali', 'plaza', 'ambar']);
  });

  await t.test('is empty for nothing, whitespace or only position words', () => {
    assert.strictEqual(venuePlaceTokens(null).size, 0);
    assert.strictEqual(venuePlaceTokens(undefined).size, 0);
    assert.strictEqual(venuePlaceTokens('   ').size, 0);
    assert.strictEqual(venuePlaceTokens('Ground Floor').size, 0);
  });
});

test('venueTextsSamePlace', async (t) => {
  await t.test('floor wording does not make a second place', () => {
    assert.strictEqual(
      venueTextsSamePlace('Atrium Rama, Ground Floor, X Hall', 'Atrium Rama, Lantai GF, X Hall'),
      true
    );
    assert.strictEqual(venueTextsSamePlace('Food Court, Level 3, Y Mall', 'Food Court, Lantai 5, Y Mall'), true);
  });

  await t.test('an abbreviation and a typographic variant are one place', () => {
    assert.strictEqual(venueTextsSamePlace('Lapangan Danyang Purwodadi', 'Lap. Danyang, Purwodadi'), true);
    assert.strictEqual(venueTextsSamePlace('QUALI � Plaza Ambar, Lantai 3', 'QUALI, Lantai 3 Plaza Ambar'), true);
    assert.strictEqual(venueTextsSamePlace('Saarlandhalle Saarbrücken', 'saarlandhalle saarbrucken'), true);
  });

  await t.test('a sub-venue of a place named in full is the same place once three tokens agree', () => {
    assert.strictEqual(venueTextsSamePlace('Z Mall Jogja', 'Grand Atrium, Z Mall Jogja'), true);
    assert.strictEqual(venueTextsSamePlace('Ballroom X City Hall (SCH) Yogyakarta', 'Ballroom X City Hall, Yogyakarta'), true);
  });

  await t.test('two tokens inside a longer text are not enough: the extra word may be the distinctive one', () => {
    assert.ok(MIN_TOKENS_FOR_CONTAINMENT > 2);
    assert.strictEqual(venueTextsSamePlace('Mall Jogja', 'Pakuwon Mall Jogja'), false);
    assert.strictEqual(venueTextsSamePlace('Plaza Ambar', 'Plaza Ambar Annex'), false);
  });

  await t.test('different places stay different', () => {
    assert.strictEqual(venueTextsSamePlace('Tenth Avenue Bandung', 'BG Junction Surabaya'), false);
    assert.strictEqual(venueTextsSamePlace('Atrium Rama, X City Hall', 'Ballroom, X City Hall'), false);
    assert.strictEqual(venueTextsSamePlace('Hall 2 Convention Centre', 'Hall 3 Convention Centre'), false);
  });

  await t.test('a missing venue, or one with no place word left, is never the same place', () => {
    assert.strictEqual(venueTextsSamePlace(null, 'Atrium Rama, X City Hall'), false);
    assert.strictEqual(venueTextsSamePlace('Atrium Rama, X City Hall', undefined), false);
    assert.strictEqual(venueTextsSamePlace('', ''), false);
    assert.strictEqual(venueTextsSamePlace('Ground Floor', 'Lantai GF'), false);
  });

  await t.test('is symmetric', () => {
    const pairs: Array<[string, string]> = [
      ['Atrium Rama, Ground Floor, X Hall', 'Atrium Rama, Lantai GF, X Hall'],
      ['Z Mall Jogja', 'Grand Atrium, Z Mall Jogja'],
      ['Mall Jogja', 'Pakuwon Mall Jogja'],
    ];
    for (const [a, b] of pairs) assert.strictEqual(venueTextsSamePlace(a, b), venueTextsSamePlace(b, a));
  });
});
