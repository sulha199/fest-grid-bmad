/**
 * POC: what the INITIAL PROFILE SCRAPE can tell us about an account — which country it operates in and how
 * far its own audience reaches (local government vs national company) — so that
 *   - the geocoder can be given a country filter from the first call (BUG-066), and
 *   - an area-less post is not placed in a national organizer's head-office city (effectiveAudienceAreas).
 *
 * The input is exactly what the subscribe-time Apify profile scrape (`instagram-profile-scraper`, the actor
 * Story 3.4n already pays for) returns: display name, bio, business category, link, and the latest posts'
 * captions and location tags. Nothing extra is fetched.
 *
 * Two independent sources, then a decision that distrusts disagreement:
 *   1. country-signals.ts — deterministic markers (phone, time zone, currency+amount, ccTLD, address form);
 *   2. a Gemini call (schema + instruction below) whose country must be backed by a VERBATIM quote.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferCountryFromSignals, type CountryDecision, type ProfileText } from './country-signals.js';
import { AREA_ALIASES, isVerbatimQuote } from './score.js';
import { AREA_LEVELS, type AreaLevel } from './insight-schema.js';
import { textMentions } from './audience-areas.js';

export const REACHES = ['local', 'regional', 'national', 'international', 'unspecified'] as const;
export type Reach = (typeof REACHES)[number];

export interface ProfileInsight {
  countryCode: string; // ISO 3166-1 alpha-2, or 'UNKNOWN'
  countryEvidence: string[];
  reach: Reach;
  reachAreas: Array<{ name: string; level: AreaLevel }>;
  evidence: string[];
}

export const profileInsightSchema = {
  type: 'OBJECT',
  properties: {
    countryCode: { type: 'STRING' },
    countryEvidence: { type: 'ARRAY', items: { type: 'STRING' } },
    reach: { type: 'STRING', enum: [...REACHES] },
    reachAreas: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, level: { type: 'STRING', enum: [...AREA_LEVELS] } }, required: ['name', 'level'] } },
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['countryCode', 'countryEvidence', 'reach', 'reachAreas', 'evidence'],
};

export const PROFILE_INSIGHT_INSTRUCTION_V1 = `You are an analyst for an event-discovery app. Given what a social media account shows about itself -- its name, bio, business category, link, and its recent post captions and location tags -- report where the account operates and how far its OWN audience reaches. The text may be Indonesian, English or mixed.

- countryCode: the ISO 3166-1 alpha-2 code of the country the account operates in (ID, MY, SG, AU, IN, ...), or the word UNKNOWN. Use only concrete evidence: a phone number or calling code, a time-zone abbreviation, a currency with an amount, an address, a named place that belongs to one country, a country-specific web domain. The LANGUAGE of the text is NOT evidence of a country: Indonesian is also written by communities in Malaysia and Australia, Malay and Indonesian look alike, and English is used everywhere. If nothing concrete supports a country, answer UNKNOWN.
- countryEvidence: 1 to 3 short VERBATIM snippets (at most 100 characters each) copied exactly from the input that support countryCode. Empty when countryCode is UNKNOWN.
- reach: how far the account's own audience reaches. local = one city, regency or neighbourhood (a venue, a mall, a shop, a city or regency government office, a local community); regional = a province or several nearby cities; national = the whole country -- a company or organizer whose activities, branches or customers are spread across the country, whatever city its head office or any single event is in; international = several countries; unspecified = the input does not say.
- reachAreas: ONLY for local or regional: the place(s) the account serves, as {name, level}, taken from the input. For national, international or unspecified leave it empty. NEVER list a head-office city, or the city of one event, for a national organizer.
- evidence: up to 3 short VERBATIM snippets supporting reach and reachAreas.
Strictly follow the JSON schema.`;

export function profileInsightInstruction(version: string): string {
  if (version !== 'v1') throw new Error(`Unknown profile-insight prompt ${version}`);
  return PROFILE_INSIGHT_INSTRUCTION_V1;
}

/** What the model is shown: the same fields the subscribe-time scrape returns. */
export function profilePromptContents(p: ProfileText): string {
  const lines = [
    `Username: "${p.username}"`, `Display name: "${p.displayName}"`, `Bio: "${p.biography}"`,
    `Business category: "${p.businessCategoryName ?? 'N/A'}"`, `Link in bio: "${p.externalUrl ?? 'N/A'}"`,
    `Location tags on recent posts: ${p.locationNames.length ? p.locationNames.map((l) => `"${l}"`).join(', ') : 'none'}`,
    'Recent post captions:', ...p.captions.map((c, i) => `${i + 1}. """${c}"""`),
  ];
  return lines.join('\n');
}

