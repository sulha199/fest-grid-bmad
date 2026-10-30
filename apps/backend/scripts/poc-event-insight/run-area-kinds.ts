/**
 * Manual POC (live Gemini, never touches the DB): can the model report the KIND of an area, the qualifier ("dan sekitarnya", "bagian selatan") and the
 * administrative units a region covers — and can it tell whether a place in a roundup HEADING is a coverage claim, an audience claim or just a name?
 *
 * Probe A: 18 short posts with one hard audience phrase each (aggregates, islands, "Raya" regions, qualifiers, lists, district level, country-wide).
 * Probe B: 8 roundup headings with three items each, where the heading's place may be coverage ("Agenda Jogja"), a brand ("Java Jazz"), a club
 *          ("Bali United"), an audience that differs from the place ("Wisata Jogja untuk warga Jakarta"), or absent — and an item may sit outside
 *          the heading's area (it must not leak into the heading's areas).
 *
 * Gold labels are mine (general knowledge); membership is graded only where I am confident (Jabodetabek, Java, Kartamantul, DIY + Jawa Tengah).
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<placeholder> SYSTEM_GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/run-area-kinds.ts [--runs 2] [--out report.md] [--raw raw.json] [--only id1,id2]
 */
import { writeFileSync } from 'node:fs';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { buildIndex, normalizeAreaName, resolveAreas, SAMPLE_GAZETTEER } from './area-resolver.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = parseInt(arg('runs', '2') as string, 10);
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite') as string;
const KEY = process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ix = buildIndex(SAMPLE_GAZETTEER);

const KINDS = ['admin_unit', 'metro_area', 'island', 'region', 'country', 'continent'] as const;
const QUALIFIERS = ['only', 'and_surroundings', 'part_of'] as const;
type Kind = (typeof KINDS)[number]; type Qualifier = (typeof QUALIFIERS)[number];

const schemaA = {
  type: 'OBJECT',
  properties: {
    geoScope: { type: 'STRING', enum: ['venue_local', 'city', 'region', 'national', 'international', 'online', 'unspecified'] },
    areas: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      name: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, qualifier: { type: 'STRING', enum: [...QUALIFIERS] },
      level: { type: 'STRING', enum: ['district', 'regency', 'province', 'country', 'continent', 'none'] },
      coveredUnits: { type: 'ARRAY', items: { type: 'STRING' } },
    }, required: ['name', 'kind', 'qualifier', 'level', 'coveredUnits'] } },
  },
  required: ['geoScope', 'areas'],
};
const instructionA = `You read ONE social media post and report where its AUDIENCE is (the people it is for), not where it is held. For each audience area the post states:
- name: the place as written.
- kind: admin_unit (a province, regency/city, district), metro_area (a named urban agglomeration such as a "...Raya" area or an acronym of cities), island, region (a multi-province or cross-border grouping such as "Indonesia Timur"), country, continent.
- qualifier: only (the place itself), and_surroundings ("dan sekitarnya", "and surroundings"), part_of (a stated part such as "bagian selatan", "northern").
- level: for admin_unit only: district, regency (kabupaten or kota), province; otherwise none (country and continent use their own value).
- coveredUnits: the administrative units this area covers, as official names, best effort. For a province or a city give just that one. If you do not know, give [].
If the post states no audience area, return an empty list. Do not use the venue or the account name as an audience.`;

