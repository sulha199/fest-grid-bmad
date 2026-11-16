import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, removeQualifiers, segments, venueSegment, variantsOf, withCity, requestPlan } from './probe-geocode-compound.js';

test('floors, levels, rooms and counters are removed; the venue stays', () => {
  assert.equal(removeQualifiers('Watsons, Ground Floor Galeria Mall'), 'Watsons, Galeria Mall');
  assert.equal(removeQualifiers('Sky Commons, Lantai 3A, Plaza Ambarrukmo'), 'Sky Commons, Plaza Ambarrukmo');
  assert.equal(removeQualifiers('TKP JOGJA Lantai 2, Pakuwon Mall Jogja'), 'TKP JOGJA, Pakuwon Mall Jogja');
  assert.equal(removeQualifiers('Atrium Lower Ground, Galeria Mall'), 'Galeria Mall');
  assert.equal(removeQualifiers('Customer Service, Ground Floor, Sleman City Hall'), 'Sleman City Hall');
  assert.equal(removeQualifiers('Spiral Deck Zona D, GIK UGM'), 'Spiral Deck, GIK UGM');
  assert.equal(removeQualifiers('Convention Hall Lt.2'), 'Convention Hall');
  assert.equal(removeQualifiers('Sleman City Hall'), 'Sleman City Hall');
  assert.equal(removeQualifiers('Atrium & Plaza Rama, Sleman City Hall'), 'Plaza Rama, Sleman City Hall'); // no stray connector left behind
});

test('segments split on commas and on a dash with spaces, not on a hyphen inside a word', () => {
  assert.deepEqual(segments('Sushi Go – Plaza Ambarrukmo, Lantai 3'), ['Sushi Go', 'Plaza Ambarrukmo', 'Lantai 3']);
  assert.deepEqual(segments('Kemayoran - Jakarta'), ['Kemayoran', 'Jakarta']);
  assert.deepEqual(segments('Jl. Magelang-Yogya'), ['Jl. Magelang-Yogya']);
});

test('the venue segment is the last one that reads as a venue', () => {
  assert.equal(venueSegment('Atrium & Plaza Rama, Sleman City Hall'), 'Sleman City Hall');
  assert.equal(venueSegment('Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang'), 'Sleman City Hall');
  assert.equal(venueSegment('Sushi Go – Plaza Ambarrukmo, Lantai 3'), 'Plaza Ambarrukmo');
  assert.equal(venueSegment('Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta'), 'Open Space JIExpo dan Gambir Expo');
  assert.equal(venueSegment('Watsons, Ground Floor Galeria Mall'), 'Galeria Mall');
  assert.equal(venueSegment('Spiral Deck Zona D, GIK UGM'), 'GIK UGM');
  assert.equal(venueSegment('Online'), 'Online');
});

test('the city is added once, and only when the text does not already name it', () => {
  assert.equal(withCity('Sleman City Hall', 'Sleman'), 'Sleman City Hall');
  assert.equal(withCity('Galeria Mall', 'Yogyakarta'), 'Galeria Mall, Yogyakarta');
  assert.equal(withCity('Galeria Mall'), 'Galeria Mall');
});

test('every labelled case has a city; the plan asks each distinct query once per strategy', () => {
  assert.ok(CASES.filter((c) => c.expectCountry === 'id').every((c) => Boolean(c.city)));
  assert.equal(variantsOf(CASES[0]).length, 4);
  const plan = requestPlan();
  assert.equal(new Set(plan.map((r) => `${r.strategy}|${r.query}`)).size, plan.length);
  assert.ok(plan.length > 0 && plan.length <= CASES.length * 8);
});
