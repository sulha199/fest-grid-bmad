// POC arms with a PLACEMENT factor (throwaway; nothing under apps/ or packages/ is modified; the production builder is called as is and its
// result is copied and edited in memory, the same way the earlier arms do).
//   Where the new instructions go:
//     end    : appended right before the closing "Strictly adhere to the provided JSON schema." line, i.e. AFTER the post-level block.
//              This is where arms.ts, arms-stage.ts and the first highlight arms put them.
//     inline : inside the per-event section where they belong: the stage rule as sub-item 4e (after 4d, with the other schedule rules) and
//              every per-event field as the next numbered item after 11 (before "Also report, once for the whole post"). Numbers follow on.
//   Why it matters: a rule sitting at the bottom, outside the section it modifies, may carry less weight. The replay compares the two so we
//   know whether a new schema field can simply be added, or whether the instruction has to be rewritten around it.
//   Contents: 'stage' = schedule stage enum (required in the schema), 'facts' = prizes[], promos[], inclusions[], isFree.
export const STAGES = ['event', 'qualification', 'supporting', 'registration', 'submission', 'announcement', 'preparation', 'other'] as const;
export const PRIZE_KINDS = ['MONEY', 'ITEM', 'SCHOLARSHIP', 'DOORPRIZE', 'CERTIFICATE', 'OTHER'] as const;
export const PROMO_KINDS = ['PERCENT_OFF', 'AMOUNT_OFF', 'BUY_GET', 'FREE_ITEM', 'BUNDLE', 'CASHBACK', 'OTHER'] as const;

export type Place = 'end' | 'inline';
export interface ArmSpec { stage: boolean; facts: boolean; place: Place }
/** Arm names used by the replay: A (control), then F/G with the placement as a suffix. F = facts, G = facts + stage. */
export const ARM_SPECS: Record<string, ArmSpec | null> = {
  A: null,
  'F-end': { stage: false, facts: true, place: 'end' },
  'F-inline': { stage: false, facts: true, place: 'inline' },
  'G-end': { stage: true, facts: true, place: 'end' },
  'G-inline': { stage: true, facts: true, place: 'inline' },
};

const STAGE_BODY = `stage (required): what this schedule IS for a person who wants to attend or take part. Use exactly one of: event (the event day(s) themselves, the default when unsure), qualification (a qualifying round, audition, selection or heat on its own date), supporting (a side programme of the same occasion that people can attend: pre-event, workshop, talk show, closing night), registration (a registration, sign-up, early-bird or ticket-sale period, not the on-site check-in on the event day), submission (a deadline or period to send in work), announcement (when results, winners or selected participants are announced), preparation (technical meeting, race-pack or kit collection, tenant load-in, rehearsal), other. The stage follows the meaning of the row, not only its title. Registration, submission, announcement and preparation rows are never the event itself: isMainSchedule must be true only for a schedule whose stage is event, qualification or supporting. Keep every row you would have reported before and only add its stage; do not change how events or groupingReason are decided because of stage.`;

const FACT_ITEMS = [
  `prizes: one entry per prize or prize pool for THIS event that the source states with an amount or a named item. kind is MONEY (cash, prize pool), ITEM (a named physical or experience prize), SCHOLARSHIP, DOORPRIZE, CERTIFICATE or OTHER. value is the amount or item exactly as written in the source ("Rp 50.000.000", "1 unit motor"); "Jutaan rupiah" is NOT enough, leave it out unless an amount or a named item is given. isTotal is true when the source calls it the total or the pool. evidence is the exact source text (at most 120 characters). Vague claims ("hadiah menarik", "banyak hadiah", "door prize melimpah") are never entries.`,
  `promos: one entry per discount or promotion for THIS event (a price cut, buy-one-get-one, a free item with purchase, a bundle price, cashback). kind is PERCENT_OFF, AMOUNT_OFF, BUY_GET, FREE_ITEM, BUNDLE, CASHBACK or OTHER. value is the offer exactly as written ("50%", "Rp 25.000", "Beli 1 Gratis 1"). conditions is a short copy of any stated condition (minimum purchase, payment method, "khusus pelajar"), at most 80 characters, absent when none. evidence is the exact source text (at most 120 characters). A normal ticket or entry price is NOT a promo. Never compute a percentage that is not written in the source.`,
  `inclusions: what a participant or buyer receives for the price or registration, as short phrases copied from the source (for example "Jersey", "Medali", "Goodie bag", "Tiket 28 wahana"); at most 6 entries, each at most 40 characters; leave absent when the source lists none.`,
  `isFree: true only when the source states that attending or taking part costs nothing ("Gratis", "Free entry", "Free registration" for the event itself); omit it otherwise. A free sub-item of a paid event does not make the event free. Never write a phone number, email address, link or personal name into prizes, promos, inclusions.`,
];

