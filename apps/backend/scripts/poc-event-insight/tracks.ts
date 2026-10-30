/**
 * POC: age / eligibility as TRACKS, for events that qualify people in several ways at once.
 *
 * Real posts rarely have one age range. They have categories: a colouring contest with a PAUD/TK
 * class and a 1–3 SD class; a fun run with Kids Dash 6–10, 5K 12+, 10K 17+, Masters 45+; a sports
 * week with a men's and a mixed draw. A single (ageMin, ageMax) either lies (3..10 spanning two
 * classes, with numbers the text never states) or can't express "6–10 OR 45+".
 *
 * Semantics being tested:
 *   - an event has 0..n tracks; a person qualifies for the event if they fit ANY ONE track
 *     (tracks are alternatives);
 *   - inside one track, different kinds of criterion are ALL required (age AND stage AND gender),
 *     and several values of one kind are alternatives (lifeStages: teen OR young_adult);
 *   - numbers (ageMin/ageMax) only when the text states them; a school level ("SD", "mahasiswa")
 *     becomes a lifeStage instead — a coarse, honest stand-in that is flagged as inferred.
 *   - allAges = the text says everyone may take part ("semua usia", "all ages").
 */
import { ageNumberIsStated } from './guards.js';

export const LIFE_STAGES = ['early_childhood', 'child', 'teen', 'young_adult', 'adult', 'senior'] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export interface Track {
  label?: string;
  ageMin?: number;
  ageMax?: number;
  lifeStages: LifeStage[];
  genderFocus: 'all' | 'women' | 'men';
}
export interface TrackedAudience { allAges: boolean; tracks: Track[]; evidence: string[] }

export const tracksSchema = {
  type: 'OBJECT',
  properties: {
    allAges: { type: 'BOOLEAN' },
    tracks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          ageMin: { type: 'NUMBER' },
          ageMax: { type: 'NUMBER' },
          lifeStages: { type: 'ARRAY', items: { type: 'STRING', enum: [...LIFE_STAGES] } },
          genderFocus: { type: 'STRING', enum: ['all', 'women', 'men'] },
        },
        required: ['lifeStages', 'genderFocus'],
      },
    },
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['allAges', 'tracks', 'evidence'],
};

export const TRACKS_INSTRUCTION = `You are an analyst for an event-discovery app. Given the text of one social media post, describe WHO MAY TAKE PART, as tracks. The post may be Indonesian, English or mixed; answer in English enums.

A TRACK is one separately-qualifying category, class, division, session or draw that the post defines (e.g. "Kids Dash 6-10 tahun", "Kategori B: 1-3 SD", "Ganda Putra", "Kelas Dewasa"). A person qualifies for the event if they fit ANY ONE track. Inside one track every stated criterion must hold together (age AND stage AND gender).
- If the post defines no categories but states who the event is for, return exactly one track. If it states nothing about who may take part, return zero tracks.
- label: a short name copied from the post's own wording for that track.
- ageMin / ageMax: ONLY numbers written in the post next to an age word (usia, umur, tahun, age, years, "ke atas", "under"). "60 tahun ke atas" has a minimum of 60 and NO maximum. "di bawah 12 tahun" has a maximum of 11 or 12. Never derive a number from a school level or a word like "anak".
- lifeStages: the life stage(s) the track is for, from this list only: early_childhood (up to about 6, PAUD/TK), child (about 7-12, SD), teen (13-17, SMP/SMA/remaja), young_adult (18-30, mahasiswa), adult (31-59, dewasa), senior (60+, lansia). Use it for school levels and words like anak/remaja/dewasa. Several values in one track mean "any of these".
- genderFocus: women or men only when the track is dedicated to that gender (putri/putra, khusus perempuan); a mixed draw is all.
- allAges: true only if the post says everyone may take part (semua usia, all ages, segala usia).
- evidence: up to 5 short VERBATIM snippets from the post (at most 100 characters each) that support the tracks.
Strictly follow the JSON schema.`;

