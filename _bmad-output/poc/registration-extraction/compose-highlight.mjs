// POC: composes the card highlight in code from typed event fields, with a rule set PER EVENT TYPE. Pure functions, no I/O.
// Input: one extracted event {eventName, types[], schedules[{performers[], ticketPrice}], prizes[], promos[], inclusions[], isFree}.
// Output: {text, kind, source, type} or null. What makes a stranger care differs by type: a concert is its performers, a seminar its speakers and
// what you take home, a competition its prize, a promotion its discount, a market or exhibition its free entry. Each type has an ordered ladder of
// candidates and its own wording; the first candidate that exists and fits 40 characters wins. A candidate that does not fit is skipped, never cut.
const MAX = 40;
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cut = (s) => (s.length <= MAX ? s : null);
const hasAmountOrName = (v) => /\d/.test(v) || /[A-Za-z]{3,}/.test(v);
const VAGUE = /(menarik|melimpah|banyak|jutaan|ribuan|berhadiah|surprise|mystery)/i;

export function parseAmount(text) {
  // "Rp 50.000.000", "50 juta", "10jt", "100rb", "Rp1,5 juta"; a number of rupiah or null
  const t = String(text).toLowerCase().replace(/rp\.?\s*/g, '').trim();
  const m = /(\d+(?:[.,]\d+)*)\s*(juta|jt|ribu|rb|k|miliar|m)?\b/.exec(t);
  if (!m) return null;
  let n = m[1];
  const unit = m[2];
  if (unit) n = n.replace(/\./g, '').replace(',', '.'); else n = n.replace(/\./g, '').replace(/,/g, '');
  let v = parseFloat(n);
  if (Number.isNaN(v)) return null;
  if (unit === 'juta' || unit === 'jt') v *= 1e6; else if (unit === 'ribu' || unit === 'rb' || unit === 'k') v *= 1e3; else if (unit === 'miliar' || unit === 'm') v *= 1e9;
  return v;
}

/**
 * The rules, one row per event type. ladder = candidate kinds in order. people = how performers are named for this type (the same field holds
 * speakers, instructors or artists). free = wording when the event is free. includes = lead-in for the "what you receive" list. prizeRank = which prize
 * kinds may headline this type (higher first; absent = not allowed). The type precedence below picks the row for an event with several types.
 */
export const TYPE_RULES = {
  PROMOTION:   { ladder: ['promo', 'prize', 'inclusions', 'free'],                    people: 'Bintang tamu', free: 'Gratis',             includes: 'Gratis',         prizeRank: { ITEM: 3, MONEY: 2, DOORPRIZE: 3 } },
  COMPETITION: { ladder: ['prize', 'free', 'inclusions', 'promo'],                    people: 'Juri',         free: 'Pendaftaran gratis', includes: 'Peserta dapat',  prizeRank: { MONEY: 4, ITEM: 3, SCHOLARSHIP: 3 } }, // a doorprize or a certificate alone is a side perk, not the headline
  PERFORMANCE: { ladder: ['performers', 'promo', 'free', 'prize', 'inclusions'],       people: 'Penampil',     free: 'Gratis masuk',       includes: 'Termasuk',       prizeRank: { MONEY: 2, ITEM: 2, DOORPRIZE: 3 } },
  SEMINAR:     { ladder: ['performers', 'inclusions', 'free', 'promo', 'prize'],       people: 'Pembicara',    free: 'Gratis',             includes: 'Dapat',          prizeRank: { CERTIFICATE: 3, SCHOLARSHIP: 3, ITEM: 2, DOORPRIZE: 2, MONEY: 1 } },
  WORKSHOP:    { ladder: ['inclusions', 'performers', 'free', 'promo', 'prize'],       people: 'Instruktur',   free: 'Gratis',             includes: 'Sudah termasuk', prizeRank: { CERTIFICATE: 3, ITEM: 2, DOORPRIZE: 2 } },
  FUNDRAISER:  { ladder: ['performers', 'prize', 'inclusions', 'promo', 'free'],       people: 'Penampil',     free: 'Gratis masuk',       includes: 'Termasuk',       prizeRank: { ITEM: 3, MONEY: 2, DOORPRIZE: 2 } },
  FESTIVAL:    { ladder: ['performers', 'free', 'promo', 'prize', 'inclusions'],       people: 'Lineup',       free: 'Gratis masuk',       includes: 'Termasuk',       prizeRank: { MONEY: 2, ITEM: 2, DOORPRIZE: 3 } },
  EXHIBITION:  { ladder: ['free', 'performers', 'promo', 'inclusions', 'prize'],       people: 'Seniman',      free: 'Gratis masuk',       includes: 'Termasuk',       prizeRank: { DOORPRIZE: 2, ITEM: 2 } },
  MARKET:      { ladder: ['free', 'promo', 'prize', 'performers', 'inclusions'],       people: 'Hiburan',      free: 'Gratis masuk',       includes: 'Termasuk',       prizeRank: { DOORPRIZE: 4, ITEM: 3, MONEY: 2 } },
  CIVIC:       { ladder: ['free', 'performers', 'inclusions'],                         people: 'Narasumber',   free: 'Gratis',             includes: 'Dapat',          prizeRank: {} },
  GATHERING:   { ladder: ['free', 'performers', 'prize', 'promo', 'inclusions'],       people: 'Bersama',      free: 'Gratis masuk',       includes: 'Termasuk',       prizeRank: { DOORPRIZE: 4, ITEM: 3, MONEY: 2 } },
  OTHER:       { ladder: ['prize', 'promo', 'performers', 'free', 'inclusions'],       people: 'Penampil',     free: 'Gratis',             includes: 'Termasuk',       prizeRank: { MONEY: 4, ITEM: 3, SCHOLARSHIP: 3, DOORPRIZE: 2, CERTIFICATE: 1 } },
};
/** First of these present in an event's types decides its rule row (an event can carry several types). */
export const TYPE_PRECEDENCE = ['PROMOTION', 'COMPETITION', 'PERFORMANCE', 'SEMINAR', 'WORKSHOP', 'FUNDRAISER', 'FESTIVAL', 'EXHIBITION', 'MARKET', 'CIVIC', 'GATHERING', 'OTHER'];
export const ruleTypeOf = (types) => TYPE_PRECEDENCE.find((t) => (types ?? []).includes(t)) ?? 'OTHER';