const PRIZE_ITEM = { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: [...PRIZE_KINDS] }, value: { type: 'STRING' }, isTotal: { type: 'BOOLEAN' }, evidence: { type: 'STRING' } }, required: ['kind', 'value'] };
const PROMO_ITEM = { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: [...PROMO_KINDS] }, value: { type: 'STRING' }, conditions: { type: 'STRING' }, evidence: { type: 'STRING' } }, required: ['kind', 'value'] };

const END_MARKER = 'Strictly adhere to the provided JSON schema.';
const POST_LEVEL_ANCHOR = 'Also report, once for the whole post (not per event):';
const ITEM5_ANCHOR = /\n5\. location, organizerName/;
const must = (cond: boolean, what: string) => { if (!cond) throw new Error(`prompt anchor moved (${what}): update the POC`); };

export function armRequest(arm: string, request: any) {
  const spec = ARM_SPECS[arm];
  if (spec === undefined) throw new Error(`unknown arm ${arm}`);
  if (spec === null) return request;
  const r = structuredClone(request);
  const ev = r.responseSchema.properties.events.items.properties;
  let text: string = r.systemInstruction;

  // schema
  if (spec.stage) {
    ev.schedules.items.properties.stage = { type: 'STRING', enum: [...STAGES] };
    ev.schedules.items.required = [...new Set([...(ev.schedules.items.required ?? []), 'stage'])];
  }
  if (spec.facts) {
    ev.prizes = { type: 'ARRAY', items: PRIZE_ITEM };
    ev.promos = { type: 'ARRAY', items: PROMO_ITEM };
    ev.inclusions = { type: 'ARRAY', items: { type: 'STRING' } };
    ev.isFree = { type: 'BOOLEAN' };
  }

  // instruction text. Item numbers continue after the production list (1 to 11): facts take 12 to 15; in the end placement the stage rule
  // follows as 16 (it is a standalone item there), inline it is sub-item 4e.
  const factLines = FACT_ITEMS.map((t, i) => `${12 + i}. ${t}`);
  if (spec.place === 'inline') {
    must(text.includes(POST_LEVEL_ANCHOR), 'post-level block');
    must(ITEM5_ANCHOR.test(text), 'item 5');
    if (spec.stage) text = text.replace(ITEM5_ANCHOR, `\n   4e. ${STAGE_BODY}\n5. location, organizerName`);
    if (spec.facts) text = text.replace(POST_LEVEL_ANCHOR, `${factLines.join('\n')}\n\n${POST_LEVEL_ANCHOR}`);
  } else {
    must(text.includes(END_MARKER), 'closing line');
    const parts: string[] = [];
    if (spec.facts) parts.push(`WHAT MAKES THIS EVENT WORTH ATTENDING (additional per-event fields; apply them to each event in the events array, and leave a field absent when the source states nothing for it):\n${factLines.join('\n')}`);
    if (spec.stage) parts.push(`SCHEDULE STAGE (applies to every schedule entry in section 4):\n${spec.facts ? 16 : 12}. ${STAGE_BODY}`);
    text = text.replace(END_MARKER, `${parts.join('\n\n')}\n\n${END_MARKER}`);
  }
  r.systemInstruction = text;
  return r;
}