// ---- labels ---------------------------------------------------------------------------------
export interface TrackExpectation { ageMin?: number[] | 'absent'; ageMax?: number[] | 'absent'; lifeStageAny?: LifeStage[]; gender?: Array<'all' | 'women' | 'men'> }
export interface TrackLabel { trackCount: [number, number]; allAges?: boolean; expect: TrackExpectation[] }

export interface TrackPost { id: string; caption: string; note: string; label: TrackLabel }

// Existing corpus posts re-used by id (captions come from corpus.ts); labels written here.
export const EXISTING_TRACK_LABELS: Record<string, TrackLabel> = {
  'lomba-mewarnai': { trackCount: [2, 2], expect: [
    { lifeStageAny: ['early_childhood', 'child'], ageMin: 'absent', ageMax: 'absent' },
    { lifeStageAny: ['child', 'early_childhood'], ageMin: 'absent', ageMax: 'absent' },
  ] },
  'porseni-stikes': { trackCount: [2, 5], expect: [{ gender: ['men'] }, { gender: ['all'] }] },
  'fixture-drum-contest': { trackCount: [1, 1], expect: [{ ageMin: [7], ageMax: [16] }] },
  'ho-coding-camp': { trackCount: [1, 1], expect: [{ ageMin: [8], ageMax: [12] }] },
  'ho-layang-layang': { trackCount: [3, 3], expect: [
    { lifeStageAny: ['early_childhood', 'child'] }, { lifeStageAny: ['teen'] }, { lifeStageAny: ['adult', 'young_adult'] },
  ] },
  'syn-family-day': { trackCount: [1, 2], expect: [{ ageMax: [11, 12], ageMin: 'absent' }] },
  'syn-senam-lansia': { trackCount: [1, 1], expect: [{ ageMin: [60], ageMax: 'absent', lifeStageAny: ['senior'] }] },
  'ho-srikandi-run': { trackCount: [0, 1], allAges: true, expect: [] },
};

export const NEW_TRACK_POSTS: TrackPost[] = [
  {
    id: 'trk-fun-run-categories', note: 'four categories, three of them one-sided age statements',
    caption: `JOGJA FUN RUN 2026 🏃
Minggu, 8 November 2026 — Alun-alun Kidul

🧒 Kids Dash 1K — usia 6–10 tahun
🏃 5K Terbuka — usia 12 tahun ke atas
🏅 10K Kompetitif — usia 17 tahun ke atas
👴 Master 10K — usia 45 tahun ke atas

Pendaftaran dibuka sampai 30 Oktober.`,
    label: { trackCount: [4, 4], expect: [
      { ageMin: [6], ageMax: [10] }, { ageMin: [12], ageMax: 'absent' }, { ageMin: [17], ageMax: 'absent' }, { ageMin: [45], ageMax: 'absent' },
    ] },
  },
  {
    id: 'trk-kelas-musik', note: 'three classes: two numeric, one by life stage only',
    caption: `KELAS PIANO — periode Desember 2026 🎹

• Piano Anak (usia 5–8 tahun) — Sabtu pagi
• Piano Remaja (13–17 tahun) — Minggu siang
• Kelas Dewasa Pemula — Rabu malam

Studio Nada, Jl. Magelang, Sleman. Kuota 8 siswa per kelas.`,
    label: { trackCount: [3, 3], expect: [
      { ageMin: [5], ageMax: [8] }, { ageMin: [13], ageMax: [17] }, { lifeStageAny: ['adult', 'young_adult'], ageMin: 'absent', ageMax: 'absent' },
    ] },
  },
  {
    id: 'trk-karya-tulis', note: 'one competition, two eligible groups (alternatives), no numbers',
    caption: `LOMBA KARYA TULIS ILMIAH NASIONAL 2026 📝

Terbuka untuk pelajar SMA/sederajat ATAU mahasiswa S1 dari seluruh Indonesia.
Tema: Inovasi Pangan Lokal. Pendaftaran online, gratis.`,
    label: { trackCount: [1, 2], expect: [
      { lifeStageAny: ['teen'], ageMin: 'absent', ageMax: 'absent' }, { lifeStageAny: ['young_adult'], ageMin: 'absent', ageMax: 'absent' },
    ] },
  },
  {
    id: 'trk-debat', note: 'two criteria that must BOTH hold in one track (stage AND age cap)',
    caption: `LOMBA DEBAT ANTAR KAMPUS 🎤

Tim terdiri dari 3 mahasiswa aktif, usia maksimal 25 tahun.
Babak penyisihan 14 November 2026, Universitas Karya Bangsa, Sleman.`,
    label: { trackCount: [1, 1], expect: [{ lifeStageAny: ['young_adult'], ageMax: [25], ageMin: 'absent' }] },
  },
];