interface GoldA { id: string; text: string; kinds: Kind[]; qualifier: Qualifier; members?: string[]; note: string }
const A: GoldA[] = [
  { id: 'jabodetabek', text: 'Pendaftaran lomba lari 10K dibuka untuk warga Jabodetabek! Start di GBK.', kinds: ['metro_area'], qualifier: 'only', members: ['id-jk', 'id-jb-bogor-kota', 'id-jb-bogor', 'id-jb-depok', 'id-jb-bekasi-kota', 'id-jb-bekasi', 'id-bt-tangerang-kota', 'id-bt-tangerang', 'id-bt-tangsel'], note: 'aggregate across 3 provinces' },
  { id: 'pulau-jawa', text: 'Kompetisi robotik, peserta dari seluruh Pulau Jawa boleh ikut. Final di Bandung.', kinds: ['island'], qualifier: 'only', members: ['id-jk', 'id-jb', 'id-bt', 'id-jt', 'id-yo', 'id-ji'], note: 'island = 6 provinces' },
  { id: 'jogja-sekitarnya', text: 'Bazar UMKM untuk warga Jogja dan sekitarnya, Sabtu ini di Alun-alun Kidul.', kinds: ['admin_unit'], qualifier: 'and_surroundings', note: 'qualifier' },
  { id: 'solo-raya', text: 'Festival kuliner Solo Raya, terbuka untuk warga Solo Raya.', kinds: ['metro_area'], qualifier: 'only', note: 'Raya = metro area' },
  { id: 'malang-raya', text: 'Konser amal untuk masyarakat Malang Raya di Stadion Gajayana.', kinds: ['metro_area'], qualifier: 'only', note: 'Raya = metro area' },
  { id: 'kartamantul', text: 'Pelatihan gratis untuk warga Kartamantul, daftar lewat link di bio.', kinds: ['metro_area'], qualifier: 'only', members: ['id-yo-yogyakarta', 'id-yo-sleman', 'id-yo-bantul'], note: 'acronym metro area' },
  { id: 'diy-jateng', text: 'Beasiswa untuk mahasiswa se-DIY dan Jawa Tengah.', kinds: ['admin_unit'], qualifier: 'only', members: ['id-yo', 'id-jt'], note: 'two provinces' },
  { id: 'bali-lombok', text: 'Workshop yoga untuk komunitas di Bali dan Lombok.', kinds: ['admin_unit', 'island'], qualifier: 'only', note: 'province + island' },
  { id: 'indonesia-timur', text: 'Pelatihan wirausaha khusus pelaku usaha dari Indonesia Timur.', kinds: ['region'], qualifier: 'only', note: 'region' },
  { id: 'asia-tenggara', text: 'Konferensi pemuda se-Asia Tenggara, hybrid.', kinds: ['region'], qualifier: 'only', note: 'cross-border region' },
  { id: 'seluruh-indonesia', text: 'Lomba cipta lagu terbuka untuk seluruh Indonesia, final di Jakarta.', kinds: ['country'], qualifier: 'only', note: 'country' },
  { id: 'kota-batu', text: 'Pasar malam untuk warga Kota Batu.', kinds: ['admin_unit'], qualifier: 'only', note: 'city' },
  { id: 'kecamatan', text: 'Senam bersama warga Kecamatan Depok, Kabupaten Sleman, Minggu pagi.', kinds: ['admin_unit'], qualifier: 'only', note: 'district level' },
  { id: 'jawa-selatan', text: 'Kegiatan tanam pohon untuk warga Jawa bagian selatan.', kinds: ['island'], qualifier: 'part_of', note: 'part of an island' },
  { id: 'pantura', text: 'Bantuan sembako untuk warga Pantura yang terdampak banjir.', kinds: ['region'], qualifier: 'only', note: 'informal region' },
  { id: 'bandung-raya', text: 'Pameran seni untuk warga Bandung Raya, gratis.', kinds: ['metro_area'], qualifier: 'only', note: 'Raya' },
  { id: 'jogja-bare', text: 'Nonton bareng timnas untuk warga Yogyakarta.', kinds: ['admin_unit'], qualifier: 'only', note: 'ambiguous: city or province' },
  { id: 'gerbangkertosusila', text: 'Seminar kewirausahaan untuk warga Gerbangkertosusila.', kinds: ['metro_area'], qualifier: 'only', note: 'acronym metro area' },
];

const ROLES = ['events_located_in', 'audience', 'brand_or_name', 'other'] as const;
const schemaB = { type: 'OBJECT', properties: { headingAreas: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, role: { type: 'STRING', enum: [...ROLES] } }, required: ['name', 'role'] } } }, required: ['headingAreas'] };
const instructionB = `You read a roundup post: a HEADING followed by several items. Report only the places that appear IN THE HEADING (the first line), and for each say its role:
- events_located_in: the heading says the listed events happen in / are about that place ("Agenda Jogja", "Event di Bandung").
- audience: the heading says who the events are for ("untuk warga Jakarta").
- brand_or_name: the place is part of a proper name, brand, club or festival title ("Java Jazz", "Bali United").
- other.
Do NOT report places that appear only in the items. If the heading names no place, return an empty list.`;

