// POC: the code side of the tier call. Pure functions, no I/O.
// The model returns EVERY priced option it finds in a post (even a single price); whether those become tiers is decided here, so the
// "at least two distinct prices" rule does not depend on the model following an instruction (findings 10.2: it did not, reliably).


export const AUDIENCES = ['PUBLIC', 'STUDENT', 'CHILD', 'MEMBER', 'LOCAL_RESIDENT', 'GROUP', 'OTHER'];
export const KINDS = ['CATEGORY', 'TIME_WINDOW', 'OTHER'];
const FREE = /^\s*(gratis|free|0|rp\.?\s*0|idr\s*0)\s*$/i;

/** Amount in rupiah for a price written as in the source: 0 for free, null when no number can be read.
 *  Reads the LEADING amount only: the model sometimes lets a price string run on into neighbouring text ("Rp 30.000t", "Rp20.000peserta"). */
export function amountOf(price) {
  if (typeof price === "number") return Number.isFinite(price) ? price : null;
  const p = String(price ?? "").trim();
  if (!p) return null;
  if (FREE.test(p) || /^(gratis|free)\b/i.test(p)) return 0;
  const m = /(?:rp|idr)?\s*\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(?:\s*(juta|jt|ribu|rb|k)(?![a-z]))?/i.exec(p);
  if (!m) return null;
  const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(m[1]);
  let v = grouped ? parseFloat(m[1].replace(/[.,]/g, "")) : parseFloat(m[1].replace(",", "."));
  const u = (m[2] ?? "").toLowerCase();
  if (u === "juta" || u === "jt") v *= 1e6; else if (u === "ribu" || u === "rb" || u === "k") v *= 1e3;
  return Number.isNaN(v) ? null : v;
}

/**
 * options: [{label, kind, audience, conditions, price, opensOn, closesOn, evidence}]
 * Returns {emit, tiers, amounts, fromPrice, freePublic}.
 *  emit       : tiers are produced only when at least two DISTINCT amounts exist (a single price, or the same price repeated, stays a plain ticket price).
 *  fromPrice  : the lowest positive amount among PUBLIC options. A student, child, member or resident price never sets the "from" price.
 *  freePublic : a PUBLIC option costs nothing (an event can be free for the audience and paid for participants).
 */
export function decideTiers(options) {
  const rows = (options ?? []).map((o) => ({ ...o, amount: amountOf(o.price) }));
  const amounts = [...new Set(rows.filter((r) => r.amount !== null).map((r) => r.amount))].sort((a, b) => a - b);
  const publicAmounts = rows.filter((r) => (r.audience ?? 'PUBLIC') === 'PUBLIC' && r.amount !== null).map((r) => r.amount);
  const positive = publicAmounts.filter((a) => a > 0);
  return {
    emit: amounts.length >= 2,
    tiers: amounts.length >= 2 ? rows : [],
    amounts,
    fromPrice: positive.length ? Math.min(...positive) : null,
    freePublic: publicAmounts.includes(0),
  };
}

export const GENERAL = 'GENERAL';

/**
 * Tiers are decided inside ONE event. options carry `event` (an event name given to the model, or GENERAL when the price applies to the whole post).
 * A GENERAL option counts for every event. Returns one entry per event name: {event, emit, tiers, amounts, fromPrice, freePublic}.
 * An option whose `event` is not in the list is treated as GENERAL (the model is told to choose from the list; this keeps a stray value from vanishing).
 */
export function decideTiersPerEvent(options, eventNames) {
  const names = eventNames ?? [];
  const general = (options ?? []).filter((o) => !names.includes(o.event) || o.event === GENERAL);
  return names.map((name) => {
    const own = (options ?? []).filter((o) => o.event === name);
    return { event: name, ...decideTiers([...own, ...general]) };
  });
}