// ---- scoring --------------------------------------------------------------------------------
export interface TrackScore {
  trackCount: boolean;
  expectationsMet: number;
  expectationsTotal: number;
  allAges: boolean;
  // numbers the text does not state next to an age word => a fabricated bound
  fabricatedNumbers: string[];
  // every expectation met AND count in range AND allAges right AND nothing fabricated
  pass: boolean;
  detail: string[];
}

function matches(t: Track, e: TrackExpectation): boolean {
  const num = (rule: number[] | 'absent' | undefined, v: number | undefined) =>
    rule === undefined ? true : rule === 'absent' ? v === undefined || v === null : v !== undefined && v !== null && rule.includes(v);
  if (!num(e.ageMin, t.ageMin) || !num(e.ageMax, t.ageMax)) return false;
  if (e.lifeStageAny && !e.lifeStageAny.some((s) => t.lifeStages.includes(s))) return false;
  if (e.gender && !e.gender.includes(t.genderFocus)) return false;
  return true;
}

export function scoreTracks(out: TrackedAudience, label: TrackLabel, source: string): TrackScore {
  const detail: string[] = [];
  const countOk = out.tracks.length >= label.trackCount[0] && out.tracks.length <= label.trackCount[1];
  if (!countOk) detail.push(`${out.tracks.length} track(s), expected ${label.trackCount[0]}–${label.trackCount[1]}`);
  let met = 0;
  for (const e of label.expect) {
    if (out.tracks.some((t) => matches(t, e))) met++;
    else detail.push(`no track matches ${JSON.stringify(e)}`);
  }
  const fabricated: string[] = [];
  for (const [i, t] of out.tracks.entries()) {
    if (t.ageMin != null && !ageNumberIsStated(t.ageMin, [source], 'min')) fabricated.push(`track ${i + 1} ageMin=${t.ageMin}`);
    if (t.ageMax != null && !ageNumberIsStated(t.ageMax, [source], 'max')) fabricated.push(`track ${i + 1} ageMax=${t.ageMax}`);
  }
  if (fabricated.length) detail.push(`fabricated: ${fabricated.join(', ')}`);
  const allAgesOk = label.allAges === undefined || out.allAges === label.allAges;
  if (!allAgesOk) detail.push(`allAges=${out.allAges}`);
  return {
    trackCount: countOk, expectationsMet: met, expectationsTotal: label.expect.length, allAges: allAgesOk,
    fabricatedNumbers: fabricated, pass: countOk && met === label.expect.length && allAgesOk && fabricated.length === 0, detail,
  };
}

export function validateTracks(raw: unknown): { ok: boolean; value?: TrackedAudience; errors: string[] } {
  const errors: string[] = [];
  const r = raw as any;
  if (typeof r !== 'object' || r === null) return { ok: false, errors: ['not an object'] };
  if (typeof r.allAges !== 'boolean') errors.push('allAges');
  if (!Array.isArray(r.tracks)) errors.push('tracks');
  else for (const t of r.tracks) {
    if (!Array.isArray(t.lifeStages) || !t.lifeStages.every((s: unknown) => (LIFE_STAGES as readonly string[]).includes(s as string))) errors.push('lifeStages');
    if (!['all', 'women', 'men'].includes(t.genderFocus)) errors.push('genderFocus');
    for (const k of ['ageMin', 'ageMax']) if (t[k] != null && typeof t[k] !== 'number') errors.push(k);
  }
  if (!Array.isArray(r.evidence)) errors.push('evidence');
  return errors.length ? { ok: false, errors } : { ok: true, value: r as TrackedAudience, errors };
}

