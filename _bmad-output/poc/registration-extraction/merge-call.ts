// POC: can the location-keywords call and the tier call be ONE text-only post-extraction call?
//   arm L: the production location-keywords call alone (prompt, schema and input shape copied from generate-location-keywords.ts)
//   arm M: one call that returns both parts: { locations: [...], options: [...] }  (the tier part is the per-event variant C of tier-call-event.ts)
// Input: private/sample.jsonl (captions) + private/sample-locations.jsonl (stored event and schedule locations of the same posts, read-only export).
// The tier baseline already exists (private/tier-call-runs-C.jsonl, private/tier-call-runs-event.jsonl); merge-analyze.mjs compares.
//   npx tsx merge-call.ts --arm L|M [--runs 1] [--only600] [--every 2] [--spacing 4200] [--out private/merge-runs.jsonl]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { AUDIENCES, KINDS, GENERAL } from './tier-options.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const arm = String(args.arm ?? 'M'), runs = Number(args.runs ?? 1), spacing = Number(args.spacing ?? 4200), every = Number(args.every ?? 1);
const OUT = args.out ?? 'private/merge-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
const NL = String.fromCharCode(10);

// ---- the production location prompt, copied (home country: ID)
const LOC_SYSTEM = 'For each item, give locationKeywords: 1 to 5 short place names that let someone find the location on a map, ordered from the MOST specific to the most general: ' +
  'first the place as named (venue, building, market, village), then its district, then its city or regency, then optionally the province. ' +
  'Use the location text first; when it does not state the wider area, you may take it from the event name, the hashtags or eventArea, but never invent a place those do not support. ' +
  'Each keyword is ONE place name, never a sentence, never a summary of several places (no "various locations", "berbagai lokasi"). ' +
  'Also give countryCode: the ISO 3166-1 alpha-2 code of the country the place is in. Most places are in the country with code "ID", but give the real country for a place elsewhere, and null when you cannot tell. ' +
  'Return every id.';
const LOC_ITEM = { type: 'OBJECT', properties: { id: { type: 'STRING' }, locationKeywords: { type: 'ARRAY', items: { type: 'STRING' } }, countryCode: { type: 'STRING', nullable: true } }, required: ['id', 'locationKeywords'] };

// ---- the per-event tier prompt of tier-call-event.ts, copied
const TIER_SYSTEM = `List every priced option a person can choose to attend or take part, exactly as the post states it. You are given the list of events of this post.
Return one entry per distinct option; return an empty list when the post states no price. A single price with no named option is still ONE entry (a later step decides what to do with it). Never compute, convert, round or invent a price, and never split one price into several options.
For each entry:
- event: the event this option belongs to, copied exactly from the list of events; GENERAL when the price covers the whole post or you cannot tell which event it belongs to.
- label: the option's name as written ("UMUM 5K", "Early bird", "VIP", "Mahasiswa"), at most 5 words; "Tiket" when the post names none.
- kind: CATEGORY when options differ by what you take part in (distance, class, seat class, package size); TIME_WINDOW when they differ by when you buy (early bird, presale, batch 1, regular, on the day); OTHER otherwise.
- audience: who may take this option. PUBLIC when the post puts no restriction on who can take it (this is the default); STUDENT (pelajar, mahasiswa, a named school or campus); CHILD (an age group under 18, "anak", "kids", a school grade); MEMBER (members, holders of a card, followers, a community); LOCAL_RESIDENT (a city, region or ID card of a place); GROUP (a team, group, pair or family price); OTHER when the post states a restriction that is none of these. Use OTHER, not PUBLIC, when you are unsure whether a restriction applies.
- conditions: a short copy of the condition stated for this option ("khusus pelajar", "KTP DIY", "minimal 10 orang", "wajib order di venue", "10 pendaftar pertama"), at most 80 characters; leave absent when none.
- price: only the amount as written, with its currency or unit ("Rp 200.000", "IDR 35K", "Gratis"), at most 20 characters and nothing after the amount (no words, no per-unit text: put "per team" in conditions); absent when the post gives no price for this option.
- opensOn and closesOn: YYYY-MM-DD, only when the post states the sales period of this option.
A discount or promotion is not an option: only a price someone actually pays. A fee for taking part (registration, entry, ticket, per team) is an option. Never write a phone number, email address or personal name into any field.`;
const MERGED_SYSTEM = `You read ONE social media post that announces one or more events, and return ONE JSON object with two independent parts.${NL}${NL}PART "locations" - the items listed under "Location items":${NL}${LOC_SYSTEM}${NL}${NL}PART "options" - the priced options of the post:${NL}${TIER_SYSTEM}${NL}${NL}The two parts do not depend on each other: a post may have locations and no options, or options and no locations. Return an empty list for a part that has nothing.`;

