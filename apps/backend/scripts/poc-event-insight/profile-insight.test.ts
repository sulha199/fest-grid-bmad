import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferCountryFromSignals } from './country-signals.js';
import {
  PROFILE_LABELS, SYNTHETIC_PROFILES, guardProfileInsight, isVerbatimEvidence, profilePromptContents, realProfiles, resolveCountry, scoreProfile, sourceText, validateProfileInsight,
  type ProfileInsight,
} from './profile-insight.js';

const all = () => [...realProfiles(), ...SYNTHETIC_PROFILES];
const ins = (over: Partial<ProfileInsight> = {}): ProfileInsight => ({ countryCode: 'UNKNOWN', countryEvidence: [], reach: 'unspecified', reachAreas: [], evidence: [], ...over });

test('corpus: every profile has a label and every label a profile; ids are unique', () => {
  const ids = all().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), Object.keys(PROFILE_LABELS).sort());
  assert.equal(realProfiles().length, 5);
  assert.ok(realProfiles().every((p) => p.captions.length > 0));
});

test('the prompt shows the model only what the subscribe-time scrape returns', () => {
  const p = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-kl-hall')!;
  const c = profilePromptContents(p);
  assert.ok(c.includes('Bio: "Official page of KL Convention Hall'));
  assert.ok(c.includes('Recent post captions:'));
});

test('validate: normalises case, rejects bad enums and malformed country codes', () => {
  const ok = validateProfileInsight({ countryCode: ' id ', countryEvidence: ['x'], reach: 'local', reachAreas: [{ name: 'Sleman', level: 'regency' }], evidence: [] });
  assert.equal(ok.ok, true); assert.equal(ok.value?.countryCode, 'ID');
  assert.equal(validateProfileInsight({ countryCode: 'Indonesia', countryEvidence: [], reach: 'local', reachAreas: [], evidence: [] }).ok, false);
  assert.equal(validateProfileInsight({ countryCode: 'ID', countryEvidence: [], reach: 'worldwide', reachAreas: [], evidence: [] }).ok, false);
  assert.equal(validateProfileInsight(null).ok, false);
  assert.equal(validateProfileInsight({ countryCode: 'UNKNOWN', countryEvidence: [], reach: 'unspecified', reachAreas: [], evidence: [] }).ok, true);
});

test('guard: a country without a verbatim quote becomes UNKNOWN; a quoted one survives', () => {
  const p = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-kl-hall')!;
  const dropped = guardProfileInsight(ins({ countryCode: 'MY', countryEvidence: ['Malaysia is where they are'] }), p);
  assert.equal(dropped.out.countryCode, 'UNKNOWN'); assert.equal(dropped.actions.length, 1);
  const kept = guardProfileInsight(ins({ countryCode: 'MY', countryEvidence: ['Open daily 10am-10pm MYT'] }), p);
  assert.equal(kept.out.countryCode, 'MY'); assert.deepEqual(kept.actions, []);
});

test('guard: reach areas only for local/regional, and only places the input names', () => {
  const p = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-telco-nasional')!;
  const national = guardProfileInsight(ins({ reach: 'national', reachAreas: [{ name: 'Jakarta Selatan', level: 'city' }] }), p);
  assert.deepEqual(national.out.reachAreas, [], 'a head-office city is not a reach area');
  const invented = guardProfileInsight(ins({ reach: 'local', reachAreas: [{ name: 'Bandung', level: 'city' }] }), p);
  assert.deepEqual(invented.out.reachAreas, []);
  const dinas = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-dinas-sleman')!;
  assert.equal(guardProfileInsight(ins({ reach: 'local', reachAreas: [{ name: 'Kabupaten Sleman', level: 'regency' }] }), dinas).out.reachAreas.length, 1);
});

test('guard does not mutate its input', () => {
  const p = SYNTHETIC_PROFILES[0];
  const input = ins({ countryCode: 'ID', countryEvidence: ['nothing like this'], reach: 'national', reachAreas: [{ name: 'Sleman', level: 'regency' }] });
  const before = JSON.stringify(input);
  guardProfileInsight(input, p);
  assert.equal(JSON.stringify(input), before);
});

test('resolveCountry: signals anchor; the model fills silence; disagreement is unresolved', () => {
  const idSignals = inferCountryFromSignals({ username: 'a', displayName: 'a', biography: 'Open 10-22 WIB', captions: [], locationNames: [] });
  const none = inferCountryFromSignals({ username: 'a', displayName: 'a', biography: 'hello', captions: [], locationNames: [] });
  assert.deepEqual(resolveCountry(idSignals, undefined), { status: 'resolved', country: 'ID', source: 'signals' });
  assert.deepEqual(resolveCountry(idSignals, ins({ countryCode: 'ID' })), { status: 'resolved', country: 'ID', source: 'signals+model' });
  assert.deepEqual(resolveCountry(idSignals, ins({ countryCode: 'MY' })), { status: 'unresolved', reason: 'conflict' });
  assert.deepEqual(resolveCountry(none, ins({ countryCode: 'MY' })), { status: 'resolved', country: 'MY', source: 'model' });
  assert.deepEqual(resolveCountry(none, ins()), { status: 'unresolved', reason: 'no-evidence' });
  assert.deepEqual(resolveCountry(none, undefined), { status: 'unresolved', reason: 'no-evidence' });
});

