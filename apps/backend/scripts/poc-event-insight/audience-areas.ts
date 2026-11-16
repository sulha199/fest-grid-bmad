/**
 * POC: extracting the AUDIENCE's area — where an event is FOR — as opposed to where it is held.
 *
 * Requested ordering (2026-10-18): sort by the target audience's location, not the event's. The
 * extraction is therefore the load-bearing part, and it has to survive cases where the two differ:
 *   - a national competition held at a Yogyakarta campus (audience: all of Indonesia),
 *   - a concert in Jakarta with a bus for Surabaya residents (audience: Surabaya),
 *   - a Zoom class "for students in DIY" (no venue at all),
 *   - a tour (a different audience per stop), an overseas community event, a plain mall promotion,
 *   - a post that names no place, from an account whose NAME contains a city.
 *
 * The model reports what the post says; the fallbacks (venue geocode, account location) are code
 * (`location-policy.ts`) because they depend on the account type and on geocoder trust, which the
 * model cannot know.
 */
import { AREA_ALIASES } from './score.js';
import type { AreaLevel, GeoScope } from './insight-schema.js';
import { AREA_LEVELS, GEO_SCOPES } from './insight-schema.js';

export const AREA_BASIS = ['stated', 'venue'] as const;
export type AreaBasis = (typeof AREA_BASIS)[number];

export interface AudienceArea { name: string; level: AreaLevel; basis: AreaBasis; scheduleLabel?: string }
export interface AudienceAreas { geoScope: GeoScope; areas: AudienceArea[]; evidence: string[] }

export const audienceAreasSchema = {
  type: 'OBJECT',
  properties: {
    geoScope: { type: 'STRING', enum: [...GEO_SCOPES] },
    areas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          level: { type: 'STRING', enum: [...AREA_LEVELS] },
          basis: { type: 'STRING', enum: [...AREA_BASIS] },
          scheduleLabel: { type: 'STRING' },
        },
        required: ['name', 'level', 'basis'],
      },
    },
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['geoScope', 'areas', 'evidence'],
};

export const AUDIENCE_AREAS_INSTRUCTION_V1 = `You are an analyst for an event-discovery app. Given the text of one social media post, report WHERE THE EVENT'S AUDIENCE IS -- the people it is for -- NOT merely where the event is held. The post may be Indonesian, English or mixed; answer in English enums.

- geoScope: venue_local = people around the venue's neighbourhood; city = one city or regency; region = one or more named areas (a province, several cities, "se-DIY & Jawa Tengah"); national = the post says people from anywhere in the country may take part ("seluruh Indonesia", "nasional"); international = several countries or a continent; online = remote attendance open to people regardless of location; unspecified = the post gives no basis. A competition or conference that merely takes place on a local campus or hotel is still national if the post invites the whole country.
- areas: the places the audience is in.
  * basis "stated": the post says who the event is for, open to, aimed at or invited from -- "se-Kabupaten Bantul", "warga Surabaya", "untuk komunitas di Victoria", "mahasiswa se-DIY", "Jabodetabek". For a multi-stop event (a tour, several days in several cities) list each stop's city as "stated" with scheduleLabel set to the stop.
  * basis "venue": ONLY when the post states no audience area at all and is an ordinary local event -- then give the locality (city, regency or district) of the venue the post names. Never the venue's name, never an area taken from where performers, artists, brands or sellers come from, and never an area taken from the account's name or username.
  * If any "stated" area exists, add NO "venue" areas.
  * If geoScope is national or international, add NO "venue" areas.
  * If geoScope is online and the post states no area, areas is empty.
  * If the post gives neither a stated audience nor a venue locality, areas is empty. Do not guess.
- name: the place as written in the post (or its common name); level: neighbourhood, city, regency, province, country or continent.
- evidence: up to 5 short VERBATIM snippets (at most 100 characters each) from the post supporting the scope and the areas.
Strictly follow the JSON schema.`;

