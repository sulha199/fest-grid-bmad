// POC arms for the schedule-stage enum and price tiers (throwaway; nothing under apps/ or packages/ is modified).
//   A  production prompt and schema, unchanged (control; returned as is).
//   D  stage : A + `stage` enum on every schedule (a registration window stays a schedule, now tagged). Rule 0d is NOT reworded.
//   E  stage + tiers : D + event-level `tiers[]` (priced options: categories or time-boxed batches).
export const STAGES = ['event', 'qualification', 'supporting', 'registration', 'submission', 'announcement', 'preparation', 'other'] as const;
export const TIER_KINDS = ['CATEGORY', 'TIME_WINDOW', 'OTHER'] as const;

export const ADDENDUM_STAGE = `SCHEDULE STAGE (applies to every schedule entry in section 4):
15. stage: what this schedule IS for a person who wants to attend or take part. Always set it, using exactly one of:
   - event: the event day(s) themselves (the default when unsure). A multi-day event may have several of these.
   - qualification: a qualifying round, audition, selection, heat or semi-final held on its own date.
   - supporting: a side programme of the same occasion that people can attend (pre-event, workshop, talk show, closing night).
   - registration: a registration, sign-up, early-bird or ticket-sale period (not the on-site check-in on the event day).
   - submission: a deadline or period to send in work (entries, abstracts, applications).
   - announcement: when results are announced (winners, who passed selection, line-up reveal).
   - preparation: technical meeting, race-pack or kit collection, tenant load-in, rehearsal.
   - other: none of the above fits.
   The stage follows the meaning of the row, not only its title. Registration, submission, announcement and preparation rows are never the event itself: isMainSchedule must be true only for a schedule whose stage is event, qualification or supporting. Do not change how events or groupingReason are decided because of stage: keep every row you would have reported before, and only add its stage.

`;

export const ADDENDUM_TIERS = `PRICED OPTIONS (event level, apply to each event in the events array):
16. tiers: one entry per distinct priced way to take part in THIS event, only when the source states at least two such options or one option with a name (for example three race categories with different fees, early bird and regular batches, VIP and regular seats). Leave tiers absent when the source states a single price with no named option or no price at all. For each entry:
   - label: the option's name as written ("UMUM 5K", "Early bird", "VIP"), at most 5 words.
   - kind: CATEGORY for options that differ by what you take part in or who you are (distance, class, seat class, age group); TIME_WINDOW for options that differ by when you buy (early bird, presale 1, regular batch, on the day); OTHER otherwise.
   - price: the price exactly as written ("Rp 200.000", "Gratis"); never compute or convert. Absent when the source gives no price for this option.
   - opensOn and closesOn: YYYY-MM-DD, only when the source states the sales period of this option (mainly for TIME_WINDOW).
   - evidence: the exact source text (at most 120 characters) this entry is based on.
   Never invent a tier to split one price. Never write a phone number, email address or personal name.

`;

const TIER_ITEM = {
  type: 'OBJECT',
  properties: {
    label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...TIER_KINDS] }, price: { type: 'STRING' },
    opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' }, evidence: { type: 'STRING' },
  },
  required: ['label', 'kind'],
};
const MARKER = 'Strictly adhere to the provided JSON schema.';

export type StageArm = 'A' | 'D' | 'E';
export function stageArmRequest(arm: StageArm, request: any) {
  if (arm === 'A') return request;
  const r = structuredClone(request);
  const ev = r.responseSchema.properties.events.items.properties;
  ev.schedules.items.properties.stage = { type: 'STRING', enum: [...STAGES] };
  ev.schedules.items.required = [...new Set([...(ev.schedules.items.required ?? []), 'stage'])]; // a real change would make it required
  let add = ADDENDUM_STAGE;
  if (arm === 'E') { ev.tiers = { type: 'ARRAY', items: TIER_ITEM }; add += ADDENDUM_TIERS; }
  if (!r.systemInstruction.includes(MARKER)) throw new Error('prompt marker moved: update the POC');
  r.systemInstruction = r.systemInstruction.replace(MARKER, add + MARKER);
  return r;
}