// ---- matching a person against tracks (the semantics this POC proposes) ----------------------
export interface PersonQuery { age?: number; lifeStage?: LifeStage; gender?: 'women' | 'men' }

// true = qualifies for at least one track; undefined = the event states nothing we can test.
export function qualifies(audience: TrackedAudience, who: PersonQuery): boolean | undefined {
  if (audience.allAges) return true;
  if (audience.tracks.length === 0) return undefined;
  return audience.tracks.some((t) => {
    if (who.age !== undefined) {
      if (t.ageMin != null && who.age < t.ageMin) return false;
      if (t.ageMax != null && who.age > t.ageMax) return false;
    }
    if (who.lifeStage !== undefined && t.lifeStages.length > 0 && !t.lifeStages.includes(who.lifeStage)) return false;
    if (t.genderFocus !== 'all' && who.gender !== undefined && t.genderFocus !== who.gender) return false;
    return true;
  });
}

// Event-level summary for cards/filters: the UNION of the tracks' age intervals, never one min/max
// stretched across gaps.
export function ageIntervals(audience: TrackedAudience): Array<[number, number]> {
  const iv = audience.tracks
    .filter((t) => t.ageMin != null || t.ageMax != null)
    .map((t): [number, number] => [t.ageMin ?? 0, t.ageMax ?? Infinity])
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const cur of iv) {
    const last = merged[merged.length - 1];
    if (last && cur[0] <= last[1] + 1) last[1] = Math.max(last[1], cur[1]);
    else merged.push([cur[0], cur[1]]);
  }
  return merged;
}

// ---- deterministic range repair ---------------------------------------------------------------
// Observed live: for a closed range written "usia 6–10 tahun" / "5–8 tahun" the model returns the
// minimum and drops the maximum (every closed-range track in the experiment). Numbers are cheap and
// exact for code to read, so: when a track has one bound and the source contains an age-qualified
// range that starts (or ends) at that bound, take the other end from the text. Never invents a
// number — it can only copy one that is literally written next to an age word.
// The age word must be ADJACENT to the range: a prefix right before it ("usia 6–10", "ages 6 to 10") or a
// unit right after it ("6–10 tahun", "13–17 th"). A looser "somewhere nearby" window mistook a price
// range ("Rp100-250 ribu, usia berapa saja") for an age range.
const NUM = String.raw`(\d{1,3})\s*(?:[–—-]|sampai|s\.?d\.?|hingga|to)\s*(\d{1,3})`;
const RANGE_PREFIXED = new RegExp(String.raw`(?:\busia|\bumur|\bages?|\baged)\s*:?\s*(?<![Rr][Pp]\s?)${NUM}(?![\d.,]\d)(?!\d)`, 'gi');
const RANGE_UNIT = new RegExp(String.raw`(?<![\d.,])${NUM}\s*(?:tahun|thn|th|years?|yrs?|yo)\b`, 'gi');