// v2 = v1 + clarifications aimed at the failure families v1 showed on the first 20 posts: "open to the
// public" or a national-sounding venue name read as a nationwide audience, a post with no place read as
// national, and a bare neighbourhood name as the venue locality. Written after reading those misses, so
// the 20 posts are tuned-on; HOLDOUT_AREA_POSTS below were written and labelled before v2 was ever run.
export const AUDIENCE_AREAS_INSTRUCTION_V2 = `${AUDIENCE_AREAS_INSTRUCTION_V1}

CLARIFICATIONS (these take precedence):
- "Open to the public" (terbuka untuk umum, dibuka untuk umum, open to all, gratis, free entry) says who may ATTEND; it says nothing about how far away they live. It never makes geoScope national.
- geoScope national needs wording that invites the whole country ("seluruh Indonesia", "se-Indonesia", "tingkat nasional", "nationwide", "peserta dari berbagai kota/provinsi"). A national-sounding place name (Galeri Nasional, Museum Nasional, Taman Nasional) is just a venue. A post that names no place and no audience (only "daftar lewat link di bio") has geoScope unspecified, not national.
- For a basis "venue" area always name the CITY or REGENCY, e.g. "Kotabaru, Kota Yogyakarta" -- never a bare neighbourhood name, which may exist in many places.`;

export const AUDIENCE_AREAS_INSTRUCTIONS: Record<string, string> = { v1: AUDIENCE_AREAS_INSTRUCTION_V1, v2: AUDIENCE_AREAS_INSTRUCTION_V2 };

// ---- labels ---------------------------------------------------------------------------------
export interface AreaExpect { aliases: string[]; basis: AreaBasis[] }
export interface AreaLabel {
  geoScope: GeoScope[];
  expect: AreaExpect[];       // each must be hit by an area whose name matches an alias AND whose basis is accepted
  forbid?: string[];          // alias keys that must not appear in ANY area (any basis)
  noAreas?: boolean;          // areas must be empty
  account?: string;           // account name passed to the model, as production does
}
export interface AreaPost { id: string; caption: string; note: string; label: AreaLabel; account?: string }

const BOTH: AreaBasis[] = ['stated', 'venue'];

// Existing posts re-used (captions from corpus.ts). Marked * where the post was already seen failing
// in the first study — the prompt below was written after reading those, so they are tuned-on cases.
export const EXISTING_AREA_LABELS: Record<string, AreaLabel> = {
  'cald-conference': { geoScope: ['international'], expect: [{ aliases: ['asia'], basis: ['stated'] }], forbid: ['yogyakarta', 'sleman'] }, // *
  'futsal-mfc': { geoScope: ['region'], expect: [{ aliases: ['yogyakarta'], basis: ['stated'] }, { aliases: ['central_java'], basis: ['stated'] }] },
  'syn-pameran-origin': { geoScope: ['city', 'venue_local'], expect: [{ aliases: ['jakarta'], basis: BOTH }], forbid: ['yogyakarta'] },
  'syn-webinar-nasional': { geoScope: ['online', 'national'], expect: [], forbid: ['yogyakarta', 'jakarta'] },
  'ho-layang-layang': { geoScope: ['region', 'national'], expect: [{ aliases: ['bali'], basis: ['stated'] }], forbid: [] },
  'uss-market': { geoScope: ['city', 'venue_local', 'region'], expect: [{ aliases: ['yogyakarta'], basis: BOTH }] },
  'syn-expat-bali': { geoScope: ['city', 'venue_local', 'region'], expect: [{ aliases: ['bali', 'canggu'], basis: BOTH }], forbid: ['yogyakarta', 'jakarta'] },
  'lomba-mewarnai': { geoScope: ['region', 'city'], expect: [{ aliases: ['yogyakarta', 'sleman'], basis: BOTH }] },
};

