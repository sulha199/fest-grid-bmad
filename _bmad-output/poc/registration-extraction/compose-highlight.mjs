// POC: composes the card highlight in code from typed event fields. Pure functions, no I/O.
// Input: one extracted event {eventName, types[], schedules[{performers[], ticketPrice}], prizes[], promos[], inclusions[], isFree}.
// Output: {text, kind, source} or null. Order of candidates depends on the event type; the first candidate that passes the checks wins.
const MAX = 40;
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cut = (s) => (s.length <= MAX ? s : null); // a candidate that does not fit is skipped, never truncated mid-phrase
const hasAmountOrName = (v) => /\d/.test(v) || /[A-Za-z]{3,}/.test(v);
const VAGUE = /(menarik|melimpah|banyak|jutaan|ribuan|berhadiah|hadiah total jutaan|surprise|mystery)/i;

export function parseAmount(text) {
  // "Rp 50.000.000", "50 juta", "10jt", "100rb", "Rp1,5 juta"; returns a number of rupiah or null
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

const prizeCandidate = (e) => {
  const ps = (e.prizes ?? []).filter((p) => p?.value && hasAmountOrName(clean(p.value)) && !VAGUE.test(clean(p.value)));
  if (!ps.length) return null;
  const rank = (p) => (p.kind === 'MONEY' ? 3 : p.kind === 'SCHOLARSHIP' ? 2 : p.kind === 'ITEM' ? 2 : p.kind === 'DOORPRIZE' ? 1 : 0);
  const best = [...ps].filter((p) => rank(p) > 0).sort((a, b) => (b.isTotal ? 1 : 0) - (a.isTotal ? 1 : 0) || rank(b) - rank(a) || (parseAmount(b.value) ?? 0) - (parseAmount(a.value) ?? 0))[0];
  if (!best) return null;
  const v = clean(best.value);
  const label = best.kind === 'MONEY' ? (best.isTotal ? 'Total hadiah' : 'Hadiah') : best.kind === 'SCHOLARSHIP' ? 'Beasiswa' : best.kind === 'DOORPRIZE' ? 'Doorprize' : 'Hadiah';
  const text = cut(`${label} ${v}`);
  return text ? { text, kind: 'PRIZE', source: 'prizes' } : null;
};
const performerCandidate = (e) => {
  const names = [...new Set((e.schedules ?? []).flatMap((s) => (s.performers ?? []).map(clean)).filter(Boolean))];
  if (!names.length) return null;
  const shown = names.slice(0, 2).join(', '); const more = names.length > 2 ? ` +${names.length - 2}` : '';
  const text = cut(`Penampil: ${shown}${more}`) ?? cut(`Penampil: ${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}`);
  return text ? { text, kind: 'PERFORMERS', source: 'schedules.performers' } : null;
};
const promoCandidate = (e) => {
  const ps = (e.promos ?? []).filter((p) => p?.value && hasAmountOrName(clean(p.value)));
  if (!ps.length) return null;
  const rank = (p) => ({ PERCENT_OFF: 5, BUY_GET: 4, AMOUNT_OFF: 3, FREE_ITEM: 3, BUNDLE: 2, CASHBACK: 2, OTHER: 1 }[p.kind] ?? 0);
  const best = [...ps].sort((a, b) => rank(b) - rank(a) || (parseFloat(String(b.value).replace(/\D/g, '')) || 0) - (parseFloat(String(a.value).replace(/\D/g, '')) || 0))[0];
  const v = clean(best.value);
  const withWord = (w) => (new RegExp(`^${w}`, 'i').test(v) ? v : `${w} ${v}`);
  const text = cut(best.kind === 'PERCENT_OFF' ? withWord('Diskon') : best.kind === 'AMOUNT_OFF' ? withWord('Potongan') : best.kind === 'FREE_ITEM' ? withWord('Gratis') : best.kind === 'CASHBACK' ? withWord('Cashback') : best.kind === 'BUNDLE' ? withWord('Paket') : v);
  return text ? { text, kind: 'DISCOUNT', source: 'promos' } : null;
};
const freeCandidate = (e) => {
  if (e.isFree !== true) return null;
  const priced = (e.schedules ?? []).some((s) => s.ticketPrice && !/^\s*(gratis|free|0|rp\.?\s*0)\b/i.test(String(s.ticketPrice))); // a stated price elsewhere contradicts "free"
  return priced ? null : { text: 'Gratis', kind: 'FREE', source: 'isFree' };
};
const inclusionCandidate = (e) => {
  const xs = (e.inclusions ?? []).map(clean).filter((x) => x && !VAGUE.test(x));
  if (!xs.length) return null;
  for (const n of [3, 2, 1]) { const t = cut(`Termasuk ${xs.slice(0, n).join(', ')}`); if (t) return { text: t, kind: 'BENEFIT', source: 'inclusions' }; }
  return null;
};

export function composeHighlight(e) {
  const types = new Set(e.types ?? []);
  const perf = types.has('PERFORMANCE') || types.has('FESTIVAL') || types.has('MARKET') || types.has('GATHERING');
  const order = types.has('COMPETITION') ? [prizeCandidate, promoCandidate, performerCandidate, freeCandidate, inclusionCandidate]
    : types.has('PROMOTION') ? [promoCandidate, prizeCandidate, freeCandidate, inclusionCandidate, performerCandidate]
    : perf ? [performerCandidate, prizeCandidate, promoCandidate, freeCandidate, inclusionCandidate]
    : [prizeCandidate, promoCandidate, performerCandidate, freeCandidate, inclusionCandidate];
  for (const f of order) { const r = f(e); if (r) return r; }
  return null;
}