test('resolveCountry: a model country that contradicts weak signals for another country is not trusted', () => {
  const weakId = inferCountryFromSignals({ username: 'a', displayName: 'a', biography: 'Yoga in Canggu', captions: [], locationNames: [] });
  assert.equal(weakId.status, 'unresolved');
  assert.deepEqual(resolveCountry(weakId, ins({ countryCode: 'AU' })), { status: 'unresolved', reason: 'conflict' });
  assert.deepEqual(resolveCountry(weakId, ins({ countryCode: 'ID' })), { status: 'resolved', country: 'ID', source: 'model' });
});

test('scoreProfile: a wrong country is the harmful error; abstaining is a miss only where the label demands a country', () => {
  const kl = PROFILE_LABELS['syn-kl-hall'];
  assert.equal(scoreProfile('ID', 'local', [{ name: 'Kuala Lumpur' }], kl).countryWrong, true);
  assert.equal(scoreProfile('UNKNOWN', 'local', [{ name: 'Kuala Lumpur' }], kl).countryMissed, true);
  const warung = PROFILE_LABELS['syn-warung-tanpa-kota'];
  assert.equal(scoreProfile('UNKNOWN', 'unspecified', [], warung).pass, true);
  const none = PROFILE_LABELS['syn-global-coffee'];
  assert.equal(scoreProfile('ID', 'unspecified', [], none).countryWrong, true, 'inventing a country for a placeless brand');
  assert.equal(scoreProfile('UNKNOWN', 'unspecified', [], none).pass, true);
});

test('scoreProfile: a national account must not be given the head-office city; a local one must keep its place', () => {
  const telco = PROFILE_LABELS['syn-telco-nasional'];
  const leak = scoreProfile('ID', 'national', [{ name: 'Jakarta' }], telco);
  assert.equal(leak.areasOk, false); assert.equal(leak.nationalWithArea, true); assert.equal(leak.pass, false);
  assert.equal(scoreProfile('ID', 'national', [], telco).pass, true);
  const dinas = PROFILE_LABELS['syn-dinas-sleman'];
  assert.equal(scoreProfile('ID', 'local', [{ name: 'Kabupaten Sleman' }], dinas).pass, true);
  assert.equal(scoreProfile('ID', 'local', [], dinas).areasOk, false);
  assert.equal(scoreProfile('ID', 'national', [], dinas).reachOk, false, 'a local government labelled national');
});

test('deterministic signals on the corpus: what they resolve, what they leave to the model', () => {
  const by = Object.fromEntries(all().map((p) => [p.id, inferCountryFromSignals(p)]));
  const country = (id: string) => (by[id].status === 'resolved' ? (by[id] as { country: string }).country : null);
  // resolved from concrete markers
  assert.equal(country('plazaambarrukmo'), 'ID');
  assert.equal(country('syn-dinas-sleman'), 'ID');
  assert.equal(country('syn-kl-hall'), 'MY');
  assert.equal(country('syn-sg-makers'), 'SG');
  assert.equal(country('syn-melb-indo'), 'AU', 'the Indonesian-language Melbourne community');
  assert.equal(country('syn-delhi-academy'), 'IN');
  assert.equal(country('syn-johor-sukan'), 'MY', 'the Malay-language Johor complex');
  assert.equal(country('syn-canggu-yoga'), 'ID', 'the English-language Bali studio');
  // no concrete marker anywhere: left unresolved, never guessed
  assert.equal(country('syn-global-coffee'), null);
  assert.equal(country('syn-empty'), null);
  assert.equal(country('syn-warung-tanpa-kota'), null);
  for (const id of Object.keys(by)) {
    const label = PROFILE_LABELS[id];
    const c = country(id);
    if (c) assert.ok(label.country.includes(c), `${id}: signals say ${c}`);
  }
});

test('sourceText covers every field shown to the model', () => {
  const p = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-telco-nasional')!;
  const s = sourceText(p);
  for (const part of [p.username, p.displayName, p.biography, ...p.captions]) assert.ok(s.includes(part));
});

// ---- time zone (prompt v2) ----
import { inferZone, sameClock } from './timezone-signals.js';
import { profileInsightInstruction, profileInsightSchemaFor } from './profile-insight.js';

test('v2 schema and prompt add the time zone; v1 stays frozen', () => {
  assert.ok('timezone' in profileInsightSchemaFor('v2').properties);
  assert.ok(!('timezone' in profileInsightSchemaFor('v1').properties));
  assert.ok(profileInsightInstruction('v2').startsWith(profileInsightInstruction('v1').replace('Strictly follow the JSON schema.', '').trimEnd()));
  assert.match(profileInsightInstruction('v2'), /THE COUNTRY DOES NOT DETERMINE THE TIME ZONE/);
  assert.throws(() => profileInsightInstruction('v9'));
});