interface GoldB { id: string; text: string; gold: Array<{ name: string; role: (typeof ROLES)[number] }>; note: string }
const items = (a: string, b: string, c: string) => `\n1. ${a}\n2. ${b}\n3. ${c}`;
const B: GoldB[] = [
  { id: 'agenda-jogja', text: `Agenda Jogja Minggu Ini${items('Pameran lukisan, Taman Budaya, Sabtu', 'Konser indie, Sleman, Minggu', 'Bazar buku, Kota Gede, Sabtu')}`, gold: [{ name: 'Jogja', role: 'events_located_in' }], note: 'coverage' },
  { id: 'event-bandung', text: `Event Weekend di Bandung${items('Festival kopi, Dago', 'Jazz night, Braga', 'Pasar seni, Lembang')}`, gold: [{ name: 'Bandung', role: 'events_located_in' }], note: 'coverage' },
  { id: 'java-jazz', text: `Highlight Java Jazz Festival 2026${items('Hari 1: panggung utama, JIExpo Kemayoran', 'Hari 2: panggung akustik', 'Hari 3: closing')}`, gold: [{ name: 'Java', role: 'brand_or_name' }], note: 'brand: must not become Java the island' },
  { id: 'bali-united', text: `Bali United vs Persib Bandung: jadwal dan tiket${items('Kick-off Sabtu, Stadion Kapten I Wayan Dipta', 'Tiket presale dibuka Kamis', 'Nobar di Denpasar')}`, gold: [{ name: 'Bali', role: 'brand_or_name' }, { name: 'Bandung', role: 'brand_or_name' }], note: 'club names' },
  { id: 'wisata-jogja-jakarta', text: `Wisata Jogja untuk warga Jakarta${items('Paket Borobudur, Magelang', 'Tur Malioboro, Yogyakarta', 'Wisata Gunung Merapi, Sleman')}`, gold: [{ name: 'Jogja', role: 'events_located_in' }, { name: 'Jakarta', role: 'audience' }], note: 'place of events differs from audience' },
  { id: 'no-place', text: `Weekend Event Roundup${items('Pameran foto, Surabaya', 'Konser, Jakarta', 'Bazar, Yogyakarta')}`, gold: [], note: 'no place in the heading; items in three cities must not leak' },
  { id: 'jabodetabek-konser', text: `Jadwal Konser Jabodetabek Oktober${items('Konser A, Jakarta', 'Konser B, Bekasi', 'Konser C, Bandung')}`, gold: [{ name: 'Jabodetabek', role: 'events_located_in' }], note: 'aggregate heading; item 3 sits outside it' },
  { id: 'online-national', text: `Webinar Nasional Bulan Ini${items('Webinar AI, Zoom', 'Webinar UMKM, Zoom', 'Webinar karier, YouTube Live')}`, gold: [], note: 'national/online, no place' },
];

async function call(contents: string, systemInstruction: string, responseSchema: object): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      process.env.GEMINI_MODEL = MODEL;
      const text = (await callGeminiGenerateContent(KEY as string, { contents, systemInstruction, responseSchema, responseMimeType: 'application/json', maxOutputTokens: 2048 })).text;
      return JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 5) { await sleep((e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000); continue; }
      throw e;
    }
  }
}

interface ModelAreaA { name: string; kind: Kind; qualifier: Qualifier; level: string; coveredUnits: string[] }
const unitKeys = (units: string[]) => {
  const keys = new Set<string>(); let unresolved = 0;
  for (const u of units) for (const r of resolveAreas(u, ix, 'all')) { if (r.ok) r.area.keys.forEach((k) => keys.add(k)); else unresolved++; }
  return { keys, unresolved };
};