export const NEW_AREA_POSTS: AreaPost[] = [
  {
    id: 'ar-nasional-ugm', note: 'national competition HELD at a Yogyakarta campus — audience is the whole country',
    caption: `KOMPETISI KARYA TULIS NASIONAL 2026 🏆
Diselenggarakan oleh BEM Fakultas Ekonomi Universitas Gadjah Mada, Yogyakarta.
Terbuka untuk mahasiswa dari seluruh Indonesia.
Final & awarding night: 12 Desember 2026, Grha Sabha Pramana UGM.`,
    label: { geoScope: ['national'], expect: [], forbid: ['yogyakarta', 'sleman'] },
  },
  {
    id: 'ar-bus-surabaya', note: 'venue in Jakarta, audience in Surabaya',
    caption: `NONTON BARENG DI SENAYAN 🚌
Berangkat bareng warga Surabaya & Sidoarjo ke Jakarta! Bus gratis dari Terminal Bungurasih, khusus warga Surabaya dan Sidoarjo.
Acara utama: konser di Istora Senayan, Jakarta, 20 Desember 2026.`,
    label: { geoScope: ['region', 'city'], expect: [{ aliases: ['surabaya', 'sidoarjo'], basis: ['stated'] }], forbid: ['jakarta'] },
  },
  {
    id: 'ar-guru-bantul', note: 'audience is one regency, venue is in the city next door',
    caption: `PELATIHAN GURU SE-KABUPATEN BANTUL 📚
Bertempat di Hotel Mercure, Jl. Malioboro, Kota Yogyakarta.
Hanya untuk guru SD/SMP di wilayah Kabupaten Bantul. Sabtu, 28 November 2026.`,
    label: { geoScope: ['city', 'region'], expect: [{ aliases: ['bantul'], basis: ['stated'] }] },
  },
  {
    id: 'ar-zoom-diy', note: 'online, but for a named region',
    caption: `WEBINAR GRATIS 💻 "Persiapan Beasiswa Luar Negeri"
Khusus mahasiswa se-DIY. Sabtu, 28 November 2026, pukul 13.00 WIB via Zoom.`,
    label: { geoScope: ['online', 'region'], expect: [{ aliases: ['yogyakarta'], basis: ['stated'] }] },
  },
  {
    id: 'ar-zoom-global', note: 'online, open to the world',
    caption: `Free worldwide webinar on Zoom: Intro to Data Science.
Open to everyone, any country. Sat 5 Dec 2026, 20:00 UTC.`,
    label: { geoScope: ['online', 'international'], expect: [], noAreas: true },
  },
  {
    id: 'ar-tour', note: 'a tour: a different audience per stop',
    caption: `TUR KONSER NUSANTARA 🎤
5 Des — Jakarta, Istora Senayan
6 Des — Bandung, Sabuga ITB
8 Des — Yogyakarta, Stadion Kridosono`,
    label: { geoScope: ['national', 'region', 'city'], expect: [{ aliases: ['jakarta'], basis: BOTH }, { aliases: ['bandung'], basis: BOTH }, { aliases: ['yogyakarta'], basis: BOTH }] },
  },
  {
    id: 'ar-melbourne', note: 'a foreign audience — must not be forced into Indonesia',
    caption: `INDONESIAN NIGHT MELBOURNE 🇮🇩
For the Indonesian community in Victoria. Sat 21 Nov 2026, Federation Square, Melbourne.`,
    label: { geoScope: ['city', 'region'], expect: [{ aliases: ['melbourne'], basis: BOTH }], forbid: ['jakarta', 'yogyakarta'] },
  },
  {
    id: 'ar-no-area-curator', note: 'names no place; the ACCOUNT NAME contains a city',
    caption: `LOMBA FOTOGRAFI 📸 Tema: Senja.
Hadiah total 10 juta rupiah. Pendaftaran dibuka sampai 30 November 2026 melalui link di bio.`,
    account: 'infoeventjogja',
    label: { geoScope: ['unspecified', 'online'], expect: [], noAreas: true, forbid: ['yogyakarta'], account: 'infoeventjogja' },
  },
  {
    id: 'ar-kotabaru', note: 'plain local event named by neighbourhood',
    caption: `BAZAR KOTABARU 🛍️
Minggu, 22 November 2026, Jl. Suroto & Jl. Faridan M. Noto, Kotabaru, Gondokusuman.`,
    label: { geoScope: ['venue_local', 'city'], expect: [{ aliases: ['yogyakarta'], basis: ['venue'] }] },
  },
  {
    id: 'ar-kulonprogo', note: 'stated regency',
    caption: `FESTIVAL PETANI SE-KULON PROGO 🌾
Untuk seluruh petani & kelompok tani se-Kabupaten Kulon Progo. Lapangan Bendungan Sermo, 6 Desember 2026.`,
    label: { geoScope: ['city', 'region'], expect: [{ aliases: ['kulon_progo'], basis: ['stated'] }] },
  },
  {
    id: 'ar-jabodetabek', note: 'a metro-area acronym',
    caption: `KOPDAR KOMUNITAS SEPEDA 🚴
Terbuka untuk warga Jabodetabek. Minggu, 29 November 2026, Car Free Day Sudirman.`,
    label: { geoScope: ['region', 'city'], expect: [{ aliases: ['jakarta'], basis: ['stated'] }] },
  },
  {
    id: 'ar-hybrid-jateng', note: 'hybrid: stated region, venue in another province',
    caption: `SEMINAR KEWIRAUSAHAAN UNTUK UMKM SE-JAWA TENGAH
Tatap muka di Gedung Grhatama Pustaka, Yogyakarta, dan live via Zoom.
Sabtu, 5 Desember 2026.`,
    label: { geoScope: ['region'], expect: [{ aliases: ['central_java'], basis: ['stated'] }] },
  },
];