/** The text a quote must come from: everything shown to the model. */
export function sourceText(p: ProfileText): string {
  return [p.username, p.displayName, p.biography, p.businessCategoryName ?? '', p.externalUrl ?? '', ...p.locationNames, ...p.captions].join('\n');
}

// ---- validation ---------------------------------------------------------------------------------------
export function validateProfileInsight(raw: unknown): { ok: boolean; value?: ProfileInsight; errors: string[] } {
  const errors: string[] = [];
  const r = raw as Partial<ProfileInsight> | null;
  if (typeof r !== 'object' || r === null) return { ok: false, errors: ['not an object'] };
  if (typeof r.countryCode !== 'string' || !/^(?:[A-Z]{2}|UNKNOWN)$/.test(r.countryCode.trim().toUpperCase())) errors.push('countryCode');
  if (!Array.isArray(r.countryEvidence)) errors.push('countryEvidence');
  if (!(REACHES as readonly string[]).includes(r.reach as string)) errors.push('reach');
  if (!Array.isArray(r.reachAreas)) errors.push('reachAreas');
  else for (const a of r.reachAreas) if (typeof a?.name !== 'string' || !(AREA_LEVELS as readonly string[]).includes(a?.level as string)) errors.push('reachArea');
  if (!Array.isArray(r.evidence)) errors.push('evidence');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { ...(r as ProfileInsight), countryCode: (r.countryCode as string).trim().toUpperCase() }, errors };
}

// ---- guards (remove claims, never add) ---------------------------------------------------------------------
// 1. a country needs a verbatim quote from the input — a country with no quote becomes UNKNOWN;
// 2. reach areas only for local/regional, and each must be named in the input.
export function guardProfileInsight(out: ProfileInsight, p: ProfileText): { out: ProfileInsight; actions: string[] } {
  const actions: string[] = [];
  const src = sourceText(p);
  let countryCode = out.countryCode;
  let countryEvidence = out.countryEvidence;
  if (countryCode !== 'UNKNOWN') {
    const grounded = out.countryEvidence.filter((q) => isVerbatimQuote(q, src));
    if (grounded.length === 0) { countryCode = 'UNKNOWN'; countryEvidence = []; actions.push(`country ${out.countryCode} dropped: no verbatim evidence`); }
    else countryEvidence = grounded;
  }
  let reachAreas = out.reachAreas;
  if (out.reach !== 'local' && out.reach !== 'regional' && reachAreas.length) { actions.push('reach areas dropped: reach is not local/regional'); reachAreas = []; }
  reachAreas = reachAreas.filter((a) => { const ok = textMentions(src, a.name); if (!ok) actions.push(`reach area "${a.name}" dropped: not in the input`); return ok; });
  return { out: { ...out, countryCode, countryEvidence, reachAreas }, actions };
}

// ---- the combined country decision -----------------------------------------------------------------------
export type CountryResolution =
  | { status: 'resolved'; country: string; source: 'signals' | 'signals+model' | 'model' }
  | { status: 'unresolved'; reason: 'no-evidence' | 'conflict' };

// Deterministic signals are the anchor. The model may add a country only where the signals are silent (and it
// has quoted evidence — guardProfileInsight already enforced that); where both speak and differ, the answer is
// "unresolved", which the retry/moderation path handles — never a guess.
export function resolveCountry(signals: CountryDecision, model: ProfileInsight | undefined): CountryResolution {
  const modelCountry = model && model.countryCode !== 'UNKNOWN' ? model.countryCode : undefined;
  if (signals.status === 'resolved') {
    if (modelCountry && modelCountry !== signals.country) return { status: 'unresolved', reason: 'conflict' };
    return { status: 'resolved', country: signals.country, source: modelCountry ? 'signals+model' : 'signals' };
  }
  if (signals.reason === 'conflict') return { status: 'unresolved', reason: 'conflict' };
  if (modelCountry) {
    // a model country that contradicts even weak signals for another country is not trusted
    const other = signals.signals.find((s) => s.country !== modelCountry);
    const own = signals.signals.some((s) => s.country === modelCountry);
    if (other && !own) return { status: 'unresolved', reason: 'conflict' };
    return { status: 'resolved', country: modelCountry, source: 'model' };
  }
  return { status: 'unresolved', reason: 'no-evidence' };
}

