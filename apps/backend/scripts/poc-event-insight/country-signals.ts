/**
 * POC (pure, no I/O): infer which COUNTRY an account operates in from what the initial profile scrape
 * already returns — name, bio, business category, link, recent post captions and location tags — with
 * deterministic, explainable signals. No model is involved, so it can be unit-tested exhaustively and used
 * as the cross-check on a model's answer (profile-insight.ts).
 *
 * LANGUAGE IS NOT A SIGNAL, deliberately. Indonesian is written by communities in Malaysia and Australia,
 * Malay and Indonesian look alike, and English is everywhere; a language guess is how a Melbourne
 * community ends up pinned in Indonesia. Only concrete markers count:
 *
 *   strong (2): phone number / calling code · time-zone abbreviation (WIB, MYT, AEST…) · a currency with
 *               an amount (Rp 50.000, RM25, S$20, A$15, ₹500) · a country-code domain (.co.id, .my, .sg)
 *               · Indonesian address abbreviations (Jl., Kab., Kec., Kel.)
 *   weak   (1): a named place that belongs to one country (Yogyakarta, Kuala Lumpur, Melbourne…) · a
 *               country name ("Indonesia", "Malaysia")
 *
 * Each KIND of signal counts once per country (twelve captions with "Rp" are one currency signal, not
 * twelve), so a chatty account cannot out-vote a quiet one. A country is resolved when its score is at least
 * 2 and at least 2 ahead of the runner-up; otherwise the answer is "unresolved", never a guess.
 */

export interface ProfileText {
  username: string;
  displayName: string;
  biography: string;
  businessCategoryName?: string | null;
  externalUrl?: string | null;
  captions: string[];
  locationNames: string[];
}

export type SignalKind = 'phone' | 'timezone' | 'currency' | 'domain' | 'address' | 'place' | 'country-name';
export interface Signal { country: string; kind: SignalKind; strength: 1 | 2; evidence: string }

export type CountryDecision =
  | { status: 'resolved'; country: string; score: number; signals: Signal[] }
  | { status: 'unresolved'; reason: 'no-signal' | 'weak' | 'conflict'; signals: Signal[] };

interface Rule { country: string; kind: SignalKind; strength: 1 | 2; re: RegExp }

const NOT_DIGIT_BEFORE = '(?<![\\d])';
const RULES: Rule[] = [
  // ---- phone numbers / calling codes
  { country: 'ID', kind: 'phone', strength: 2, re: new RegExp(`${NOT_DIGIT_BEFORE}(?:\\+62[\\s-]?\\d|08\\d{2}[\\s-]?\\d{3,4}[\\s-]?\\d{3,4}\\b)`) },
  { country: 'MY', kind: 'phone', strength: 2, re: new RegExp(`${NOT_DIGIT_BEFORE}\\+60[\\s-]?\\d`) },
  { country: 'SG', kind: 'phone', strength: 2, re: new RegExp(`${NOT_DIGIT_BEFORE}\\+65[\\s-]?\\d`) },
  { country: 'AU', kind: 'phone', strength: 2, re: new RegExp(`${NOT_DIGIT_BEFORE}\\+61[\\s-]?\\d`) },
  { country: 'IN', kind: 'phone', strength: 2, re: new RegExp(`${NOT_DIGIT_BEFORE}\\+91[\\s-]?\\d`) },
  // ---- time-zone abbreviations (case-sensitive: WIT/IST are ordinary words in lower case)
  { country: 'ID', kind: 'timezone', strength: 2, re: /\b(?:WIB|WITA|WIT)\b/ },
  { country: 'MY', kind: 'timezone', strength: 2, re: /\bMYT\b/ },
  { country: 'SG', kind: 'timezone', strength: 2, re: /\bSGT\b/ },
  { country: 'AU', kind: 'timezone', strength: 2, re: /\b(?:AEST|AEDT|ACST|AWST)\b/ },
  { country: 'IN', kind: 'timezone', strength: 1, re: /\bIST\b/ }, // also Irish / Israel standard time: weak
  // ---- currency WITH an amount
  { country: 'ID', kind: 'currency', strength: 2, re: /\b(?:Rp\.?|IDR)\s?\d/ },
  { country: 'MY', kind: 'currency', strength: 2, re: /\b(?:RM|MYR)\s?\d/ },
  { country: 'SG', kind: 'currency', strength: 2, re: /\b(?:S\$|SGD)\s?\d/ },
  { country: 'AU', kind: 'currency', strength: 2, re: /\b(?:A\$|AUD)\s?\d/ },
  { country: 'IN', kind: 'currency', strength: 2, re: /(?:₹|\bINR)\s?\d/ },
  // ---- Indonesian address abbreviations ("Jalan" alone is also Malay, so it is not used)
  { country: 'ID', kind: 'address', strength: 2, re: /\b(?:Jl|Jln|Kab|Kec|Kel)\.\s?[A-Za-z0-9]/ },
  // ---- places that belong to exactly one country
  { country: 'ID', kind: 'place', strength: 1, re: /\b(?:yogyakarta|jogja|sleman|bantul|jakarta|bandung|surabaya|semarang|surakarta|malang|denpasar|bali|canggu|ubud|medan|makassar|kupang|flores|kartasura)\b/i },
  { country: 'MY', kind: 'place', strength: 1, re: /\b(?:kuala lumpur|selangor|penang|johor|petaling jaya|putrajaya|kota kinabalu)\b/i },
  { country: 'AU', kind: 'place', strength: 1, re: /\b(?:melbourne|sydney|brisbane|perth|adelaide|canberra)\b/i },
  { country: 'IN', kind: 'place', strength: 1, re: /\b(?:delhi|mumbai|bengaluru|bangalore|chennai|kolkata|hyderabad)\b/i },
  // ---- country names (also inside "Universitas Indonesia", so weak)
  { country: 'ID', kind: 'country-name', strength: 1, re: /\bindonesia\b/i },
  { country: 'MY', kind: 'country-name', strength: 1, re: /\bmalaysia\b/i },
  { country: 'SG', kind: 'country-name', strength: 1, re: /\b(?:singapore|singapura)\b/i },
  { country: 'AU', kind: 'country-name', strength: 1, re: /\baustralia\b/i },
  { country: 'IN', kind: 'country-name', strength: 1, re: /\bindia\b/i },
];