// Written and labelled BEFORE prompt v2 was run on them. Do not edit these labels after a run.
export const HOLDOUT_AREA_POSTS: AreaPost[] = [
  {
    id: 'hd-catur-nasional', note: 'national chess championship held in a Surabaya hotel',
    caption: `KEJUARAAN CATUR TINGKAT NASIONAL 2026 ♟️
Terbuka untuk umum dan pecatur dari seluruh Indonesia. Pendaftaran online.
Pelaksanaan: 12–14 Desember 2026, Hotel Majapahit, Surabaya.`,
    label: { geoScope: ['national'], expect: [], forbid: ['surabaya'] },
  },
  {
    id: 'hd-pameran-umum', note: 'TRAP: free, open to the public, a local gallery — must not become national',
    caption: `PAMERAN FOTO "WAJAH KOTA" 📷
Gratis, terbuka untuk umum. 3–10 Desember 2026, pukul 10.00–20.00 WIB.
Taman Budaya Yogyakarta.`,
    label: { geoScope: ['city', 'venue_local'], expect: [{ aliases: ['yogyakarta'], basis: BOTH }] },
  },
  {
    id: 'hd-prawirotaman', note: 'neighbourhood-level venue',
    caption: `FESTIVAL KULINER PRAWIROTAMAN 🍜
Sabtu–Minggu, 5–6 Desember 2026. Jl. Prawirotaman, Brontokusuman, Mergangsan.
Puluhan tenant kuliner, live music, dan bazar kerajinan.`,
    label: { geoScope: ['venue_local', 'city'], expect: [{ aliases: ['yogyakarta'], basis: ['venue'] }] },
  },
  {
    id: 'hd-layang-bantul', note: 'stated regency, beach venue',
    caption: `LOMBA LAYANG-LAYANG SE-BANTUL 🪁
Terbuka untuk seluruh warga Kabupaten Bantul. Minggu, 6 Desember 2026, Pantai Samas.`,
    label: { geoScope: ['city', 'region'], expect: [{ aliases: ['bantul'], basis: ['stated'] }] },
  },
  {
    id: 'hd-no-place-curator', note: 'TRAP: no place, no audience, city in the account name',
    caption: `INFO LOMBA MENULIS CERPEN ✍️
Tema bebas, maksimal 1.500 kata. Deadline 15 Desember 2026. Daftar lewat link di bio.`,
    account: 'jogjaevent.id',
    label: { geoScope: ['unspecified', 'online'], expect: [], noAreas: true, forbid: ['yogyakarta'], account: 'jogjaevent.id' },
  },
  {
    id: 'hd-olimpiade-nasional', note: 'nationwide wording, final in Bandung',
    caption: `OLIMPIADE SAINS NASIONAL SMA 2026 🔬
Pendaftaran terbuka untuk seluruh siswa SMA di Indonesia. Babak final: 18 Januari 2027, ITB, Bandung.`,
    label: { geoScope: ['national'], expect: [], forbid: ['bandung'] },
  },
];

