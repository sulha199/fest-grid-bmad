// SUPERSEDED by arms-placement.ts (2026-11-21): same facts addendum, but with the placement as a factor and tidy numbering. Kept for history; ab-highlight.ts no longer imports it.
// POC arms for composing the highlight in code from typed fields (throwaway; nothing under apps/ or packages/ is modified).
//   A  production prompt and schema, unchanged (control).
//   F  facts : A + event-level prizes[], promos[], inclusions[], isFree. No highlight text is requested; performers already exist on schedules.
//   G  facts + stage : F + the schedule `stage` enum of arms-stage.ts (the two additions together, as they would ship in one call).
// Tiers are deliberately NOT in these arms (findings 10.2: not ready), so there is no originalPrice; a discount percentage from two prices waits for tiers.
import { stageArmRequest } from './arms-stage.ts';

export const PRIZE_KINDS = ['MONEY', 'ITEM', 'SCHOLARSHIP', 'DOORPRIZE', 'CERTIFICATE', 'OTHER'] as const;
export const PROMO_KINDS = ['PERCENT_OFF', 'AMOUNT_OFF', 'BUY_GET', 'FREE_ITEM', 'BUNDLE', 'CASHBACK', 'OTHER'] as const;

export const ADDENDUM_F = `WHAT MAKES THIS EVENT WORTH ATTENDING (additional per-event fields; apply them to each event in the events array, and leave a field absent when the source states nothing for it):
12. prizes: one entry per prize or prize pool for THIS event that the source states with an amount or a named item. kind is MONEY (cash, prize pool), ITEM (a named physical or experience prize), SCHOLARSHIP, DOORPRIZE, CERTIFICATE or OTHER. value is the amount or item exactly as written in the source ("Rp 50.000.000", "1 unit motor", "Jutaan rupiah" is NOT enough: leave it out unless an amount or a named item is given). isTotal is true when the source calls it the total or the pool. evidence is the exact source text (at most 120 characters) it is based on. Vague claims ("hadiah menarik", "banyak hadiah", "door prize melimpah") are never entries.
13. promos: one entry per discount or promotion for THIS event (a price cut, buy-one-get-one, a free item with purchase, a bundle price, cashback). kind is PERCENT_OFF, AMOUNT_OFF, BUY_GET, FREE_ITEM, BUNDLE, CASHBACK or OTHER. value is the offer exactly as written ("50%", "Rp 25.000", "Beli 1 Gratis 1"). conditions is a short copy of any stated condition (minimum purchase, payment method, "khusus pelajar"), at most 80 characters, absent when none. evidence is the exact source text (at most 120 characters). A normal ticket or entry price is NOT a promo. Never compute a percentage that is not written in the source.
14. inclusions: what a participant or buyer receives for the price or registration, as short phrases copied from the source (for example "Jersey", "Medali", "Goodie bag", "Tiket 28 wahana"); at most 6 entries, each at most 40 characters; leave absent when the source lists none.
15. isFree: true only when the source states that attending or taking part costs nothing ("Gratis", "Free entry", "Free registration" for the event itself); omit it otherwise. A free sub-item of a paid event does not make the event free.
Never write a phone number, email address, link or personal name into any of these fields.

`;

const PRIZE_ITEM = { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: [...PRIZE_KINDS] }, value: { type: 'STRING' }, isTotal: { type: 'BOOLEAN' }, evidence: { type: 'STRING' } }, required: ['kind', 'value'] };
const PROMO_ITEM = { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: [...PROMO_KINDS] }, value: { type: 'STRING' }, conditions: { type: 'STRING' }, evidence: { type: 'STRING' } }, required: ['kind', 'value'] };
const MARKER = 'Strictly adhere to the provided JSON schema.';

export type HighlightArm = 'A' | 'F' | 'G';
export function highlightArmRequest(arm: HighlightArm, request: any) {
  if (arm === 'A') return request;
  const base = arm === 'G' ? stageArmRequest('D', request) : request; // D = production + stage (required); G adds F on top
  const r = structuredClone(base);
  const ev = r.responseSchema.properties.events.items.properties;
  ev.prizes = { type: 'ARRAY', items: PRIZE_ITEM };
  ev.promos = { type: 'ARRAY', items: PROMO_ITEM };
  ev.inclusions = { type: 'ARRAY', items: { type: 'STRING' } };
  ev.isFree = { type: 'BOOLEAN' };
  if (!r.systemInstruction.includes(MARKER)) throw new Error('prompt marker moved: update the POC');
  r.systemInstruction = r.systemInstruction.replace(MARKER, ADDENDUM_F + MARKER);
  return r;
}