// ---- corpus -----------------------------------------------------------------------------------------------
export interface ProfileCase extends ProfileText { id: string; origin: 'real' | 'synthetic'; note: string }

const here = dirname(fileURLToPath(import.meta.url));
export function realProfiles(): ProfileCase[] {
  const raw = JSON.parse(readFileSync(resolve(here, 'profiles.real.json'), 'utf8')) as { profiles: Array<ProfileText & { id: string; source: string }> };
  return raw.profiles.map((p) => ({ id: p.id, origin: 'real' as const, note: p.source, username: p.username, displayName: p.displayName, biography: p.biography, businessCategoryName: p.businessCategoryName, externalUrl: p.externalUrl, captions: p.captions, locationNames: p.locationNames }));
}

// Synthetic profiles are mine, written to be realistic and to hit the cases the discussion is about. Handles
// end in ".demo" and the organizations do not exist. Labels were written BEFORE any model run.
export const SYNTHETIC_PROFILES: ProfileCase[] = [
  { id: 'syn-dinas-sleman', origin: 'synthetic', note: 'local government agency, Indonesian — the "local govt" half of the discussion', username: 'dinas.pariwisata.sleman.demo', displayName: 'Dinas Pariwisata Kab. Sleman', businessCategoryName: 'Government organization', externalUrl: 'https://pariwisata.example.go.id',
    biography: 'Akun resmi Dinas Pariwisata Kabupaten Sleman, DIY.\nInformasi wisata, event dan layanan.\n📍 Jl. Candi Gebang No. 1, Sleman\n☎️ 0274 868 1234',
    captions: ['Festival Budaya Sleman 2026 digelar 14 November di Lapangan Denggung. Terbuka untuk warga Sleman, gratis!', 'Sosialisasi desa wisata via Zoom untuk pengelola desa wisata se-Kabupaten Sleman, Rabu 10.00 WIB.', 'Pelatihan pemandu wisata lokal, daftar lewat tautan di bio.'], locationNames: ['Kabupaten Sleman'] },
  { id: 'syn-telco-nasional', origin: 'synthetic', note: 'national company with a Jakarta head office — the "national company" half of the discussion', username: 'telko.nusantara.demo', displayName: 'Telko Nusantara', businessCategoryName: 'Telecommunication company', externalUrl: 'https://telkonusantara.example.co.id',
    biography: 'Jaringan terluas, melayani seluruh Indonesia 🇮🇩\nKantor pusat: Jakarta Selatan\nCS 188 (bebas pulsa)',
    captions: ['Webinar UMKM Go Digital GRATIS untuk pelaku usaha dari seluruh Indonesia. Via Zoom, Kamis 19.00 WIB.', 'Tour Mudik Gratis 2026: berangkat dari 25 kota, daftar di gerai Telko terdekat.', 'Telko Run 5K hadir di Makassar, Medan dan Balikpapan!'], locationNames: [] },
  { id: 'syn-kl-hall', origin: 'synthetic', note: 'Malaysian venue, English', username: 'kl.convention.hall.demo', displayName: 'KL Convention Hall', businessCategoryName: 'Event venue', externalUrl: 'https://klhall.example.com.my',
    biography: 'Official page of KL Convention Hall, Jalan Tun Razak, Kuala Lumpur.\nOpen daily 10am-10pm MYT\nBookings: WhatsApp +60 12-345 6789',
    captions: ['Craft Fair this weekend! Admission RM10, free for kids under 12.', 'Wedding expo 5-6 Dec. Register your interest.'], locationNames: ['Kuala Lumpur, Malaysia'] },
  { id: 'syn-sg-makers', origin: 'synthetic', note: 'Singapore community space, English', username: 'sg.makerspace.demo', displayName: 'Ubi Makerspace', businessCategoryName: 'Community organization', externalUrl: 'https://ubimakers.example.sg',
    biography: 'Community makerspace in Singapore. Workshops every Saturday.\n📞 +65 6123 4567',
    captions: ['Soldering 101 this Saturday 2pm SGT. S$20 per seat, tools provided.'], locationNames: ['Ubi Avenue 1'] },
  { id: 'syn-melb-indo', origin: 'synthetic', note: 'TRAP: Indonesian-language community living in Melbourne — language must not give Indonesia', username: 'warga.indo.melbourne.demo', displayName: 'Komunitas Indonesia di Melbourne', businessCategoryName: 'Community',
    externalUrl: null, biography: 'Kumpul warga Indonesia di Victoria 🇦🇺 Piknik, bazar & nonton bareng.',
    captions: ['Piknik bareng Minggu 10am AEST di Fitzroy Gardens, Melbourne. Bawa makanan, donasi A$5.', 'Bazar Indonesia di Footscray, jualan makanan khas — sewa meja A$30.'], locationNames: ['Fitzroy Gardens'] },
  { id: 'syn-delhi-academy', origin: 'synthetic', note: 'Indian coaching institute, English', username: 'sharma.academy.demo', displayName: 'Sharma Academy Delhi', businessCategoryName: 'Education', externalUrl: 'https://sharma-academy.example.in',
    biography: 'Coaching for JEE & NEET. Batches in South Delhi.\n+91 98100 12345', captions: ['New batch starts Monday 7am IST. Fee ₹12,000.'], locationNames: ['New Delhi, India'] },
  { id: 'syn-global-coffee', origin: 'synthetic', note: 'English-only brand, no country anywhere — the right answer is UNKNOWN', username: 'goodbeans.coffee.demo', displayName: 'Good Beans Coffee', businessCategoryName: 'Coffee shop', externalUrl: null,
    biography: 'Good coffee, good people ☕ Follow us for new blends!', captions: ['New blend alert! Notes of cacao and orange peel.', 'Latte art throwdown this Friday. Come hang out!'], locationNames: [] },
  { id: 'syn-empty', origin: 'synthetic', note: 'empty profile', username: 'the.hub.demo', displayName: 'The Hub', businessCategoryName: null, externalUrl: null, biography: '', captions: [], locationNames: [] },
  { id: 'syn-canggu-yoga', origin: 'synthetic', note: 'TRAP: English-language account in Indonesia', username: 'canggu.yoga.demo', displayName: 'Canggu Yoga Collective', businessCategoryName: 'Yoga studio', externalUrl: null,
    biography: 'Yoga & community dinners in Canggu, Bali 🌴\nBeach yoga every Thursday 6am WITA',
    captions: ['Beach yoga + vegan dinner, 250k IDR. Rp 250.000 per person.'], locationNames: ['Canggu, Bali'] },
  { id: 'syn-johor-sukan', origin: 'synthetic', note: 'TRAP: Malay-language account in Malaysia — must not give Indonesia', username: 'kompleks.sukan.jb.demo', displayName: 'Kompleks Sukan Johor Bahru', businessCategoryName: 'Sports complex', externalUrl: null,
    biography: 'Kompleks sukan rasmi Johor Bahru. Sewa gelanggang & kejohanan.\nWhatsApp +60 7-123 4567',
    captions: ['Kejohanan futsal terbuka 12 Disember. Yuran penyertaan RM30 sahaja.'], locationNames: ['Johor Bahru'] },
  { id: 'syn-warung-tanpa-kota', origin: 'synthetic', note: 'Indonesian-language shop with no place anywhere — must not invent a city', username: 'warung.kopi.enak.demo', displayName: 'Warung Kopi Enak', businessCategoryName: 'Coffee shop', externalUrl: null,
    biography: 'Warung kopi enak 🍵 Buka tiap hari, jangan lupa mampir!', captions: ['Promo hari ini diskon 20% semua menu.', 'Menu baru: kopi susu gula aren.'], locationNames: [] },
];