const candidates = {
  prize: (e, R) => {
    const ps = (e.prizes ?? []).filter((p) => p?.value && hasAmountOrName(clean(p.value)) && !VAGUE.test(clean(p.value)) && (R.prizeRank[p.kind] ?? 0) > 0);
    if (!ps.length) return null;
    const best = [...ps].sort((a, b) => (b.isTotal ? 1 : 0) - (a.isTotal ? 1 : 0) || R.prizeRank[b.kind] - R.prizeRank[a.kind] || (parseAmount(b.value) ?? 0) - (parseAmount(a.value) ?? 0))[0];
    const v = clean(best.value);
    if (best.kind === 'CERTIFICATE') { const t = cut(/sertifikat|certificate/i.test(v) ? `Dapat ${v}` : `Dapat sertifikat ${v}`); return t ? { text: t, kind: 'BENEFIT', source: 'prizes' } : null; }
    const label = best.kind === 'MONEY' ? (best.isTotal ? 'Total hadiah' : 'Hadiah') : best.kind === 'SCHOLARSHIP' ? 'Beasiswa' : best.kind === 'DOORPRIZE' ? 'Doorprize' : 'Hadiah';
    const text = cut(`${label} ${v}`);
    return text ? { text, kind: 'PRIZE', source: 'prizes' } : null;
  },
  performers: (e, R) => {
    const names = [...new Set((e.schedules ?? []).flatMap((s) => (s.performers ?? []).map(clean)).filter(Boolean))];
    if (!names.length) return null;
    const lead = `${R.people}: `;
    for (const shown of [2, 1]) {
      const rest = names.length - shown;
      const text = cut(`${lead}${names.slice(0, shown).join(', ')}${rest > 0 ? ` +${rest}` : ''}`);
      if (text) return { text, kind: 'PERFORMERS', source: 'schedules.performers' };
    }
    return null;
  },
  promo: (e) => {
    const ps = (e.promos ?? []).filter((p) => p?.value && hasAmountOrName(clean(p.value)));
    if (!ps.length) return null;
    const rank = (p) => ({ PERCENT_OFF: 5, BUY_GET: 4, AMOUNT_OFF: 3, FREE_ITEM: 3, BUNDLE: 2, CASHBACK: 2, OTHER: 1 }[p.kind] ?? 0);
    const best = [...ps].sort((a, b) => rank(b) - rank(a) || (parseFloat(String(b.value).replace(/\D/g, '')) || 0) - (parseFloat(String(a.value).replace(/\D/g, '')) || 0))[0];
    const v = clean(best.value);
    const withWord = (w) => (new RegExp(`^${w}`, 'i').test(v) ? v : `${w} ${v}`);
    const text = cut(best.kind === 'PERCENT_OFF' ? withWord('Diskon') : best.kind === 'AMOUNT_OFF' ? withWord('Potongan') : best.kind === 'FREE_ITEM' ? withWord('Gratis') : best.kind === 'CASHBACK' ? withWord('Cashback') : best.kind === 'BUNDLE' ? withWord('Paket') : v);
    return text ? { text, kind: 'DISCOUNT', source: 'promos' } : null;
  },
  free: (e, R) => {
    if (e.isFree !== true) return null;
    const priced = (e.schedules ?? []).some((s) => s.ticketPrice && !/^\s*(gratis|free|0|rp\.?\s*0)\b/i.test(String(s.ticketPrice))); // a stated price elsewhere contradicts "free"
    return priced ? null : { text: R.free, kind: 'FREE', source: 'isFree' };
  },
  inclusions: (e, R) => {
    const xs = (e.inclusions ?? []).map(clean).filter((x) => x && !VAGUE.test(x));
    if (!xs.length) return null;
    for (const n of [3, 2, 1]) { const t = cut(`${R.includes} ${xs.slice(0, n).join(', ')}`); if (t) return { text: t, kind: 'BENEFIT', source: 'inclusions' }; }
    return null;
  },
};

export function composeHighlight(e) {
  const type = ruleTypeOf(e.types);
  const R = TYPE_RULES[type];
  for (const name of R.ladder) {
    const hit = candidates[name](e, R);
    if (hit) return { ...hit, type };
  }
  return null;
}
