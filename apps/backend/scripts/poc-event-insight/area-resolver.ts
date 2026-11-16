/**
 * POC (pure, no I/O): turn a place NAME as written in a post ("se-Kabupaten Bantul", "Jabodetabek", "DIY & Jawa Tengah", "Canggu Bali")
 * into CANONICAL area keys on the administrative ladder, and take the LEVEL from the gazetteer — never from the model.
 *
 * Why: in the recorded audience-area runs (73 area mentions, 21 distinct strings) the model labelled "Jabodetabek" a province (it spans three),
 * "Jawa" a province (it is an island of six), and the same place "Canggu" a neighbourhood, a city and a regency depending on how the string
 * was written. A level label from the model cannot order events; a key on a known ladder can.
 *
 * Output per input string:
 *   keys      canonical keys the audience covers (a place has one; an aggregate such as Jabodetabek has its members)
 *   path      ancestors of each key, so matching is hierarchical (country > province > regency/city > district > locality)
 *   level     gazetteer level of the match, or 'aggregate'
 *   ambiguous the string names more than one place ("Yogyakarta" = the city and the province); `chosen` follows `ambiguity`
 *
 * The gazetteer below is a HAND-TYPED SAMPLE (provinces, the DIY, Jabodetabek, a few cities, a few well-known localities) written from general
 * knowledge to exercise the design. The real one must be built from the official administrative-code list (Kemendagri / BPS) after checking
 * its licence and revision, and non-Indonesian names fall through to the geocoder (`resolveArea` returns null, `reason: 'not-in-gazetteer'`).
 */
export type AdminLevel = 'country' | 'province' | 'regency' | 'district' | 'locality';

export interface Place { key: string; name: string; level: AdminLevel; parent?: string; aliases?: string[] }
export interface Aggregate { key: string; name: string; aliases: string[]; members: string[] }
export interface Gazetteer { places: Place[]; aggregates: Aggregate[] }

export interface ResolvedArea {
  input: string;
  keys: string[];
  paths: string[][];
  level: AdminLevel | 'aggregate';
  ambiguous: boolean;
  candidates: string[];
  matched: string;
}
export type Resolution = { ok: true; area: ResolvedArea } | { ok: false; input: string; reason: 'empty' | 'not-in-gazetteer' };