test('guard: a zone needs a valid IANA name, a verbatim quote, and a single-region account', () => {
  const p = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-canggu-yoga')!;
  const ok = guardProfileInsight(ins({ reach: 'local', timezone: 'Asia/Makassar', timezoneEvidence: ['Beach yoga every Thursday 6am WITA'] }), p);
  assert.equal(ok.out.timezone, 'Asia/Makassar'); assert.deepEqual(ok.actions, []);
  assert.equal(guardProfileInsight(ins({ reach: 'local', timezone: 'WITA', timezoneEvidence: ['6am WITA'] }), p).out.timezone, 'UNKNOWN', 'an abbreviation is not an IANA zone');
  assert.equal(guardProfileInsight(ins({ reach: 'local', timezone: 'Asia/Makassar', timezoneEvidence: ['they are in Bali'] }), p).out.timezone, 'UNKNOWN', 'no verbatim quote');
  assert.equal(guardProfileInsight(ins({ reach: 'national', timezone: 'Asia/Makassar', timezoneEvidence: ['6am WITA'] }), p).out.timezone, 'UNKNOWN', 'a national account has no single zone');
  assert.equal(guardProfileInsight(ins({ reach: 'local' }), p).out.timezone, undefined, 'a v1 record carries no zone and gets none');
});

test('scoreProfile: a wrong zone is harmful; multi-zone and placeless accounts are right to say UNKNOWN', () => {
  const canggu = PROFILE_LABELS['syn-canggu-yoga'];
  assert.equal(scoreProfile('ID', 'local', [{ name: 'Canggu' }], canggu, 'Asia/Jakarta').tzWrong, true, 'Bali is WITA, not WIB');
  assert.equal(scoreProfile('ID', 'local', [{ name: 'Canggu' }], canggu, 'Asia/Makassar').pass, true);
  assert.equal(scoreProfile('ID', 'local', [{ name: 'Canggu' }], canggu, 'UNKNOWN').tzMissed, true);
  const multi = PROFILE_LABELS['syn-java-bali-curator'];
  assert.equal(scoreProfile('ID', 'regional', [], multi, 'Asia/Jakarta').tzWrong, true, 'a default for a Java+Bali curator is wrong');
  assert.equal(scoreProfile('ID', 'regional', [], multi, 'UNKNOWN').pass, true);
  const warung = PROFILE_LABELS['syn-warung-tanpa-kota'];
  assert.equal(scoreProfile('UNKNOWN', 'unspecified', [], warung, 'Asia/Jakarta').tzWrong, true, 'language is not evidence of a zone');
  assert.equal(scoreProfile('UNKNOWN', 'unspecified', [], warung).tzWrong, false, 'not scored when the run reports no zone (v1)');
});

test('deterministic zone on the corpus: resolved zones are right, multi-zone and placeless accounts stay unresolved', () => {
  const all2 = [...realProfiles(), ...SYNTHETIC_PROFILES];
  let resolved = 0;
  for (const prof of all2) {
    const label = PROFILE_LABELS[prof.id];
    const country = inferCountryFromSignals(prof);
    const d = inferZone(prof, { country: country.status === 'resolved' ? country.country : undefined });
    if (d.status === 'resolved') {
      resolved++;
      assert.ok(label.tz!.accept.some((z) => sameClock(z, d.zone)), `${prof.id}: signals say ${d.zone}, label accepts ${label.tz!.accept.join('|') || 'none'}`);
    } else if (!label.tz!.abstainOk) {
      assert.fail(`${prof.id}: unresolved (${d.reason}) but the label demands ${label.tz!.accept.join('|')}`);
    }
  }
  assert.ok(resolved >= 10, `resolved ${resolved}`);
});

test('short evidence: a 2-3 letter time-zone abbreviation counts only as a whole, case-sensitive token of the source', () => {
  const src = 'Open hours: 10.00-22.00 WIB\nOfficial Instagram';
  assert.equal(isVerbatimEvidence('WIB', src), true);
  assert.equal(isVerbatimEvidence('wib', src), false, 'case-sensitive');
  assert.equal(isVerbatimEvidence('WI', src), false, 'a fragment of a longer token');
  assert.equal(isVerbatimEvidence('IB', src), false);
  assert.equal(isVerbatimEvidence('Open hours: 10.00-22.00 WIB', src), true, 'longer quotes keep the normal check');
  assert.equal(isVerbatimEvidence('MYT', src), false, 'not in the source');
  assert.equal(isVerbatimEvidence('1234', src), false);
});

test('guard: a zone whose only evidence is its abbreviation survives (the case a 4-character floor wrongly dropped)', () => {
  const p = SYNTHETIC_PROFILES.find((x) => x.id === 'syn-kl-hall')!;
  const g = guardProfileInsight(ins({ reach: 'local', countryCode: 'MY', countryEvidence: ['MYT'], timezone: 'Asia/Kuala_Lumpur', timezoneEvidence: ['MYT'] }), p);
  assert.equal(g.out.timezone, 'Asia/Kuala_Lumpur'); assert.equal(g.out.countryCode, 'MY'); assert.deepEqual(g.actions, []);
});