// ---- scoring --------------------------------------------------------------------------------
const norm = (s: string) => s.normalize('NFKC').toLowerCase();
function hits(name: string, key: string): boolean {
  const aliases = AREA_ALIASES[key] ?? [key];
  const n = norm(name);
  return aliases.some((a) => new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(n));
}

export interface AreaScore {
  scope: boolean;
  expectationsMet: number;
  expectationsTotal: number;
  forbiddenHit: string[];
  // the failure the discussion is about: a venue-derived area on an event the post opens to the whole nation/world
  venueAreaOnNationwide: boolean;
  // venue areas added although the post STATED an audience area
  venueWithStated: boolean;
  // a "stated" area whose place never appears in the post text (invented audience)
  ungroundedStated: string[];
  pass: boolean;
  detail: string[];
}

export function scoreAreas(out: AudienceAreas, label: AreaLabel, source: string): AreaScore {
  const detail: string[] = [];
  const scope = label.geoScope.includes(out.geoScope);
  if (!scope) detail.push(`scope=${out.geoScope}, accept ${label.geoScope.join('|')}`);
  let met = 0;
  for (const e of label.expect) {
    const ok = out.areas.some((a) => e.basis.includes(a.basis) && e.aliases.some((k) => hits(a.name, k)));
    if (ok) met++; else detail.push(`missing ${e.aliases.join('/')} (${e.basis.join('|')}); got [${out.areas.map((a) => `${a.name}:${a.basis}`).join('; ')}]`);
  }
  const forbiddenHit = (label.forbid ?? []).filter((k) => out.areas.some((a) => hits(a.name, k)));
  if (forbiddenHit.length) detail.push(`forbidden area(s) ${forbiddenHit.join(',')} in [${out.areas.map((a) => a.name).join('; ')}]`);
  const noAreasViolated = label.noAreas === true && out.areas.length > 0;
  if (noAreasViolated) detail.push(`areas invented: [${out.areas.map((a) => a.name).join('; ')}]`);
  const venueAreaOnNationwide = (out.geoScope === 'national' || out.geoScope === 'international') && out.areas.some((a) => a.basis === 'venue');
  if (venueAreaOnNationwide) detail.push('venue-derived area on a nationwide/international event');
  const venueWithStated = out.areas.some((a) => a.basis === 'stated') && out.areas.some((a) => a.basis === 'venue');
  if (venueWithStated) detail.push('venue area added next to a stated audience area');
  const ungroundedStated = out.areas.filter((a) => a.basis === 'stated' && !textMentions(source, a.name)).map((a) => a.name);
  if (ungroundedStated.length) detail.push(`stated area not in the post: ${ungroundedStated.join(', ')}`);
  return {
    scope, expectationsMet: met, expectationsTotal: label.expect.length, forbiddenHit, venueAreaOnNationwide, venueWithStated, ungroundedStated,
    pass: scope && met === label.expect.length && forbiddenHit.length === 0 && !noAreasViolated && !venueAreaOnNationwide && !venueWithStated && ungroundedStated.length === 0,
    detail,
  };
}

// Words every administrative area carries; sharing one says nothing about WHICH place is meant.
const GENERIC_ADMIN_WORDS = new Set(['kabupaten', 'kota', 'provinsi', 'daerah', 'istimewa', 'special', 'region', 'regency', 'city', 'province', 'district', 'kecamatan', 'kelurahan', 'desa', 'republic', 'state']);

