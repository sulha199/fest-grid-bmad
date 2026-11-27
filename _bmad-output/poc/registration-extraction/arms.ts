// POC prompt arms (throwaway; nothing under apps/ or packages/ is modified). Copies the addendum from gemini-trial.ts so the A/B script
// can import it without running the trial loop.
//   A  base : the production prompt and schema, unchanged.
//   B  ext  : + highlight + registrations[] (what findings.md section 5 trialled).
//   C  win  : B + event-level registrationWindow, and rule 0d reworded so a registration/sign-up window is NOT a schedule.
export const ADDENDUM_B = `REGISTRATION AND HIGHLIGHT (additional per-event fields; apply them to each event in the events array):
12. highlight: the single fact in THIS event's source text that would most make a stranger care to attend (a prize or prize pool, a discount, free entry, a named headline guest). At most 40 characters, copied from the caption's own wording (shorten by cutting words, never by rewording) and never translated. Every amount or number in it must appear in the caption exactly as written. Omit highlight when the caption states no such fact. Scope or category labels (for example "Nasional", "Promo Mall", "Open Recruitment") and vague claims ("hadiah menarik", "door prize melimpah") are not highlights. highlightKind is one of PRIZE, DISCOUNT, FREE, GUEST, GIFT, BENEFIT, OTHER. highlightEvidence is the exact caption text (at most 120 characters) the highlight was taken from.
13. registrations: one entry per distinct way to take part in THIS event, only when the caption states it (a registration or ticket link, a WhatsApp or phone contact to register or reserve, a QR code on the poster, a DM, walk-in). A contact with several numbers is still ONE entry; make separate entries only for different channels or different conditions (price, eligibility, batch, category). For each entry:
   - channel: LINK, WHATSAPP, PHONE, QR, DM, ONSITE or OTHER.
   - label: a short label of at most 4 words in the caption's language (for example "Pendaftaran", "Early bird", "Peserta umum").
   - url: the link, only for channel LINK.
   - priceText: the price or fee for THIS entry exactly as written ("Rp 25.000", "Gratis"); absent when not stated for it.
   - eligibility: who may use THIS entry, only when the caption restricts it (age, school level, membership, "wajib follow @x"); copied or minimally shortened, in the caption's language.
   - opensOn and closesOn: YYYY-MM-DD when stated for this entry.
   - instruction: the caption's own instructions for registering (steps, requirements), copied in the caption's language, at most 300 characters; absent when it only says "daftar sekarang".
   - messageTemplate: ONLY when the caption explicitly tells people to send a specific message or format (for example "Nama_Asal_Judul", "ketik NAMA_BOOKING"): copy that text exactly, never write or improve one. Absent otherwise.
   - evidence: the exact caption text (at most 120 characters) this entry is based on.
   NEVER write a phone number, email address or wa.me / WhatsApp link into any of these fields: contact numbers are collected separately by code; for a WhatsApp or phone contact set only channel and label. Never write a person's name into any field.
   When one post lists several events and a registration channel is stated once for all of them (one admin number or one link), repeat that entry under every event it applies to; when a link or number is clearly for one event only, put it only under that event. If you cannot tell, leave it out.
   Registration or ticket links also stay in links, as before.

`;

export const ADDENDUM_C_EXTRA = `14. registrationWindow: the period in which people can sign up or buy tickets for THIS event, not the event's own dates. opensOn and closesOn are YYYY-MM-DD; fill each one only when the source states it (take the year from the post's publication date when the source omits it; never invent a date). A registration, sign-up, early-bird or ticket-sale window is NEVER a schedule: do not add a schedule entry for it, and do not count it as a schedule or a stage when choosing groupingReason. It is still evidence of an independent registration pipeline for rule 0a.

`;

const REG_ITEM = {
  type: 'OBJECT',
  properties: {
    channel: { type: 'STRING', enum: ['LINK', 'WHATSAPP', 'PHONE', 'QR', 'DM', 'ONSITE', 'OTHER'] },
    label: { type: 'STRING' }, url: { type: 'STRING' }, priceText: { type: 'STRING' }, eligibility: { type: 'STRING' },
    opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' }, instruction: { type: 'STRING' }, messageTemplate: { type: 'STRING' }, evidence: { type: 'STRING' },
  },
  required: ['channel'],
};
const MARKER = 'Strictly adhere to the provided JSON schema.';
const RULE_D_OLD = 'the registration or sign-up window becomes one of its schedules, not a separate event (groupingReason: "dependent-stages")';
const RULE_D_NEW = 'the registration or sign-up window is reported in registrationWindow, not as a schedule and not as a separate event (groupingReason: "dependent-stages")';

export function armRequest(arm: 'A' | 'B' | 'C', request: any) {
  if (arm === 'A') return request;
  const r = structuredClone(request);
  const ev = r.responseSchema.properties.events.items.properties;
  ev.highlight = { type: 'STRING' };
  ev.highlightKind = { type: 'STRING', enum: ['PRIZE', 'DISCOUNT', 'FREE', 'GUEST', 'GIFT', 'BENEFIT', 'OTHER'] };
  ev.highlightEvidence = { type: 'STRING' };
  ev.registrations = { type: 'ARRAY', items: REG_ITEM };
  let add = ADDENDUM_B;
  if (arm === 'C') {
    ev.registrationWindow = { type: 'OBJECT', properties: { opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' } } };
    add += ADDENDUM_C_EXTRA;
    if (!r.systemInstruction.includes(RULE_D_OLD)) throw new Error('rule 0d wording moved: update the POC');
    r.systemInstruction = r.systemInstruction.replace(RULE_D_OLD, RULE_D_NEW);
  }
  if (!r.systemInstruction.includes(MARKER)) throw new Error('prompt marker moved: update the POC');
  r.systemInstruction = r.systemInstruction.replace(MARKER, add + MARKER);
  return r;
}
