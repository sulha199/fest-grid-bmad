/**
 * POC: venues, indoor/outdoor "setting", and online attendance — for events that can have SEVERAL
 * venues, a route instead of a venue, or no physical venue at all.
 *
 * What the code does today (verified by reading it, 2026-10-18):
 *   - Location is resolved PER SCHEDULE (`resolveAccountAndLocations`): each schedule has its own
 *     `location` string -> its own geocoded `locationDetails`. So an event may already have several
 *     venues — one per schedule.
 *   - A schedule with no location falls back to the event's location, then to the ACCOUNT's default
 *     location. There is no concept of an online event anywhere (no field, no prompt wording).
 *   - Location filters (adminArea, venueType, coordinates) join only the MAIN schedule, so a venue on
 *     any other schedule is invisible to them.
 *
 * Design being tested: the model reports (a) how people attend — onsite / online / hybrid — and (b) the
 * physical venues named in the text, each with a closed `kind` and `setting`. Geoapify's category is
 * the first source for a named place's kind/setting (mapped by `categoryToVenue`); the model fills in
 * where the geocoder is silent. A Zoom/Meet link is an attendance mode, never a venue.
 */
import { isVerbatimQuote } from './score.js';

export const SETTINGS = ['indoor', 'outdoor', 'mixed', 'unknown'] as const;
export const VENUE_KINDS = [
  'mall', 'hall', 'hotel', 'campus', 'sports_venue', 'park_open_space', 'nature',
  'street_or_old_town', 'cafe_restaurant', 'museum_gallery', 'community_space', 'other', 'unknown',
] as const;
export const ATTENDANCE = ['onsite', 'online', 'hybrid', 'unspecified'] as const;

export type Setting = (typeof SETTINGS)[number];
export type VenueKind = (typeof VENUE_KINDS)[number];
export type Attendance = (typeof ATTENDANCE)[number];

export interface Venue { name: string; kind: VenueKind; setting: Setting; scheduleLabel?: string }
export interface VenueExtraction { attendance: Attendance; venues: Venue[]; onlinePlatform?: string; evidence: string[] }

export const venuesSchema = {
  type: 'OBJECT',
  properties: {
    attendance: { type: 'STRING', enum: [...ATTENDANCE] },
    venues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          kind: { type: 'STRING', enum: [...VENUE_KINDS] },
          setting: { type: 'STRING', enum: [...SETTINGS] },
          scheduleLabel: { type: 'STRING' },
        },
        required: ['name', 'kind', 'setting'],
      },
    },
    onlinePlatform: { type: 'STRING' },
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['attendance', 'venues', 'evidence'],
};

export const VENUES_INSTRUCTION = `You are an analyst for an event-discovery app. Given the text of one social media post, report HOW people attend and WHERE the physical venues are. The post may be Indonesian, English or mixed; answer in English enums.

- attendance: onsite = people attend in person only; online = remote only (Zoom, Google Meet, YouTube/Instagram Live, "webinar", "daring"); hybrid = both are offered; unspecified = the text does not say.
- venues: one entry per distinct PHYSICAL place the post names where the event or one of its parts happens. An event whose days or sessions are at different places has several entries. For a walk, run or ride, list the named start, finish and landmarks it passes (at most 5). If the post names no physical place, return an empty list. NEVER invent a venue, and NEVER list a Zoom/Meet/YouTube link, a platform or the word "online" as a venue -- that belongs to attendance / onlinePlatform.
- name: the place name as written in the post.
- setting: indoor = inside a building (hall, auditorium, mall interior, studio, ballroom, indoor court); outdoor = open air (field, square, beach, park, street, trail, courtyard); mixed = clearly both (a campus, a large complex with pavilions and grounds); unknown = it cannot be told from the name and the activity. Prefer unknown to a guess.
- kind: from the list only: mall, hall (auditorium, ballroom, gedung, balai), hotel, campus, sports_venue (stadium, GOR, court, field), park_open_space (park, alun-alun, square, taman), nature (beach, mountain, forest, trail), street_or_old_town, cafe_restaurant, museum_gallery, community_space (co-working, studio, community centre), other, unknown.
- scheduleLabel: which day or session the venue belongs to, only when the post ties them together.
- onlinePlatform: the platform's name if stated.
- evidence: up to 5 short VERBATIM snippets (at most 100 characters each) supporting the venues and attendance.
Strictly follow the JSON schema.`;

