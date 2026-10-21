import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toLabelled, scoreRules, renderTable } from './score-pin-trust-labels.js';

const CSV = [
  'pin_box,confidence_band,match_class,stratum_population,stratum_sampled,row_ref,schedule_location_text,pin_address,pin_city,pin_country,confidence,match_type,label',
  'inside,1.00,full_match,100,2,aaaa1111,"Plaza, ""Atrium""","Yogyakarta, Indonesia",Yogyakarta,id,1.00,full_match,Y',
  'inside,1.00,full_match,100,2,aaaa2222,Kampus,Somewhere,Sleman,id,1.00,full_match,C',
  'inside,0.25-0.49,other,40,2,bbbb1111,Hall,Jakarta,Jakarta,id,0.30,match_by_street,N',
  'inside,0.25-0.49,other,40,2,bbbb2222,Hall 2,Yogyakarta,Yogyakarta,id,0.40,match_by_street,Y',
  'outside,0.00,full_match,10,2,cccc1111,Sleman City Hall,Texas,,us,0.00,full_match,N',
  'outside,0.00,full_match,10,2,cccc2222,Somewhere,Texas,,us,0.00,full_match,?',
  'outside,none,other,5,1,dddd1111,Online,Montpellier,,fr,,,N',
].join('\r\n');

test('the CSV reader handles quotes, doubled quotes, CRLF and empty fields', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].schedule_location_text, 'Plaza, "Atrium"');
  assert.equal(rows[6].confidence, '');
});

test('unlabelled and "?" rows are left out and counted; weights come from the stratum', () => {
  const { pins, skipped } = toLabelled(parseCsv(CSV));
  assert.equal(skipped, 1);
  assert.equal(pins.length, 6);
  assert.equal(pins[0].weight, 50);
  assert.equal(pins[2].weight, 20);
  assert.equal(pins[5].confidence, null);
});

test('a higher floor trusts fewer pins and is more precise; dropping full_match readmits the match_by_street pins', () => {
  const { pins } = toLabelled(parseCsv(CSV));
  const at = (floor: number, fm: boolean) => scoreRules(pins).find((s) => s.floor === floor && s.requireFullMatch === fm)!;
  const today = at(0.5, true);
  // trusted: the two 1.00 full_match pins (Y weight 50, C weight 50), plus the 0.00 ones are below the floor
  assert.equal(today.trustedWeight, 100);
  assert.equal(today.strictPrecision, 0.5);
  assert.equal(today.lenientPrecision, 1);
  assert.equal(at(0.3, false).trustedWeight, 100 + 20 + 20);
  assert.ok((at(0.3, false).keptY ?? 0) > (at(0.5, true).keptY ?? 1) - 1e-9);
  assert.equal(at(0.9, true).trustedWeight, 100);
});

test('a rule that trusts nothing reports n/a, and the table marks today\'s rule', () => {
  const { pins } = toLabelled(parseCsv(CSV.replace(/1\.00,full_match,Y/, '0.10,full_match,Y').replace(/1\.00,full_match,C/, '0.10,full_match,C')));
  const s = scoreRules(pins).find((r) => r.floor === 0.9 && r.requireFullMatch)!;
  assert.equal(s.strictPrecision, null);
  assert.match(renderTable(scoreRules(pins), 1, pins.length), /0\.50 \| yes \(today\)/);
});