export function repairAgeRanges(audience: TrackedAudience, source: string): { audience: TrackedAudience; repairs: string[] } {
  const repairs: string[] = [];
  const found: Array<[number, number]> = [];
  for (const re of [RANGE_PREFIXED, RANGE_UNIT]) {
    for (const m of source.matchAll(re)) {
      const a = Number(m[1]), b = Number(m[2]);
      // The same range can match both the prefix and the unit pattern ("usia 6–10 tahun"): count it once,
      // or the ambiguity check below would mistake one range for two.
      if (b > a && !found.some(([x, y]) => x === a && y === b)) found.push([a, b]);
    }
  }
  const tracks = audience.tracks.map((t, i) => {
    const out = { ...t };
    if (out.ageMin != null && out.ageMax == null) {
      const hit = found.filter(([a]) => a === out.ageMin);
      if (hit.length === 1) { out.ageMax = hit[0][1]; repairs.push(`track ${i + 1}: ageMax ${hit[0][1]} from range ${hit[0][0]}–${hit[0][1]}`); }
    } else if (out.ageMax != null && out.ageMin == null) {
      const hit = found.filter(([, b]) => b === out.ageMax);
      if (hit.length === 1) { out.ageMin = hit[0][0]; repairs.push(`track ${i + 1}: ageMin ${hit[0][0]} from range ${hit[0][0]}–${hit[0][1]}`); }
    }
    return out;
  });
  return { audience: { ...audience, tracks }, repairs };
}

// ---- held-out tracks posts --------------------------------------------------------------------
// Written and labelled BEFORE the range repair was ever run on them (the repair was designed after
// seeing the first 12 posts' failures). Do not edit these labels after a run.
export const HOLDOUT_TRACK_POSTS: TrackPost[] = [
  {
    id: 'htrk-badminton-u', note: 'age-group divisions written U-13/U-17 plus an open and a women\'s draw',
    caption: `KEJURDA BULU TANGKIS 2026 🏸
Kategori: U-13 (di bawah 13 tahun), U-17 (di bawah 17 tahun), Umum, dan Ganda Putri (khusus perempuan).
Sabtu–Minggu, 5–6 Desember 2026, GOR Among Raga, Yogyakarta.`,
    label: { trackCount: [3, 5], expect: [{ ageMax: [12, 13] }, { ageMax: [16, 17] }, { gender: ['women'] }] },
  },
  {
    id: 'htrk-lukis', note: 'two closed ranges with an accompanied-by-parent clause',
    caption: `WORKSHOP MELUKIS AKHIR PEKAN 🎨
Kelas Balita (3–5 tahun, didampingi orang tua) pukul 09.00
Kelas Anak (6–12 tahun) pukul 11.00
Sabtu, 14 November 2026 — Rumah Seni Cemeti. Biaya Rp75.000.`,
    label: { trackCount: [2, 2], expect: [{ ageMin: [3], ageMax: [5] }, { ageMin: [6], ageMax: [12] }] },
  },
  {
    id: 'htrk-renang', note: 'age groups with an open-ended top group written "19+ tahun"',
    caption: `KEJUARAAN RENANG ANTAR KLUB 🏊
Kelompok umur: KU I (13–15 tahun), KU II (16–18 tahun), Senior (19+ tahun).
Minggu, 29 November 2026 — Kolam Renang Tirtomartani.`,
    label: { trackCount: [3, 3], expect: [{ ageMin: [13], ageMax: [15] }, { ageMin: [16], ageMax: [18] }, { ageMin: [19], ageMax: 'absent' }] },
  },
  {
    id: 'htrk-posyandu', note: 'two target groups, one closed range and one "≥ 60"',
    caption: `POSYANDU REMAJA & LANSIA 🩺
Pemeriksaan kesehatan gratis untuk remaja usia 10–19 tahun dan lansia usia ≥ 60 tahun.
Jumat, 20 November 2026, 08.00–11.00 WIB, Balai Desa Caturtunggal, Sleman.`,
    label: { trackCount: [2, 2], expect: [{ ageMin: [10], ageMax: [19] }, { ageMin: [60], ageMax: 'absent' }] },
  },
  {
    id: 'htrk-bazaar-trap', note: 'TRAP: a time range and a price range, everyone welcome — no age number may appear',
    caption: `BAZAAR BUKU MURAH 📚
Sabtu–Minggu, 21–22 November 2026, pukul 10.00–15.00 WIB, Taman Budaya Yogyakarta.
Harga buku mulai Rp25–50 ribu. Usia berapa saja boleh datang, semua umur!`,
    label: { trackCount: [0, 1], allAges: true, expect: [] },
  },
];