// ---- labels ---------------------------------------------------------------------------------
export interface VenueExpect { nameAny: string[]; setting: Setting[]; kind?: VenueKind[] }
export interface VenueLabel { attendance: Attendance[]; venueCount: [number, number]; expect: VenueExpect[] }
export interface VenuePost { id: string; caption: string; note: string; label: VenueLabel }

const ANY: Setting[] = ['indoor', 'outdoor', 'mixed', 'unknown'];

// Posts from the existing corpus (captions come from corpus.ts), labelled by reading each caption.
export const EXISTING_VENUE_LABELS: Record<string, VenueLabel> = {
  'uss-market': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['ambarrukmo'], setting: ['indoor', 'mixed'], kind: ['mall'] }] },
  'tropical-playland': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['ambarrukmo'], setting: ['indoor'] }] },
  'swasana-budaya': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['ambarrukmo'], setting: ['indoor', 'mixed'] }] },
  'gowes-merdeka': { attendance: ['onsite', 'unspecified'], venueCount: [1, 4], expect: [{ nameAny: ['candi sari', 'kedulan'], setting: ['outdoor', 'mixed'] }] },
  'cald-conference': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['ambarrukmo'], setting: ['indoor'], kind: ['hotel', 'hall'] }] },
  'porseni-stikes': { attendance: ['onsite', 'unspecified'], venueCount: [2, 3], expect: [{ nameAny: ['sport academy'], setting: ANY }, { nameAny: ['funminton'], setting: ANY }] },
  'volunteer-sosling': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['omah noto', 'plankton'], setting: ['outdoor', 'mixed'] }] },
  'volunteer-pulangkesinii': { attendance: ['unspecified', 'online'], venueCount: [0, 0], expect: [] },
  'futsal-mfc': { attendance: ['unspecified'], venueCount: [0, 0], expect: [] },
  'lomba-mewarnai': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['montero'], setting: ANY }] },
  'apecx-talkshow': { attendance: ['onsite', 'unspecified'], venueCount: [1, 2], expect: [{ nameAny: ['sglc', 'auditorium', 'engineering', 'gadjah mada'], setting: ['indoor'], kind: ['hall', 'campus'] }] },
  'erafone-run': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['gunungapi', 'merapi'], setting: ['outdoor', 'mixed'] }] },
  'fixture-sleman-city-hall': { attendance: ['onsite', 'unspecified'], venueCount: [1, 2], expect: [{ nameAny: ['sleman city hall', 'atrium', 'plaza rama'], setting: ['indoor', 'mixed'] }] },
  'fixture-drum-contest': { attendance: ['hybrid', 'onsite'], venueCount: [1, 1], expect: [{ nameAny: ['kotta go', 'hotel'], setting: ['indoor'], kind: ['hotel'] }] },
  'fixture-vifation': { attendance: ['unspecified'], venueCount: [0, 0], expect: [] },
  'syn-women-tech': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['hubs', 'co-working'], setting: ['indoor'] }] },
  'syn-senam-lansia': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['puskesmas', 'lapangan'], setting: ['outdoor'] }] },
  'syn-webinar-nasional': { attendance: ['online'], venueCount: [0, 0], expect: [] },
  'syn-konser-jakarta': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['istora'], setting: ['indoor'], kind: ['sports_venue', 'hall'] }] },
  'syn-pameran-origin': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['galeri nasional'], setting: ['indoor'], kind: ['museum_gallery'] }] },
  'syn-expat-bali': { attendance: ['onsite', 'unspecified'], venueCount: [1, 2], expect: [{ nameAny: ['canggu', 'beach'], setting: ['outdoor'] }] },
  'syn-gala-dinner': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['tentrem'], setting: ['indoor'], kind: ['hotel'] }] },
  'syn-kota-lama': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['kota lama'], setting: ['outdoor', 'mixed'] }] },
  'ho-pentas-bantul': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['alun-alun', 'alun alun'], setting: ['outdoor'] }] },
  'ho-coding-camp': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['co-lab'], setting: ['indoor'] }] },
  'ho-srikandi-run': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['bungkul'], setting: ['outdoor'] }] },
  'ho-esai-nasional': { attendance: ['online'], venueCount: [0, 0], expect: [] },
  'ho-gathering-internal': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['alana'], setting: ['indoor'], kind: ['hotel'] }] },
  'ho-layang-layang': { attendance: ['onsite', 'unspecified'], venueCount: [1, 1], expect: [{ nameAny: ['parangtritis'], setting: ['outdoor'], kind: ['nature', 'park_open_space'] }] },
};

