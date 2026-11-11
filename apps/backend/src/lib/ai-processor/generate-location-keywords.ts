import type { GeminiEventPayload } from '@festgrid/domain';
import { normalizeCountryCode, normalizeLocationKeywords, normalizeLocationText } from '@festgrid/domain/events';
import type { GeminiCallRequest, GeminiCallResult } from '../ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../../env.js';

/** The keywords call is best-effort and must never hold an extraction hostage: one attempt, this long, then it is given up. */
export const LOCATION_KEYWORDS_TIMEOUT_MS = 10_000;
/** More distinct strings than this in one call are left without keywords (a roundup step already has a per-call event cap). */
export const MAX_LOCATION_STRINGS_PER_CALL = 80;

export type LocationKeywordsCall = (
  request: GeminiCallRequest & { provider: 'gemini'; subscriberUserIds: string[] }
) => Promise<Pick<GeminiCallResult, 'text'>>;

export interface GenerateLocationKeywordsContext {
  /** The gateway call, injected so each caller keeps its own seam (and its own key policy). */
  callGemini: LocationKeywordsCall;
  subscriberUserIds: string[];
  /** The caption while the caller still has it: its hashtags are context for the model. */
  sourceText?: string;
  timeoutMs?: number;
  /** The platform's home country (ISO-2) for the prompt; `null` = none; omitted = read `DEFAULT_COUNTRY_CODE` from the backend env. */
  defaultCountryCode?: string | null;
  /** For the log line only. */
  postId?: string;
}

function buildSystemInstruction(defaultCountryCode: string | null): string {
  const home = defaultCountryCode ? `Most places are in the country with code "${defaultCountryCode}", but ` : '';
  return (
    'For each item, give locationKeywords: 1 to 5 short place names that let someone find the location on a map, ordered from the MOST specific to the most general: ' +
    'first the place as named (venue, building, market, village), then its district, then its city or regency, then optionally the province. ' +
    'Use the location text first; when it does not state the wider area, you may take it from the event name, the hashtags or eventArea, but never invent a place those do not support. ' +
    'Each keyword is ONE place name, never a sentence, never a summary of several places (no "various locations", "berbagai lokasi"). ' +
    `Also give countryCode: the ISO 3166-1 alpha-2 code of the country the place is in. ${home ? home + 'give' : 'Give'} the real country for a place elsewhere, and null when you cannot tell. ` +
    'Return every id.'
  );
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      locationKeywords: { type: 'ARRAY', items: { type: 'STRING' } },
      countryCode: { type: 'STRING', nullable: true },
    },
    required: ['id', 'locationKeywords'],
  },
};

/** One normalized form of a location text, for batching and for matching it against stored rows. */
export function locationStringKey(text: string): string {
  return normalizeLocationText(text);
}

interface Holder {
  locationKeywords?: string[];
  locationCountryCode?: string;
}

interface Entry {
  text: string;
  eventName: string;
  eventArea: string | null;
  holders: Holder[];
}

function collectEntries(events: GeminiEventPayload[]): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const add = (text: string | undefined, holder: Holder, event: GeminiEventPayload) => {
    if (typeof text !== 'string' || text.trim() === '') return;
    const key = locationStringKey(text);
    const existing = entries.get(key);
    if (existing) {
      existing.holders.push(holder);
      return;
    }
    const area = typeof event.location === 'string' && event.location.trim() !== '' && locationStringKey(event.location) !== key ? event.location.trim() : null;
    entries.set(key, { text: text.trim(), eventName: event.eventName, eventArea: area, holders: [holder] });
  };
  for (const event of events) {
    add(event.location, event, event);
    for (const schedule of event.schedules ?? []) {
      add(schedule.location, schedule, event);
    }
  }
  return entries;
}

function applyTo(entry: Entry, keywords: string[] | undefined, countryCode: string | undefined): void {
  for (const holder of entry.holders) {
    // A null or empty value (the validator allows null) counts as not set; each holder gets its own copy of the list.
    if (keywords && !(holder.locationKeywords && holder.locationKeywords.length > 0)) holder.locationKeywords = [...keywords];
    if (countryCode && !holder.locationCountryCode) holder.locationCountryCode = countryCode;
  }
}