const TLD: Array<{ country: string; re: RegExp }> = [
  { country: 'ID', re: /\.id$/ },
  { country: 'MY', re: /\.my$/ },
  { country: 'SG', re: /\.sg$/ },
  { country: 'AU', re: /\.au$/ },
  { country: 'IN', re: /\.in$/ },
];

function hostsOf(text: string): string[] {
  const hosts: string[] = [];
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:[\w.-]+@)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|\b)/gi)) hosts.push(m[1].toLowerCase());
  return hosts;
}

function textsOf(p: ProfileText): string[] {
  return [p.username, p.displayName, p.biography, p.businessCategoryName ?? '', p.externalUrl ?? '', ...p.captions, ...p.locationNames].filter((t) => t.trim() !== '');
}

export function collectSignals(p: ProfileText): Signal[] {
  const found = new Map<string, Signal>(); // one per (country, kind)
  const add = (s: Signal) => { const k = `${s.country}|${s.kind}`; if (!found.has(k)) found.set(k, s); };
  for (const t of textsOf(p)) {
    const text = t.normalize('NFKC');
    for (const r of RULES) {
      const m = r.re.exec(text);
      if (m) add({ country: r.country, kind: r.kind, strength: r.strength, evidence: text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12).replace(/\s+/g, ' ').trim() });
    }
  }
  // country-code domains: the profile link and any e-mail/URL in the bio or captions
  for (const t of [p.externalUrl ?? '', p.biography, ...p.captions]) {
    for (const host of hostsOf(t)) {
      for (const { country, re } of TLD) {
        if (re.test(host)) add({ country, kind: 'domain', strength: 2, evidence: host });
      }
    }
  }
  return [...found.values()];
}

export function inferCountryFromSignals(p: ProfileText): CountryDecision {
  const signals = collectSignals(p);
  if (signals.length === 0) return { status: 'unresolved', reason: 'no-signal', signals };
  const scores = new Map<string, number>();
  for (const s of signals) scores.set(s.country, (scores.get(s.country) ?? 0) + s.strength);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, second] = [ranked[0], ranked[1]];
  if (top[1] < 2) return { status: 'unresolved', reason: 'weak', signals };
  if (second && top[1] - second[1] < 2) return { status: 'unresolved', reason: 'conflict', signals };
  return { status: 'resolved', country: top[0], score: top[1], signals };
}