// New posts for what the corpus lacks: hybrid, several venues across days, online-only on two
// platforms, a route, and two venues on one day with different settings.
export const NEW_VENUE_POSTS: VenuePost[] = [
  {
    id: 'ven-hybrid-seminar', note: 'one physical venue AND a Zoom option',
    caption: `SEMINAR NASIONAL KEWIRAUSAHAAN 2026 🎓
Format HYBRID: tatap muka di Auditorium Fakultas Ekonomi UGM (kuota 200 orang) dan live via Zoom untuk peserta luar kota.
Sabtu, 28 November 2026, pukul 09.00 WIB.`,
    label: { attendance: ['hybrid'], venueCount: [1, 1], expect: [{ nameAny: ['auditorium', 'ugm', 'fakultas ekonomi'], setting: ['indoor'], kind: ['hall', 'campus'] }] },
  },
  {
    id: 'ven-multi-venue-festival', note: 'three days, three venues, mixed settings',
    caption: `FESTIVAL KOTA TUA JOGJA — 3 HARI 🎪
Jumat, 4 Desember: Malam Rakyat di Alun-alun Kidul
Sabtu, 5 Desember: Pameran & pentas di Gedung Societet Militair, Taman Budaya Yogyakarta
Minggu, 6 Desember: Sunrise & lomba layang-layang di Pantai Parangtritis`,
    label: { attendance: ['onsite'], venueCount: [3, 3], expect: [
      { nameAny: ['alun-alun kidul', 'alun alun kidul'], setting: ['outdoor'] },
      { nameAny: ['societet', 'taman budaya'], setting: ['indoor'] },
      { nameAny: ['parangtritis'], setting: ['outdoor'] },
    ] },
  },
  {
    id: 'ven-zoom-class', note: 'online only; a Zoom link is not a venue',
    caption: `KELAS MEMASAK ONLINE 🍳
Sabtu, 14 November 2026, pukul 14.00 WIB via Zoom.
Gratis, kuota 100 peserta. Link Zoom dikirim lewat e-mail setelah pendaftaran.`,
    label: { attendance: ['online'], venueCount: [0, 0], expect: [] },
  },
  {
    id: 'ven-walk-route', note: 'a route, not a venue',
    caption: `FUN WALK MALIOBORO 5K 🚶
Start di Tugu Yogyakarta, melewati Jalan Malioboro dan Titik Nol Kilometer, finish di Alun-alun Utara.
Minggu, 15 November 2026, pukul 06.00 WIB.`,
    label: { attendance: ['onsite'], venueCount: [1, 5], expect: [{ nameAny: ['tugu', 'malioboro', 'titik nol', 'alun-alun utara', 'alun alun utara'], setting: ['outdoor'] }] },
  },
  {
    id: 'ven-meet-discussion', note: 'online only on Google Meet',
    caption: `DISKUSI BUKU BULANAN 📖 "Laut Bercerita"
Kamis, 19 November 2026, pukul 19.30 WIB via Google Meet. Gratis. Link di bio.`,
    label: { attendance: ['online'], venueCount: [0, 0], expect: [] },
  },
  {
    id: 'ven-two-sites-one-day', note: 'two venues on one day, indoor and outdoor',
    caption: `PAMERAN & WORKSHOP BATIK 🎨
Sabtu, 21 November 2026
• 10.00–17.00 Pameran di Galeri Taman Budaya Yogyakarta
• 13.00–16.00 Workshop membatik di halaman Museum Sonobudoyo`,
    label: { attendance: ['onsite'], venueCount: [2, 2], expect: [
      { nameAny: ['taman budaya'], setting: ['indoor'] },
      { nameAny: ['sonobudoyo'], setting: ['outdoor', 'mixed'] },
    ] },
  },
];
export const PROBE_POSTS = NEW_VENUE_POSTS;