// ---- labels -----------------------------------------------------------------------------------------------
export interface ProfileLabel {
  country: string[];            // acceptable country codes ([] = the right answer is "no country")
  countryAbstainOk: boolean;    // UNKNOWN is acceptable (a miss in value, never a wrong claim)
  reach: Reach[];
  include?: string[][];         // each inner list = alias keys, any one must appear in reachAreas
  noAreas?: boolean;            // reachAreas must be empty
  forbid?: string[];            // alias keys that must not appear in reachAreas
}

export const PROFILE_LABELS: Record<string, ProfileLabel> = {
  // real
  plazaambarrukmo: { country: ['ID'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['yogyakarta', 'sleman']] },
  infoeventjogja: { country: ['ID'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['yogyakarta']] },
  wanitatamajogja: { country: ['ID'], countryAbstainOk: true, reach: ['local', 'regional', 'unspecified'], forbid: ['jakarta'] },
  'pakuwonmall.jogja': { country: ['ID'], countryAbstainOk: true, reach: ['local', 'regional'], include: [['yogyakarta']] },
  chaanakyaekadantaolympiad: { country: ['ID'], countryAbstainOk: true, reach: ['national'], noAreas: true },
  // synthetic
  'syn-dinas-sleman': { country: ['ID'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['sleman']], forbid: ['jakarta'] },
  'syn-telco-nasional': { country: ['ID'], countryAbstainOk: false, reach: ['national'], noAreas: true },
  'syn-kl-hall': { country: ['MY'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['kuala lumpur']] },
  'syn-sg-makers': { country: ['SG'], countryAbstainOk: false, reach: ['local'], include: [['singapore', 'ubi']] },
  'syn-melb-indo': { country: ['AU'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['melbourne']] },
  'syn-delhi-academy': { country: ['IN'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['delhi']] },
  'syn-global-coffee': { country: [], countryAbstainOk: true, reach: ['unspecified'], noAreas: true },
  'syn-empty': { country: [], countryAbstainOk: true, reach: ['unspecified'], noAreas: true },
  'syn-canggu-yoga': { country: ['ID'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['canggu', 'bali']] },
  'syn-johor-sukan': { country: ['MY'], countryAbstainOk: false, reach: ['local', 'regional'], include: [['johor']] },
  'syn-warung-tanpa-kota': { country: ['ID'], countryAbstainOk: true, reach: ['local', 'unspecified'], noAreas: true },
};