export type Ambiguity = 'widest' | 'narrowest' | 'all';

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lowercase, no diacritics, no punctuation; the audience wrappers ("se-", "warga", "komunitas", ...) removed. */
export function normalizeAreaName(text: string): string {
  let t = strip(text).replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\b(se|seluruh)[-\s]+/g, '');
  t = t.replace(/\b(warga|mahasiswa|komunitas|pelajar|masyarakat|penduduk|untuk|area|wilayah|region)\b\s*/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

/** Split "DIY & Jawa Tengah", "Bantul dan Sleman", "Jateng, DIY" into parts. */
export function splitAreas(text: string): string[] {
  return text.split(/\s*(?:&|\/|;|,|\bdan\b|\band\b|\bdengan\b)\s*/i).map((s) => s.trim()).filter(Boolean);
}

type Marker = 'regency' | 'province' | null;
/** A Kota and a Kabupaten can share a name (Bandung, Malang, Bogor); the written marker says which one is meant. */
type RegencyKind = 'kota' | 'kabupaten';
function extractMarker(t: string): { name: string; marker: Marker; kind?: RegencyKind } {
  const m = t.match(/^(kabupaten|kab|kota|kodya|provinsi|prov|daerah istimewa|dki)\.?\s+(.+)$/);
  if (!m) return { name: t, marker: null };
  const kind = m[1];
  if (kind === 'kabupaten' || kind === 'kab') return { name: m[2], marker: 'regency', kind: 'kabupaten' };
  if (kind === 'kota' || kind === 'kodya') return { name: m[2], marker: 'regency', kind: 'kota' };
  if (kind === 'daerah istimewa') return { name: `daerah istimewa ${m[2]}`, marker: 'province' };
  if (kind === 'dki') return { name: `dki ${m[2]}`, marker: 'province' };
  return { name: m[2], marker: 'province' };
}

const isKota = (p: Place): boolean => /^kota\b/i.test(p.name) || p.key.endsWith('-kota');

const LEVEL_RANK: Record<AdminLevel, number> = { country: 0, province: 1, regency: 2, district: 3, locality: 4 };

export function buildIndex(g: Gazetteer) {
  const byKey = new Map(g.places.map((p) => [p.key, p]));
  const byAlias = new Map<string, Place[]>();
  const add = (alias: string, p: Place) => {
    const k = normalizeAreaName(alias);
    const list = byAlias.get(k) ?? [];
    if (!list.includes(p)) list.push(p);
    byAlias.set(k, list);
  };
  for (const p of g.places) { add(p.name, p); for (const a of p.aliases ?? []) add(a, p); }
  const aggByAlias = new Map<string, Aggregate>();
  for (const a of g.aggregates) { aggByAlias.set(normalizeAreaName(a.name), a); for (const al of a.aliases) aggByAlias.set(normalizeAreaName(al), a); }
  const pathOf = (key: string): string[] => {
    const out: string[] = []; let cur = byKey.get(key);
    while (cur) { out.unshift(cur.key); cur = cur.parent ? byKey.get(cur.parent) : undefined; }
    return out;
  };
  return { byKey, byAlias, aggByAlias, pathOf };
}
export type GazetteerIndex = ReturnType<typeof buildIndex>;

/**
 * `within` (optional): a province or regency key the match must lie in. A geocoder gives "Depok" with the province "Special Region of
 * Yogyakarta": inside that province Depok is a kecamatan of Sleman, not Kota Depok in West Java. When nothing inside `within` carries the
 * name the result is `not-in-gazetteer`, so the caller can fall back to `within` itself instead of guessing another province.
 */
export function resolveArea(input: string, ix: GazetteerIndex, ambiguity: Ambiguity = 'widest', within?: string): Resolution {
  const norm = normalizeAreaName(input);
  if (!norm) return { ok: false, input, reason: 'empty' };

  const agg = ix.aggByAlias.get(norm);
  if (agg) {
    const keys = agg.members;
    return { ok: true, area: { input, keys, paths: keys.map((k) => ix.pathOf(k)), level: 'aggregate', ambiguous: false, candidates: [agg.key], matched: agg.name } };
  }

  const { name, marker, kind } = extractMarker(norm);
  let found = ix.byAlias.get(name) ?? ix.byAlias.get(norm) ?? [];
  if (marker) {
    const typed = found.filter((p) => (marker === 'regency' ? p.level === 'regency' : p.level === 'province'));
    if (typed.length) found = typed;
  }
  if (kind) {
    const ofKind = found.filter((p) => (kind === 'kota' ? isKota(p) : p.level === 'regency' && !isKota(p)));
    if (ofKind.length) found = ofKind;
  }
  if (within) found = found.filter((p) => ix.pathOf(p.key).includes(within));
  if (!found.length) return { ok: false, input, reason: 'not-in-gazetteer' };

  const ambiguous = found.length > 1;
  let chosen = found;
  if (ambiguous && ambiguity !== 'all') {
    // The widest (or narrowest) LEVEL wins. Candidates tied on that level are siblings (Kota Bandung and Kabupaten Bandung): neither contains
    // the other, so "widest" is undefined and all of them are kept, as a set. The province would be far too wide a substitute.
    const ranks = found.map((p) => LEVEL_RANK[p.level]);
    const target = ambiguity === 'widest' ? Math.min(...ranks) : Math.max(...ranks);
    chosen = found.filter((p) => LEVEL_RANK[p.level] === target);
  }
  return { ok: true, area: { input, keys: chosen.map((p) => p.key), paths: chosen.map((p) => ix.pathOf(p.key)), level: chosen[0].level, ambiguous, candidates: found.map((p) => p.key), matched: chosen[0].name } };
}

/** One input string may name several areas ("DIY & Jawa Tengah"). */
export function resolveAreas(input: string, ix: GazetteerIndex, ambiguity: Ambiguity = 'widest'): Resolution[] {
  const whole = resolveArea(input, ix, ambiguity);
  if (whole.ok) return [whole];
  const parts = splitAreas(input);
  return parts.length > 1 ? parts.map((p) => resolveArea(p, ix, ambiguity)) : [whole];
}

/**
 * How one audience key relates to a user's area key on the ladder:
 *   same      the same area
 *   inside    the event's area lies within the user's area (a locality event for a user in its regency)
 *   covers    the event's area contains the user's area (a DIY event for a user in Sleman)
 *   sibling   another area with the same parent (Bantul for a user in Sleman)
 *   other     none of the above
 */
export type Relation = 'same' | 'inside' | 'covers' | 'sibling' | 'other';

export function relation(eventKey: string, userKey: string, ix: GazetteerIndex): Relation {
  if (eventKey === userKey) return 'same';
  const eventPath = ix.pathOf(eventKey);
  const userPath = ix.pathOf(userKey);
  if (userPath.includes(eventKey)) return 'covers';
  if (eventPath.includes(userKey)) return 'inside';
  const ep = ix.byKey.get(eventKey)?.parent;
  const up = ix.byKey.get(userKey)?.parent;
  if (ep && up && ep === up) return 'sibling';
  return 'other';
}

/**
 * The ordering tier of a resolved audience for a user (proposal §4.0): 0 = somewhere on the user's local ladder (same, inside, covers a
 * non-national level, or a sibling), 1 = national (no specific audience area), 2 = targeted at somewhere else.
 */
export function tierFor(area: ResolvedArea, userKey: string, ix: GazetteerIndex): 0 | 1 | 2 {
  if (area.keys.every((k) => ix.byKey.get(k)?.level === 'country')) return 1;
  for (const k of area.keys) {
    if (ix.byKey.get(k)?.level === 'country') continue;
    if (relation(k, userKey, ix) !== 'other') return 0;
  }
  return 2;
}

// ---------------------------------------------------------------------------------------------------------------------------
// SAMPLE gazetteer — see the header. Keys follow ISO 3166-2 province codes with a slug for each level below.
const prov = (code: string, name: string, aliases: string[] = []): Place => ({ key: `id-${code}`, name, level: 'province', parent: 'id', aliases });
const reg = (p: string, slug: string, name: string, aliases: string[] = []): Place => ({ key: `id-${p}-${slug}`, name, level: 'regency', parent: `id-${p}`, aliases });
const loc = (p: string, regSlug: string, slug: string, name: string, aliases: string[] = []): Place => ({ key: `id-${p}-${regSlug}-${slug}`, name, level: 'locality', parent: `id-${p}-${regSlug}`, aliases });
const dist = (p: string, regSlug: string, slug: string, name: string, aliases: string[] = []): Place => ({ key: `id-${p}-${regSlug}-${slug}`, name, level: 'district', parent: `id-${p}-${regSlug}`, aliases });

export const SAMPLE_GAZETTEER: Gazetteer = {
  places: [
    { key: 'id', name: 'Indonesia', level: 'country', aliases: ['nusantara', 'seluruh indonesia', 'nasional'] },
    prov('ac', 'Aceh'), prov('su', 'Sumatera Utara', ['sumut', 'north sumatra']), prov('sb', 'Sumatera Barat', ['sumbar']), prov('ri', 'Riau'), prov('kr', 'Kepulauan Riau', ['kepri']),
    prov('ja', 'Jambi'), prov('ss', 'Sumatera Selatan', ['sumsel']), prov('bb', 'Kepulauan Bangka Belitung', ['babel']), prov('be', 'Bengkulu'), prov('la', 'Lampung'),
    prov('jk', 'DKI Jakarta', ['jakarta', 'dki']), prov('jb', 'Jawa Barat', ['jabar', 'west java']), prov('bt', 'Banten'), prov('jt', 'Jawa Tengah', ['jateng', 'central java']),
    prov('yo', 'Daerah Istimewa Yogyakarta', ['diy', 'di yogyakarta', 'yogyakarta', 'jogja', 'yogya', 'jogjakarta', 'ngayogyakarta', 'special region of yogyakarta']), prov('ji', 'Jawa Timur', ['jatim', 'east java']),
    prov('ba', 'Bali'), prov('nb', 'Nusa Tenggara Barat', ['ntb']), prov('nt', 'Nusa Tenggara Timur', ['ntt']),
    prov('kb', 'Kalimantan Barat', ['kalbar']), prov('kt', 'Kalimantan Tengah', ['kalteng']), prov('ks', 'Kalimantan Selatan', ['kalsel']), prov('ki', 'Kalimantan Timur', ['kaltim']), prov('ku', 'Kalimantan Utara', ['kaltara']),
    prov('sa', 'Sulawesi Utara', ['sulut']), prov('st', 'Sulawesi Tengah', ['sulteng']), prov('sn', 'Sulawesi Selatan', ['sulsel']), prov('sg', 'Sulawesi Tenggara', ['sultra']), prov('go', 'Gorontalo'), prov('sr', 'Sulawesi Barat', ['sulbar']),
    prov('ma', 'Maluku'), prov('mu', 'Maluku Utara'), prov('pa', 'Papua'), prov('pb', 'Papua Barat'),
    // DIY
    reg('yo', 'yogyakarta', 'Kota Yogyakarta', ['yogyakarta city', 'kota jogja', 'yogyakarta']), reg('yo', 'sleman', 'Sleman', ['kabupaten sleman']), reg('yo', 'bantul', 'Bantul', ['kabupaten bantul']),
    reg('yo', 'kulonprogo', 'Kulon Progo', ['kulonprogo']), reg('yo', 'gunungkidul', 'Gunungkidul', ['gunung kidul']),
    // Kecamatan samples. A geocoder's "city" for a Sleman or Bantul venue is usually one of these, not a city (prod 2026-10-27, DIY schedules:
    // Depok 352, Mlati 48, Banguntapan 26), and "Depok" is also Kota Depok in West Java: resolve it WITHIN the geocoder's province.
    dist('yo', 'sleman', 'depok', 'Depok', ['depok sleman']), dist('yo', 'sleman', 'mlati', 'Mlati'), dist('yo', 'sleman', 'gamping', 'Gamping'), dist('yo', 'sleman', 'pakem', 'Pakem'), dist('yo', 'sleman', 'ngaglik', 'Ngaglik'),
    dist('yo', 'bantul', 'banguntapan', 'Banguntapan'), dist('yo', 'bantul', 'kasihan', 'Kasihan'), dist('yo', 'bantul', 'sewon', 'Sewon'),
    // Jabodetabek members (Jakarta is its own province; the others belong to Jawa Barat and Banten)
    reg('jb', 'bogor-kota', 'Kota Bogor', ['bogor']), reg('jb', 'bogor', 'Kabupaten Bogor', ['bogor']), reg('jb', 'depok', 'Kota Depok', ['depok']), reg('jb', 'bekasi-kota', 'Kota Bekasi', ['bekasi']), reg('jb', 'bekasi', 'Kabupaten Bekasi', ['bekasi']),
    reg('bt', 'tangerang-kota', 'Kota Tangerang', ['tangerang']), reg('bt', 'tangerang', 'Kabupaten Tangerang', ['tangerang']), reg('bt', 'tangsel', 'Tangerang Selatan', ['tangsel']),
    reg('jb', 'bandung-kota', 'Kota Bandung', ['bandung']), reg('jb', 'bandung', 'Kabupaten Bandung', ['bandung']), reg('jb', 'cimahi', 'Kota Cimahi', ['cimahi']), reg('jb', 'bandung-barat', 'Kabupaten Bandung Barat', ['bandung barat']),
    reg('ji', 'surabaya', 'Kota Surabaya', ['surabaya']), reg('ji', 'sidoarjo', 'Sidoarjo'), reg('ji', 'malang-kota', 'Kota Malang', ['malang']), reg('ji', 'malang', 'Kabupaten Malang', ['malang']), reg('ji', 'batu', 'Kota Batu', ['batu']),
    reg('ji', 'gresik', 'Gresik'), reg('ji', 'bangkalan', 'Bangkalan'), reg('ji', 'mojokerto', 'Kabupaten Mojokerto', ['mojokerto']), reg('ji', 'lamongan', 'Lamongan'),
    reg('jt', 'semarang-kota', 'Kota Semarang', ['semarang']), reg('jt', 'semarang', 'Kabupaten Semarang', ['semarang']), reg('jt', 'kendal', 'Kendal'), reg('jt', 'demak', 'Demak'),
    reg('jt', 'surakarta', 'Kota Surakarta', ['solo', 'surakarta']), reg('jt', 'boyolali', 'Boyolali'), reg('jt', 'sukoharjo', 'Sukoharjo'), reg('jt', 'karanganyar', 'Karanganyar'), reg('jt', 'wonogiri', 'Wonogiri'), reg('jt', 'sragen', 'Sragen'), reg('jt', 'klaten', 'Klaten'),
    reg('ba', 'denpasar', 'Denpasar', ['kota denpasar']), reg('ba', 'badung', 'Badung', ['kabupaten badung']), reg('ba', 'gianyar', 'Gianyar'),
    loc('ba', 'badung', 'canggu', 'Canggu', ['canggu bali', 'canggu badung', 'canggu kabupaten badung']), loc('ba', 'badung', 'kuta', 'Kuta'), loc('ba', 'badung', 'seminyak', 'Seminyak'), loc('ba', 'gianyar', 'ubud', 'Ubud'),
  ],
  aggregates: [
    { key: 'agg-jabodetabek', name: 'Jabodetabek', aliases: ['jabodetabek', 'jadetabek', 'greater jakarta'], members: ['id-jk', 'id-jb-bogor-kota', 'id-jb-bogor', 'id-jb-depok', 'id-jb-bekasi-kota', 'id-jb-bekasi', 'id-bt-tangerang-kota', 'id-bt-tangerang', 'id-bt-tangsel'] },
    { key: 'agg-jawa', name: 'Pulau Jawa', aliases: ['jawa', 'java', 'pulau jawa'], members: ['id-jk', 'id-jb', 'id-bt', 'id-jt', 'id-yo', 'id-ji'] },
    { key: 'agg-bali', name: 'Bali dan sekitarnya', aliases: [], members: ['id-ba'] },
    // ---- Seed table of informal aggregates (owner, 2026-10-27: seed ~10-15, the owner maintains). Prod captions name these in about 1.3% of
    // posts (Solo Raya, Jabodetabek, Kartamantul, Joglosemar, Malang Raya, ...). The member lists are a first reading from general knowledge and
    // MUST be verified by the owner before they are relied on; every member key must exist in `places` (a test enforces it).
    { key: 'agg-kartamantul', name: 'Kartamantul', aliases: ['kartamantul', 'jogja raya', 'yogya raya'], members: ['id-yo-yogyakarta', 'id-yo-sleman', 'id-yo-bantul'] },
    { key: 'agg-joglosemar', name: 'Joglosemar', aliases: ['joglosemar', 'jogja solo semarang'], members: ['id-yo-yogyakarta', 'id-jt-surakarta', 'id-jt-semarang-kota'] },
    { key: 'agg-solo-raya', name: 'Solo Raya', aliases: ['solo raya', 'soloraya', 'subosukowonosraten', 'surakarta raya'], members: ['id-jt-surakarta', 'id-jt-boyolali', 'id-jt-sukoharjo', 'id-jt-karanganyar', 'id-jt-wonogiri', 'id-jt-sragen', 'id-jt-klaten'] },
    { key: 'agg-malang-raya', name: 'Malang Raya', aliases: ['malang raya'], members: ['id-ji-malang-kota', 'id-ji-malang', 'id-ji-batu'] },
    { key: 'agg-bandung-raya', name: 'Bandung Raya', aliases: ['bandung raya', 'cekungan bandung'], members: ['id-jb-bandung-kota', 'id-jb-bandung', 'id-jb-cimahi', 'id-jb-bandung-barat'] },
    { key: 'agg-semarang-raya', name: 'Semarang Raya', aliases: ['semarang raya', 'kedungsepur'], members: ['id-jt-semarang-kota', 'id-jt-semarang', 'id-jt-kendal', 'id-jt-demak'] },
    { key: 'agg-gerbangkertosusila', name: 'Gerbangkertosusila', aliases: ['gerbangkertosusila', 'surabaya raya'], members: ['id-ji-gresik', 'id-ji-bangkalan', 'id-ji-mojokerto', 'id-ji-surabaya', 'id-ji-sidoarjo', 'id-ji-lamongan'] },
    { key: 'agg-jawa-bali', name: 'Jawa-Bali', aliases: ['jawa bali', 'jawa-bali', 'java bali'], members: ['id-jk', 'id-jb', 'id-bt', 'id-jt', 'id-yo', 'id-ji', 'id-ba'] },
    { key: 'agg-bali-nusra', name: 'Bali Nusra', aliases: ['bali nusra', 'bali nusa tenggara', 'nusa tenggara', 'nusra'], members: ['id-ba', 'id-nb', 'id-nt'] },
    { key: 'agg-sumatera', name: 'Pulau Sumatera', aliases: ['sumatera', 'sumatra', 'pulau sumatera'], members: ['id-ac', 'id-su', 'id-sb', 'id-ri', 'id-kr', 'id-ja', 'id-ss', 'id-bb', 'id-be', 'id-la'] },
    { key: 'agg-kalimantan', name: 'Pulau Kalimantan', aliases: ['kalimantan', 'borneo', 'pulau kalimantan'], members: ['id-kb', 'id-kt', 'id-ks', 'id-ki', 'id-ku'] },
    { key: 'agg-sulawesi', name: 'Pulau Sulawesi', aliases: ['sulawesi', 'celebes', 'pulau sulawesi'], members: ['id-sa', 'id-st', 'id-sn', 'id-sg', 'id-go', 'id-sr'] },
  ],
};