const sample = readFileSync('private/sample.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l));
const locRows = readFileSync('private/sample-locations.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l));
const inC = new Set(readFileSync('private/tier-call-runs-C.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => j.id));
const hashtagsOf = (t: string) => [...new Set((t.match(/#[\p{L}\p{N}_]+/gu) ?? []))].slice(0, 12);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

type Item = { id: string; caption: string; events: string[]; lines: { id: string; text: string }[]; locLines: string[] };
const items: Item[] = [];
for (const r of sample) {
  if (!inC.has(r.sampleId)) continue;
  const evs = locRows.filter((l) => l.post_id === r.post_id);
  if (!evs.length) continue;
  const entries = new Map<string, { text: string; event: string; area: string }>();
  for (const e of evs) {
    const sch = [...new Set<string>((e.schedules ?? []).map((s: any) => String(s.location ?? '').trim()).filter(Boolean))];
    for (const t of sch.length ? sch : [String(e.location ?? '').trim()].filter(Boolean)) { const k = norm(t); if (!entries.has(k)) entries.set(k, { text: t, event: e.event, area: String(e.location ?? '').trim() }); }
  }
  const sent = [...entries.values()].slice(0, 80);
  const tags = hashtagsOf(r.caption ?? '');
  items.push({ id: r.sampleId, caption: r.caption, events: [...new Set<string>(evs.map((e) => String(e.event)))], lines: sent.map((e, i) => ({ id: `s${i}`, text: e.text })),
    locLines: sent.map((e, i) => JSON.stringify({ id: `s${i}`, location: e.text, event: e.event, eventArea: e.area, hashtags: tags })) });
}
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.arm}|${j.id}|${j.run}`) : []);
console.log(`merge call arm ${arm}: ${items.length} posts (${items.filter((x) => x.locLines.length).length} with a location string), runs ${runs}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let run = 1; run <= runs; run++) {
  let idx = -1;
  for (const it of items) {
    idx++;
    if (run > 1 && idx % every !== 0) continue;
    if (done.has(`${arm}|${it.id}|${run}`)) continue;
    if (arm === 'L' && !it.locLines.length) continue;
    const locMax = Math.min(8192, 2048 + 200 * it.locLines.length);
    let req: any;
    if (arm === 'L') {
      req = { contents: it.locLines.join(NL), systemInstruction: LOC_SYSTEM, responseSchema: { type: 'ARRAY', items: LOC_ITEM }, responseMimeType: 'application/json', maxOutputTokens: locMax };
    } else {
      const OPT = { type: 'OBJECT', properties: { event: { type: 'STRING', enum: [...it.events, GENERAL] }, label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] }, conditions: { type: 'STRING' }, price: { type: 'STRING' }, opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' } }, required: ['event', 'label', 'kind', 'audience'] };
      const schema = { type: 'OBJECT', properties: { locations: { type: 'ARRAY', items: LOC_ITEM }, options: { type: 'ARRAY', items: OPT } }, required: ['locations', 'options'] };
      const body = `Post caption:${NL}"${it.caption}"${NL}${NL}Events of this post:${NL}${it.events.map((n, i) => `${i + 1}. ${n}`).join(NL)}${NL}${NL}Location items (one JSON per line):${NL}${it.locLines.join(NL) || '(none)'}`;
      req = { contents: body, systemInstruction: MERGED_SYSTEM, responseSchema: schema, responseMimeType: 'application/json', maxOutputTokens: locMax + 1500 };
    }
    for (let attempt = 1; ; attempt++) {
      try {
        const t0 = Date.now();
        if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
        const res = await callGeminiGenerateContent(key!, req as any);
        let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
        appendFileSync(OUT, JSON.stringify({ ok: true, arm, id: it.id, run, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsedOk: !!parsed, locStrings: it.locLines.length, events: it.events.length, result: parsed }) + NL);
        console.log(`${arm} ${run} ${it.id} ok strings=${it.locLines.length} ${res.finishReason}`);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
        if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
        appendFileSync(OUT, JSON.stringify({ ok: false, arm, id: it.id, run, error: msg.slice(0, 1500), daily }) + NL);
        console.log(`${it.id} FAILED ${msg.slice(0, 120)}`);
        if (daily) { console.log('stopping: quota'); process.exit(3); }
        break;
      }
    }
    await sleep(spacing);
  }
}
console.log('done');
