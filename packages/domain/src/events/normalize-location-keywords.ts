/** At most this many keywords are kept (most specific first), the rest are dropped. */
export const MAX_LOCATION_KEYWORDS = 5;
/** A keyword longer than this is not a place name (a sentence, a caption fragment) and is dropped. */
export const MAX_LOCATION_KEYWORD_LENGTH = 80;

/** Words that say "there is no place here" rather than name one. Compared case-insensitively against the whole keyword. */
const GENERIC_KEYWORDS = new Set([
  'lokasi',
  'location',
  'locations',
  'tempat',
  'place',
  'places',
  'venue',
  'venues',
  'tba',
  'tbc',
  'tbd',
  'online',
  'daring',
  'to be announced',
  'akan diumumkan',
  'zoom',
  'virtual',
  'via zoom',
  'google meet',
  'lokasi tba',
  'location tba',
  'see caption',
  'lihat caption',
  'cek caption',
  '-',
  'n/a',
]);

/**
 * "Berbagai lokasi di Kabupaten Sleman", "various locations", "beberapa tempat": a summary of several places, not one place a
 * geocoder or a map search can find. The model wrote exactly this for a flyer with a different place per date.
 */
const SUMMARY_OF_PLACES = /^(berbagai|beberapa|banyak|multiple|various|several|many|different)\s+(lokasi|tempat|venues?|locations?|places?)\b/i;

/**
 * Normalizes the `locationKeywords` Gemini returns for a schedule or an event (the single place these rules live): ordered from
 * the most specific place name to the most general one ("Pasar Porosjayan", "Gamping", "Sleman"), used later as deterministic
 * search input for the geocoder and the map link.
 *
 * Trims, drops empty and generic entries (see `GENERIC_KEYWORDS`, `SUMMARY_OF_PLACES`) and over-long ones, removes
 * case-insensitive duplicates keeping the first, keeps the first `MAX_LOCATION_KEYWORDS`. Returns `undefined` when nothing is
 * left (never an empty array) so "no keywords" has one shape everywhere.
 */
export function normalizeLocationKeywords(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const seen = new Set<string>();
  const kept: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    // NFC so two spellings of one accented name de-duplicate; zero-width characters are invisible, so they never make an entry.
    const keyword = item.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
    if (keyword === '' || keyword.length > MAX_LOCATION_KEYWORD_LENGTH) continue;
    const key = keyword.toLowerCase();
    if (GENERIC_KEYWORDS.has(key) || SUMMARY_OF_PLACES.test(keyword)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(keyword);
    if (kept.length === MAX_LOCATION_KEYWORDS) break;
  }

  return kept.length > 0 ? kept : undefined;
}

/**
 * Cleans the `locationKeywords` of a parsed Gemini response IN PLACE, before schema validation: an optional, advisory field must
 * never fail the whole extraction. A non-array value is removed, and non-string items are filtered out of an array (a null in
 * the list would otherwise make the strict validator reject every event of the post). Leaves the rest of the payload alone.
 */
export function stripMalformedLocationKeywords(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null) return;
  const events = (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return;
  const clean = (holder: unknown): void => {
    if (typeof holder !== 'object' || holder === null) return;
    const record = holder as { locationKeywords?: unknown; locationCountryCode?: unknown };
    if ('locationCountryCode' in record && record.locationCountryCode !== null && typeof record.locationCountryCode !== 'string') {
      delete record.locationCountryCode;
    }
    if (!('locationKeywords' in record) || record.locationKeywords === null || record.locationKeywords === undefined) return;
    if (Array.isArray(record.locationKeywords)) {
      record.locationKeywords = record.locationKeywords.filter((item) => typeof item === 'string');
    } else {
      delete record.locationKeywords;
    }
  };
  for (const event of events) {
    clean(event);
    const schedules = (event as { schedules?: unknown } | null)?.schedules;
    if (Array.isArray(schedules)) schedules.forEach(clean);
  }
}

/** Two letters that are not a country: placeholders and organisations models emit when they cannot place something. */
const NOT_A_COUNTRY = new Set(['XX', 'ZZ', 'UN', 'EU']);

/**
 * ISO 3166-1 alpha-2 (two letters), uppercased; anything else (a name, "unknown", an empty string, a placeholder such as "XX")
 * is `undefined`. "UK", which models commonly write for the United Kingdom, is read as its ISO code "GB".
 */
export function normalizeCountryCode(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || NOT_A_COUNTRY.has(code)) return undefined;
  return code === 'UK' ? 'GB' : code;
}

/** One normalized form of a location text (NFC, collapsed whitespace, trimmed, lower-cased) for "is this the same text" checks. */
export function normalizeLocationText(text: string | null | undefined): string {
  return (text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}