// ---- scoring --------------------------------------------------------------------------------
const ONLINE_WORDS = /\b(zoom|google ?meet|meet|teams|youtube|live ?stream|livestream|webinar|online|daring|instagram live)\b/i;

export interface VenueScore {
  attendance: boolean;
  count: boolean;
  met: number;
  total: number;
  // a venue whose name is not in the post (an invented place)
  invented: string[];
  // an online platform / link reported as a physical venue
  onlineAsVenue: string[];
  // matched a venue by name but its setting was 'unknown' where the label expects a claim
  abstained: number;
  wrongSetting: string[];
  pass: boolean;
  detail: string[];
}

const norm = (s: string) => s.normalize('NFKC').toLowerCase();

export function scoreVenues(out: VenueExtraction, label: VenueLabel, source: string): VenueScore {
  const detail: string[] = [];
  const attendance = label.attendance.includes(out.attendance);
  if (!attendance) detail.push(`attendance=${out.attendance}, accept ${label.attendance.join('|')}`);
  const count = out.venues.length >= label.venueCount[0] && out.venues.length <= label.venueCount[1];
  if (!count) detail.push(`${out.venues.length} venue(s), expected ${label.venueCount[0]}–${label.venueCount[1]}`);
  let met = 0, abstained = 0;
  const wrongSetting: string[] = [];
  for (const e of label.expect) {
    const v = out.venues.find((x) => e.nameAny.some((a) => norm(x.name).includes(a)));
    if (!v) { detail.push(`no venue matching ${e.nameAny.join('/')}`); continue; }
    const settingOk = e.setting.includes(v.setting);
    const kindOk = !e.kind || e.kind.includes(v.kind);
    if (settingOk && kindOk) met++;
    else {
      if (!settingOk) {
        if (v.setting === 'unknown') abstained++; else wrongSetting.push(`${v.name}: ${v.setting} (accept ${e.setting.join('|')})`);
      }
      detail.push(`${v.name}: setting=${v.setting}${settingOk ? '' : ` (accept ${e.setting.join('|')})`} kind=${v.kind}${kindOk ? '' : ` (accept ${e.kind!.join('|')})`}`);
    }
  }
  const invented = out.venues.filter((v) => !isVerbatimQuote(v.name, source)).map((v) => v.name);
  if (invented.length) detail.push(`invented: ${invented.join(', ')}`);
  const onlineAsVenue = out.venues.filter((v) => ONLINE_WORDS.test(v.name)).map((v) => v.name);
  if (onlineAsVenue.length) detail.push(`online as venue: ${onlineAsVenue.join(', ')}`);
  return {
    attendance, count, met, total: label.expect.length, invented, onlineAsVenue, abstained, wrongSetting,
    pass: attendance && count && met === label.expect.length && invented.length === 0 && onlineAsVenue.length === 0, detail,
  };
}

export function validateVenues(raw: unknown): { ok: boolean; value?: VenueExtraction; errors: string[] } {
  const errors: string[] = [];
  const r = raw as any;
  if (typeof r !== 'object' || r === null) return { ok: false, errors: ['not an object'] };
  if (!(ATTENDANCE as readonly string[]).includes(r.attendance)) errors.push('attendance');
  if (!Array.isArray(r.venues)) errors.push('venues');
  else for (const v of r.venues) {
    if (typeof v?.name !== 'string' || v.name.trim() === '') errors.push('venue.name');
    if (!(VENUE_KINDS as readonly string[]).includes(v?.kind)) errors.push('venue.kind');
    if (!(SETTINGS as readonly string[]).includes(v?.setting)) errors.push('venue.setting');
  }
  if (!Array.isArray(r.evidence)) errors.push('evidence');
  return errors.length ? { ok: false, errors } : { ok: true, value: r as VenueExtraction, errors };
}