function aliasHit(name: string, key: string): boolean {
  const aliases = AREA_ALIASES[key] ?? [key];
  const n = name.normalize('NFKC').toLowerCase();
  return aliases.some((a) => new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(n));
}

export interface ProfileScore {
  countryWrong: boolean;       // a country was claimed and it is not an accepted one — the harmful error
  countryMissed: boolean;      // UNKNOWN where a country was expected and abstaining is not OK
  reachOk: boolean;
  areasOk: boolean;
  nationalWithArea: boolean;   // a national/unspecified account given a place (head-office leak)
  pass: boolean;
  detail: string[];
}

export function scoreProfile(country: string, reach: Reach, areas: Array<{ name: string }>, label: ProfileLabel): ProfileScore {
  const detail: string[] = [];
  const claimed = country !== 'UNKNOWN';
  const countryWrong = claimed && !label.country.includes(country);
  const countryMissed = !claimed && label.country.length > 0 && !label.countryAbstainOk;
  if (countryWrong) detail.push(`country ${country}, expected ${label.country.join('|') || 'UNKNOWN'}`);
  if (countryMissed) detail.push('country UNKNOWN, expected ' + label.country.join('|'));
  const reachOk = label.reach.includes(reach);
  if (!reachOk) detail.push(`reach ${reach}, expected ${label.reach.join('|')}`);
  let areasOk = true;
  for (const group of label.include ?? []) if (!areas.some((a) => group.some((k) => aliasHit(a.name, k)))) { areasOk = false; detail.push(`missing area ${group.join('/')}; got [${areas.map((a) => a.name).join('; ')}]`); }
  for (const k of label.forbid ?? []) if (areas.some((a) => aliasHit(a.name, k))) { areasOk = false; detail.push(`forbidden area ${k}`); }
  if (label.noAreas && areas.length > 0) { areasOk = false; detail.push(`areas invented: [${areas.map((a) => a.name).join('; ')}]`); }
  const nationalWithArea = (reach === 'national' || reach === 'international' || reach === 'unspecified') && areas.length > 0;
  return { countryWrong, countryMissed, reachOk, areasOk, nationalWithArea, pass: !countryWrong && !countryMissed && reachOk && areasOk, detail };
}

export { inferCountryFromSignals };