// A place counts as mentioned if its name — or any alias of a known area it names — is in the text.
export function textMentions(source: string, placeName: string): boolean {
  const s = norm(source);
  const n = norm(placeName).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (n.length >= 3 && s.includes(n)) return true;
  for (const [, aliases] of Object.entries(AREA_ALIASES)) {
    const named = aliases.some((a) => new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(n));
    if (named && aliases.some((a) => new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(s))) return true;
  }
  return n.split(/\s+/).filter((t) => t.length > 3 && !GENERIC_ADMIN_WORDS.has(t)).some((t) => s.includes(t));
}

// ---- deterministic guards ---------------------------------------------------------------------
// The model proposes; these checks verify against the post text and can only REMOVE a claim, never add one.
//   1. geoScope "national" needs wording that invites the whole country. Without it the scope becomes
//      "unspecified" — a wrong "national" is the expensive error, because it stops every location fallback.
//   2. a "stated" area whose place never appears in the text is dropped (invented audience).
//   3. "venue" areas are dropped when a stated area exists, or when the scope is nationwide / online
//      (the audience is then not the venue's locality).
const NATIONAL_VENUE_NAME = /\b(galeri|museum|taman|perpustakaan|gedung|stadion|bank|universitas|institut|politeknik|lembaga|badan|komisi|dewan)\s+(nasional|national)\b/gi;
const NATIONWIDE_WORDING = /\b(seluruh|se-?\s?indonesia|nasional|national|nationwide|nusantara|berbagai\s+(kota|provinsi|daerah|wilayah)|dari\s+(semua|seluruh)|all\s+over|across\s+(the\s+)?country)\b/i;

export function hasNationwideWording(source: string): boolean {
  return NATIONWIDE_WORDING.test(norm(source).replace(NATIONAL_VENUE_NAME, ' '));
}

export function guardAudienceAreas(out: AudienceAreas, source: string): { out: AudienceAreas; actions: string[] } {
  const actions: string[] = [];
  let geoScope = out.geoScope;
  if (geoScope === 'national' && !hasNationwideWording(source)) { geoScope = 'unspecified'; actions.push('national without nationwide wording -> unspecified'); }
  let areas = out.areas.filter((a) => {
    if (a.basis === 'stated' && !textMentions(source, a.name)) { actions.push(`dropped ungrounded stated area "${a.name}"`); return false; }
    return true;
  });
  const hasStated = areas.some((a) => a.basis === 'stated');
  areas = areas.filter((a) => {
    if (a.basis !== 'venue') return true;
    if (hasStated || geoScope === 'national' || geoScope === 'international' || geoScope === 'online') { actions.push(`dropped venue area "${a.name}"`); return false; }
    return true;
  });
  return { out: { geoScope, areas, evidence: out.evidence }, actions };
}

export function validateAudienceAreas(raw: unknown): { ok: boolean; value?: AudienceAreas; errors: string[] } {
  const errors: string[] = [];
  const r = raw as { geoScope?: unknown; areas?: unknown; evidence?: unknown } | null;
  if (typeof r !== 'object' || r === null) return { ok: false, errors: ['not an object'] };
  if (!(GEO_SCOPES as readonly string[]).includes(r.geoScope as string)) errors.push('geoScope');
  if (!Array.isArray(r.areas)) errors.push('areas');
  else for (const a of r.areas as Array<Record<string, unknown>>) {
    if (typeof a?.name !== 'string' || (a.name as string).trim() === '') errors.push('area.name');
    if (!(AREA_LEVELS as readonly string[]).includes(a?.level as string)) errors.push('area.level');
    if (!(AREA_BASIS as readonly string[]).includes(a?.basis as string)) errors.push('area.basis');
  }
  if (!Array.isArray(r.evidence)) errors.push('evidence');
  return errors.length ? { ok: false, errors } : { ok: true, value: r as unknown as AudienceAreas, errors };
}