/**
 * A string the model gave no country for takes the country most of the call's other strings share: a post is almost always
 * about one country. Needs at least two coded strings and a code held by more than half of them.
 */
function fillCountryFromConsensus(entries: Map<string, Entry>): void {
  const counts = new Map<string, number>();
  let coded = 0;
  for (const entry of entries.values()) {
    const code = entry.holders.find((holder) => holder.locationCountryCode !== undefined)?.locationCountryCode;
    if (code) {
      coded++;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  if (coded < 2) return;
  const [topCode, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCount * 2 <= coded) return;
  for (const entry of entries.values()) applyTo(entry, undefined, topCode);
}

function hashtagsOf(sourceText: string | undefined): string[] {
  if (!sourceText) return [];
  const tags = sourceText.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(tags)].slice(0, 12);
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`location keywords call timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fills `locationKeywords` and the transient `locationCountryCode` on the events' own and schedules' locations from ONE batched,
 * text-only Gemini call over the distinct location strings (spec-location-keywords-extraction). Mutates the events in place.
 *
 * Best-effort by contract: it never throws, a failure, a timeout, a busy or exhausted key or an unusable answer just leaves the
 * affected strings without keywords (today's behavior), and one log line says what happened. The account's default location is never an
 * input: it is wrong for too many accounts to be used as a region.
 */
export async function generateLocationKeywords(events: GeminiEventPayload[], context: GenerateLocationKeywordsContext): Promise<void> {
  const label = context.postId ? `post=${context.postId}` : 'post=unknown';
  try {
    const entries = collectEntries(events);
    if (entries.size === 0) return;

    const sent = [...entries].slice(0, MAX_LOCATION_STRINGS_PER_CALL);
    const skipped = entries.size - sent.length;
    const hashtags = hashtagsOf(context.sourceText);
    const lines = sent.map(([, entry], index) =>
      JSON.stringify({ id: `s${index}`, location: entry.text, event: entry.eventName, eventArea: entry.eventArea, hashtags })
    );

    let answers: unknown;
    try {
      const result = await withTimeout(
        context.callGemini({
          contents: lines.join('\n'),
          systemInstruction: buildSystemInstruction(context.defaultCountryCode === undefined ? loadBackendEnv().defaultCountryCode : context.defaultCountryCode),
          responseSchema: RESPONSE_SCHEMA,
          responseMimeType: 'application/json',
          // Generous floor: a thinking model spends part of this budget before it writes the answer.
          maxOutputTokens: Math.min(8192, 2048 + 200 * sent.length),
          provider: 'gemini',
          subscriberUserIds: context.subscriberUserIds,
        }),
        context.timeoutMs ?? LOCATION_KEYWORDS_TIMEOUT_MS
      );
      answers = JSON.parse(typeof result.text === 'string' ? result.text : '');
    } catch (error) {
      console.warn(`[generateLocationKeywords] ${label} outcome=failed strings=${entries.size} reason=${String(error).slice(0, 160)}`);
      return;
    }

    let answered = 0;
    if (Array.isArray(answers)) {
      const byId = new Map(sent.map(([, entry], index) => [`s${index}`, entry]));
      const done = new Set<string>();
      for (const answer of answers) {
        if (typeof answer !== 'object' || answer === null) continue;
        const { id, locationKeywords, countryCode } = answer as { id?: unknown; locationKeywords?: unknown; countryCode?: unknown };
        if (typeof id !== 'string' || done.has(id)) continue;
        const entry = byId.get(id);
        if (!entry) continue;
        done.add(id);
        const keywords = normalizeLocationKeywords(locationKeywords);
        const code = normalizeCountryCode(countryCode);
        if (keywords || code) answered++;
        applyTo(entry, keywords, code);
      }
    }
    fillCountryFromConsensus(entries);
    const outcome = answered === 0 ? 'failed' : answered < entries.size ? 'partial' : 'ok';
    console.info(
      `[generateLocationKeywords] ${label} outcome=${outcome} strings=${entries.size} sent=${sent.length} answered=${answered}` +
        (skipped > 0 ? ` skipped=${skipped}` : '')
    );
  } catch (error) {
    // Defensive: a bug here must never fail an extraction.
    console.warn(`[generateLocationKeywords] ${label} outcome=failed reason=${String(error).slice(0, 160)}`);
  }
}