async function main() {
  const only = arg('only')?.split(',');
  if (only) { for (const list of [A, B] as Array<Array<{ id: string }>>) for (let i = list.length - 1; i >= 0; i--) if (!only.includes(list[i].id)) list.splice(i, 1); }
  if (!KEY) throw new Error('No Gemini key in GEMINI_API_KEY / SYSTEM_GEMINI_API_KEY');
  type Job = { probe: 'A' | 'B'; idx: number; run: number };
  const jobs: Job[] = [...A.flatMap((_, idx) => Array.from({ length: RUNS }, (__, i) => ({ probe: 'A' as const, idx, run: i + 1 }))), ...B.flatMap((_, idx) => Array.from({ length: RUNS }, (__, i) => ({ probe: 'B' as const, idx, run: i + 1 })))];
  const results = new Map<string, unknown>();
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++]; const key = `${j.probe}${j.idx}-${j.run}`;
      try {
        results.set(key, j.probe === 'A' ? await call(`Post:\n"""\n${A[j.idx].text}\n"""`, instructionA, schemaA) : await call(`Roundup post:\n"""\n${B[j.idx].text}\n"""`, instructionB, schemaB));
        process.stdout.write('.');
      } catch (e) { results.set(key, { error: String((e as Error).message).slice(0, 160) }); process.stdout.write('x'); }
    }
  }));
  console.log();

  const lines: string[] = [`# Area kinds, qualifiers, coverage and heading roles — ${MODEL}, ${RUNS} runs per case (A: ${A.length} posts, B: ${B.length} roundups)`, '',
    'Gold labels are mine; membership graded only for Jabodetabek, Java, Kartamantul, DIY + Jawa Tengah. Small, hand-written, one labeller.', '', '## A. Audience phrases', '',
    '| case | gold kind | gold qualifier | model kind (runs) | model qualifier (runs) | members (recall / extras / unresolved) |', '|---|---|---|---|---|---|'];
  let kindOk = 0, qualOk = 0, total = 0, memberRuns = 0, memberRecall = 0, usable = 0;
  for (let idx = 0; idx < A.length; idx++) {
    const g = A[idx]; const kinds: string[] = []; const quals: string[] = []; const mem: string[] = [];
    for (let run = 1; run <= RUNS; run++) {
      const r = results.get(`A${idx}-${run}`) as { areas?: ModelAreaA[]; error?: string } | undefined;
      if (!r?.areas) { kinds.push('ERR'); quals.push('ERR'); continue; }
      usable++; total++;
      const k = r.areas.map((a) => a.kind); const q = r.areas.map((a) => a.qualifier);
      kinds.push(k.join('+') || '—'); quals.push(q.join('+') || '—');
      const gotKinds = g.kinds.every((gk) => k.includes(gk));
      if (gotKinds) kindOk++;
      const wantQ = g.qualifier;
      if (wantQ === 'only' ? q.every((x) => x === 'only') : q.includes(wantQ)) qualOk++;
      if (g.members) {
        const { keys, unresolved } = unitKeys(r.areas.flatMap((a) => a.coveredUnits));
        const hit = g.members.filter((m) => keys.has(m)).length;
        const extras = [...keys].filter((x) => !g.members!.includes(x)).length;
        memberRuns++; memberRecall += hit / g.members.length;
        mem.push(`${hit}/${g.members.length} / +${extras} / ${unresolved}`);
      }
    }
    lines.push(`| ${g.id} (${g.note}) | ${g.kinds.join('+')} | ${g.qualifier} | ${kinds.join(' ; ')} | ${quals.join(' ; ')} | ${mem.join(' ; ') || '—'} |`);
  }
  lines.push('', `- kind right (every gold kind present): ${kindOk}/${total} runs`, `- qualifier right: ${qualOk}/${total} runs`, `- membership recall where graded: ${memberRuns ? (memberRecall / memberRuns * 100).toFixed(0) + '%' : 'n/a'} over ${memberRuns} runs`);

  lines.push('', '## B. Places in a roundup heading', '', '| case | gold | model (runs) | verdict (runs) |', '|---|---|---|---|');
  let bOk = 0, bTotal = 0, leaks = 0;
  for (let idx = 0; idx < B.length; idx++) {
    const g = B[idx]; const shown: string[] = []; const verdicts: string[] = [];
    for (let run = 1; run <= RUNS; run++) {
      const r = results.get(`B${idx}-${run}`) as { headingAreas?: Array<{ name: string; role: string }>; error?: string } | undefined;
      if (!r?.headingAreas) { shown.push('ERR'); verdicts.push('ERR'); continue; }
      bTotal++;
      shown.push(r.headingAreas.map((a) => `${a.name}:${a.role}`).join(', ') || '—');
      const gotAll = g.gold.every((x) => r.headingAreas!.some((a) => normalizeAreaName(a.name).includes(normalizeAreaName(x.name)) || normalizeAreaName(x.name).includes(normalizeAreaName(a.name)) ? a.role === x.role : false));
      const extra = r.headingAreas.filter((a) => !g.gold.some((x) => normalizeAreaName(a.name).includes(normalizeAreaName(x.name)) || normalizeAreaName(x.name).includes(normalizeAreaName(a.name))));
      if (extra.length) leaks++;
      const ok = gotAll && extra.length === 0;
      if (ok) bOk++;
      verdicts.push(ok ? 'right' : `${gotAll ? '' : 'missed/wrong role'}${extra.length ? ` extra: ${extra.map((a) => a.name).join(',')}` : ''}`.trim());
    }
    lines.push(`| ${g.id} (${g.note}) | ${g.gold.map((x) => `${x.name}:${x.role}`).join(', ') || 'none'} | ${shown.join(' ; ')} | ${verdicts.join(' ; ')} |`);
  }
  lines.push('', `- heading read fully right: ${bOk}/${bTotal} runs; runs with a place the gold does not list (a leak from the items or an extra): ${leaks}/${bTotal}`);
  if (arg('raw')) writeFileSync(arg('raw') as string, JSON.stringify(Object.fromEntries(results), null, 1));
  console.log(lines.join('\n'));
  if (arg('out')) writeFileSync(arg('out') as string, lines.join('\n') + '\n');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