// ---- Geoapify category -> kind/setting (draft) ----------------------------------------------
// IDEA-070 proposes "a small closed set ... mapped from Geoapify categories by a table in
// packages/domain". Matching is hierarchical, longest prefix wins ("sport.pitch" beats "sport").
// ONLY the first two rows are confirmed by IDEA-070's live Geoapify probe (Malioboro Mall ->
// commercial.shopping_mall, Taman Pintar -> leisure.park). Every other row is a DRAFT from the public
// Geoapify category taxonomy and MUST be confirmed against live responses for Indonesian places
// before it ships — no Geoapify key was available to check them here.
export const CATEGORY_TABLE: ReadonlyArray<{ prefix: string; kind: VenueKind; setting: Setting; verified: boolean }> = [
  { prefix: 'commercial.shopping_mall', kind: 'mall', setting: 'indoor', verified: true },
  { prefix: 'leisure.park', kind: 'park_open_space', setting: 'outdoor', verified: true },
  { prefix: 'accommodation.hotel', kind: 'hotel', setting: 'indoor', verified: false },
  { prefix: 'catering', kind: 'cafe_restaurant', setting: 'mixed', verified: false },
  { prefix: 'entertainment.museum', kind: 'museum_gallery', setting: 'indoor', verified: false },
  { prefix: 'entertainment.culture', kind: 'museum_gallery', setting: 'indoor', verified: false },
  { prefix: 'education', kind: 'campus', setting: 'mixed', verified: false },
  { prefix: 'sport.pitch', kind: 'sports_venue', setting: 'outdoor', verified: false },
  { prefix: 'sport.sports_centre', kind: 'sports_venue', setting: 'indoor', verified: false },
  { prefix: 'sport', kind: 'sports_venue', setting: 'mixed', verified: false },
  { prefix: 'natural', kind: 'nature', setting: 'outdoor', verified: false },
  { prefix: 'beach', kind: 'nature', setting: 'outdoor', verified: false },
  { prefix: 'national_park', kind: 'nature', setting: 'outdoor', verified: false },
  { prefix: 'religion', kind: 'community_space', setting: 'indoor', verified: false },
  { prefix: 'tourism', kind: 'other', setting: 'mixed', verified: false },
  { prefix: 'building', kind: 'other', setting: 'unknown', verified: false },
];

export function categoryToVenue(category: string | undefined): { kind: VenueKind; setting: Setting } {
  if (!category) return { kind: 'unknown', setting: 'unknown' };
  const c = category.toLowerCase();
  let best: (typeof CATEGORY_TABLE)[number] | undefined;
  for (const row of CATEGORY_TABLE) {
    if ((c === row.prefix || c.startsWith(`${row.prefix}.`)) && (!best || row.prefix.length > best.prefix.length)) best = row;
  }
  return best ? { kind: best.kind, setting: best.setting } : { kind: 'unknown', setting: 'unknown' };
}

export interface ResolvedSetting { setting: Setting; kind: VenueKind; source: 'geoapify' | 'ai' | 'none'; conflict: boolean }

// Geoapify first (a named place's category is reliable), the model only where the geocoder is silent
// or maps to "unknown". When both speak and disagree, Geoapify wins and the disagreement is flagged so
// it can be counted — a rising conflict rate is the early warning that the mapping table is wrong.
export function resolveSetting(input: { geoapifyCategory?: string; aiSetting?: Setting; aiKind?: VenueKind }): ResolvedSetting {
  const geo = categoryToVenue(input.geoapifyCategory);
  const aiSetting = input.aiSetting && input.aiSetting !== 'unknown' ? input.aiSetting : undefined;
  if (geo.setting !== 'unknown') {
    return { setting: geo.setting, kind: geo.kind, source: 'geoapify', conflict: aiSetting !== undefined && aiSetting !== geo.setting };
  }
  if (aiSetting) return { setting: aiSetting, kind: geo.kind !== 'unknown' ? geo.kind : input.aiKind ?? 'unknown', source: 'ai', conflict: false };
  return { setting: 'unknown', kind: geo.kind !== 'unknown' ? geo.kind : input.aiKind ?? 'unknown', source: 'none', conflict: false };
}

// Event-level view of several venues: the SET of settings, so "outdoor" matches an event that has an
// outdoor venue on any schedule (EXISTS semantics), instead of looking only at the main schedule.
export function eventSettings(venues: Array<{ setting: Setting }>): Setting[] {
  return [...new Set(venues.map((v) => v.setting).filter((s) => s !== 'unknown'))];
}
