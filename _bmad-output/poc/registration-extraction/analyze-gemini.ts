// Scores private/gemini-runs.jsonl against private/labels.json. Prints aggregates and DIGIT-MASKED short examples only.
import { readFileSync, writeFileSync } from 'node:fs';
import { scrubContactData } from './scrub-contact-data.ts';
import { normalizeCaption } from './detect-phones.ts';

const labels: Record<string, any> = JSON.parse(readFileSync('private/labels.json', 'utf8'));
const sample = new Map(readFileSync('private/sample.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.sampleId, r]));
const runs = readFileSync('private/gemini-runs.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const flat = (s: string) => normalizeCaption(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const capDigits = (s: string) => normalizeCaption(s).replace(/(?<=\d)[.,](?=\d)/g, '');
const numTokens = (s: string) => [...(s.match(/\d[\d.,]*/g) ?? [])].map((t) => t.replace(/\D/g, '')).filter((t) => t.length > 0);
const mask = (s: string) => s.replace(/\d/g, 'x').slice(0, 90);
const avg = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null);
const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '0/0');

type Run = { id: string; arm: 'base' | 'ext'; run: number; ok: boolean; usage?: any; finishReason?: string; json?: any; parseError?: boolean };
const parsed: Run[] = runs.map((r) => {
  if (!r.ok) return { ...r, parseError: false };
  try { return { ...r, json: JSON.parse(r.text) }; } catch { return { ...r, ok: true, parseError: true }; }
});
const ok = parsed.filter((r) => r.ok && !r.parseError && r.json);
const ext = ok.filter((r) => r.arm === 'ext');
const base = ok.filter((r) => r.arm === 'base');
const out: any = { calls: runs.length, failed: runs.filter((r) => !r.ok).length, parseErrors: parsed.filter((r) => r.parseError).length, notStop: ok.filter((r) => r.finishReason !== 'STOP').length };

// ---- cost ---------------------------------------------------------------------------------------------------------------
const paired = [...new Set(ext.map((r) => r.id))].filter((id) => base.some((b) => b.id === id));
const dP: number[] = [], dO: number[] = [], bP: number[] = [], bO: number[] = [], eP: number[] = [], eO: number[] = [], eT: number[] = [], bT: number[] = [];
for (const id of paired) {
  const b = base.find((x) => x.id === id)!;
  const es = ext.filter((x) => x.id === id);
  const eAvgP = avg(es.map((x) => x.usage?.promptTokens ?? 0))!, eAvgO = avg(es.map((x) => x.usage?.outputTokens ?? 0))!;
  bP.push(b.usage?.promptTokens ?? 0); bO.push(b.usage?.outputTokens ?? 0); bT.push(b.usage?.thinkingTokens ?? 0);
  eP.push(eAvgP); eO.push(eAvgO); eT.push(avg(es.map((x) => x.usage?.thinkingTokens ?? 0))!);
  dP.push(eAvgP - (b.usage?.promptTokens ?? 0)); dO.push(eAvgO - (b.usage?.outputTokens ?? 0));
}
out.cost = { captionsPaired: paired.length, basePromptTokens: avg(bP), extPromptTokens: avg(eP), promptDelta: avg(dP), promptDeltaPct: bP.length ? +(100 * avg(dP)! / avg(bP)!).toFixed(1) : null,
  baseOutputTokens: avg(bO), extOutputTokens: avg(eO), outputDelta: avg(dO), outputDeltaPct: bO.length ? +(100 * avg(dO)! / avg(bO)!).toFixed(1) : null, baseThinking: avg(bT), extThinking: avg(eT) };

// ---- event counts -------------------------------------------------------------------------------------------------------
let evSame = 0, evTotal = 0, evMatchLabel = 0, evLabelTotal = 0;
for (const id of paired) {
  const b = base.find((x) => x.id === id)!;
  for (const e of ext.filter((x) => x.id === id)) { evTotal++; if ((e.json.events?.length ?? 0) === (b.json.events?.length ?? 0)) evSame++; }
  for (const e of ext.filter((x) => x.id === id)) { evLabelTotal++; if ((e.json.events?.length ?? 0) === labels[id].ev) evMatchLabel++; }
}
out.eventCount = { extSameAsBaseline: pct(evSame, evTotal), extEqualsLabelledCount: pct(evMatchLabel, evLabelTotal) };

// ---- highlight ----------------------------------------------------------------------------------------------------------
const hl = { events: 0, withHl: 0, quoteVerbatim: 0, numbersGrounded: 0, textVerbatim: 0, dropped: 0, imageOnlyUncheckable: 0, labelPos: 0, tp: 0, fp: 0, fn: 0, kindAgree: 0, kindBoth: 0 };
const hlExamples: string[] = [];
const perIdHl = new Map<string, string[]>();
for (const r of ext) {
  const cap = sample.get(r.id)!.caption as string;
  const capF = flat(cap), capD = capDigits(cap);
  const L = labels[r.id];
  const evs = r.json.events ?? [];
  const hasAny = evs.some((e: any) => e.highlight && String(e.highlight).trim());
  const labelHas = !!L.hl;
  perIdHl.set(r.id, [...(perIdHl.get(r.id) ?? []), evs.map((e: any) => flat(e.highlight ?? '')).join('|')]);
  if (labelHas) hl.labelPos++;
  if (hasAny && labelHas) hl.tp++; else if (hasAny && !labelHas) hl.fp++; else if (!hasAny && labelHas) hl.fn++;
  for (const e of evs) {
    hl.events++;
    if (!e.highlight || !String(e.highlight).trim()) continue;
    hl.withHl++;
    const h = String(e.highlight);
    const quoteOk = !!e.highlightEvidence && capF.includes(flat(e.highlightEvidence));
    const nums = numTokens(h);
    const numsOk = nums.every((t) => capD.replace(/[^\d]+/g, ' ').split(' ').some((c) => c.includes(t)) || capD.includes(t));
    if (quoteOk) hl.quoteVerbatim++;
    if (numsOk) hl.numbersGrounded++; else { hl.dropped++; if (hlExamples.length < 6) hlExamples.push(`${r.id} DROP "${mask(h)}"`); }
    if (capF.includes(flat(h))) hl.textVerbatim++;
    if (L.hk && e.highlightKind) { hl.kindBoth++; if (String(e.highlightKind).toLowerCase() === L.hk || (L.hk === 'benefit' && e.highlightKind === 'GIFT')) hl.kindAgree++; }
  }
}
let hlStable = 0; for (const [, v] of perIdHl) if (v.length > 1 && new Set(v).size === 1) hlStable++;
out.highlight = { ...hl, precision: avg([hl.tp / Math.max(1, hl.tp + hl.fp)]), recall: avg([hl.tp / Math.max(1, hl.tp + hl.fn)]), groundedNumbersPct: pct(hl.numbersGrounded, hl.withHl), quoteVerbatimPct: pct(hl.quoteVerbatim, hl.withHl), textVerbatimPct: pct(hl.textVerbatim, hl.withHl), stableAcross3Runs: pct(hlStable, perIdHl.size), droppedExamples: hlExamples };

// ---- registrations ------------------------------------------------------------------------------------------------------
const kindOf = (c: string) => ({ link: 'LINK', site: 'LINK', group: 'LINK', wa: 'WHATSAPP', phone: 'PHONE', qr: 'QR', dm: 'DM' } as Record<string, string>)[c] ?? 'OTHER';
const reg = { runs: 0, tpKinds: 0, fpKinds: 0, fnKinds: 0, optionsTotal: 0, evidenceChecked: 0, evidenceOk: 0, singleEventCountExact: 0, singleEventCountChecked: 0, phoneLabelled: 0, phoneOptionEmitted: 0, noOptionsWhenLabelledReg: 0, labelledReg: 0 };
const piiFields: Record<string, number> = {}; let piiTotal = 0, piiUrlWa = 0, fieldsChecked = 0;
const priceCov: number[] = []; const priceOptsCount: Array<[number, number]> = [];
const el = { labelPos: 0, tp: 0, fn: 0, fp: 0, labelNeg: 0 };
const tmpl = { labelled: 0, labelledRuns: 0, extracted: 0, verbatim: 0, falseTemplates: 0, nonLabelledRuns: 0, examples: [] as string[] };
const d4: Record<string, string[]> = {};
for (const r of ext) {
  const cap = sample.get(r.id)!.caption as string; const capF = flat(cap);
  const L = labels[r.id]; const evs = r.json.events ?? [];
  reg.runs++;
  const regs: any[] = evs.flatMap((e: any, i: number) => (e.registrations ?? []).map((x: any) => ({ ...x, __ev: i })));
  reg.optionsTotal += regs.length;
  const modelKinds = new Set(regs.map((x) => x.channel));
  const labelKinds = new Set<string>((L.ch as string[]).map(kindOf));
  for (const k of modelKinds) labelKinds.has(k as string) ? reg.tpKinds++ : reg.fpKinds++;
  for (const k of labelKinds) if (!modelKinds.has(k)) reg.fnKinds++;
  if (L.ev === 1 && evs.length === 1 && L.ch.length) { reg.singleEventCountChecked++; if (regs.length === L.ch.length) reg.singleEventCountExact++; }
  // evidence quotes
  for (const x of regs) if (x.evidence) { reg.evidenceChecked++; if (capF.includes(flat(x.evidence))) reg.evidenceOk++; }
  // PII leakage: any field the scrubber would change
  const strFields: Array<[string, string]> = [];
  for (const [i, e] of evs.entries()) { for (const f of ['highlight', 'highlightEvidence']) if (e[f]) strFields.push([f, e[f]]); void i; }
  for (const x of regs) for (const f of ['label', 'priceText', 'eligibility', 'instruction', 'messageTemplate', 'evidence', 'url']) if (x[f]) strFields.push([f, x[f]]);
  for (const [f, v] of strFields) {
    fieldsChecked++;
    if (f === 'url') { const isWa = /wa\.me|whatsapp\.com/i.test(v); const chan = regs.find((x) => x.url === v)?.channel; if (isWa || (chan && chan !== 'LINK' && /\d{8,}/.test(v))) { piiUrlWa++; } continue; }
    if (scrubContactData(v).removed > 0) { piiTotal++; piiFields[f] = (piiFields[f] ?? 0) + 1; }
  }
  // phones: does the model give a WA/PHONE option where I labelled a registration/contact number?
  const labelledPhones = (L.ph as any[]).filter((p) => p[1] !== 'other');
  if (labelledPhones.length) {
    reg.phoneLabelled++;
    if (regs.some((x) => x.channel === 'WHATSAPP' || x.channel === 'PHONE')) reg.phoneOptionEmitted++;
    d4[r.id] = [...(d4[r.id] ?? []), `${evs.length}ev:${evs.filter((e: any, i: number) => regs.some((x) => x.__ev === i && (x.channel === 'WHATSAPP' || x.channel === 'PHONE'))).length}withPhoneOpt`];
  }
  if (L.reg) { reg.labelledReg++; if (!regs.length) reg.noOptionsWhenLabelledReg++; }
  // price tiers coverage
  const labelAmounts = numTokens(((L.tiers as string) ?? '').replace(/(\d+)\s?[kK]\b/g, '$1'));
  if (labelAmounts.length) {
    const modelNums = new Set(regs.flatMap((x) => numTokens(String(x.priceText ?? ''))).concat(evs.flatMap((e: any) => (e.schedules ?? []).flatMap((s: any) => numTokens(String(s.ticketPrice ?? ''))))).map((t) => t.replace(/\D/g, '')));
    const norm = (t: string) => t.replace(/^0+/, '');
    const hit = labelAmounts.filter((t) => [...modelNums].some((m) => norm(m) === norm(t) || norm(m) === norm(t) + '000')).length;
    priceCov.push(hit / labelAmounts.length);
    priceOptsCount.push([regs.filter((x) => x.priceText).length, (L.tiers as string).split(/;|,(?=\s*[A-Z])/).length]);
  }
  // eligibility
  const modelEl = regs.some((x) => x.eligibility && String(x.eligibility).trim());
  if (L.el) { el.labelPos++; modelEl ? el.tp++ : el.fn++; } else { el.labelNeg++; if (modelEl) el.fp++; }
  // templates
  if (L.tmpl) { tmpl.labelledRuns++; const t = regs.map((x) => x.messageTemplate).filter(Boolean)[0]; if (t) { tmpl.extracted++; if (capF.includes(flat(t))) tmpl.verbatim++; else if (tmpl.examples.length < 4) tmpl.examples.push(`${r.id} not-verbatim: ${mask(t)}`); } }
  else { tmpl.nonLabelledRuns++; const t = regs.map((x) => x.messageTemplate).filter(Boolean)[0]; if (t) { tmpl.falseTemplates++; if (tmpl.examples.length < 8) tmpl.examples.push(`${r.id} FALSE template: ${mask(t)}`); } }
}
// ---- what the model actually fills, name-as-label, price grounding, contact splitting ---------------------------------------
const fill: Record<string, number> = {}; let optN = 0, nameLabels = 0, waPhoneOpts = 0, waPhoneWithUrlDigits = 0, priceChecked = 0, priceGrounded = 0, instrN = 0, instrVerbatim = 0, tmplOpts = 0;
let contactSplit = 0, contactCaptions = 0;
const GENERIC = /^(admin|contact|contact person|cp|narahubung|info|informasi|reservasi|reservation|whatsapp|wa|customer|customer care|pendaftaran|registration|register|daftar|pendaftaran online|formulir|link|booking|hubungi kami|chat)\b/i;
for (const r of ext) {
  const cap = sample.get(r.id)!.caption as string; const capF = flat(cap); const capD = capDigits(cap);
  const L = labels[r.id];
  const regs: any[] = (r.json.events ?? []).flatMap((e: any) => e.registrations ?? []);
  const waPhone = regs.filter((x) => x.channel === 'WHATSAPP' || x.channel === 'PHONE');
  for (const x of regs) {
    optN++; for (const [f, v] of Object.entries(x)) if (v !== undefined && v !== null && String(v).trim() !== '') fill[f] = (fill[f] ?? 0) + 1;
    if (x.priceText) { for (const t of numTokens(String(x.priceText))) { priceChecked++; if (capD.replace(/[^\d]+/g, ' ').split(' ').some((c) => c === t || c.includes(t))) priceGrounded++; } }
    if (x.instruction) { instrN++; if (capF.includes(flat(String(x.instruction)))) instrVerbatim++; }
    if (x.messageTemplate) tmplOpts++;
  }
  for (const x of waPhone) {
    waPhoneOpts++;
    if (x.url && /\d{8,}/.test(String(x.url).replace(/\D/g, ' ').replace(/\s+/g, ''))) waPhoneWithUrlDigits++;
    const lab = String(x.label ?? '').trim();
    if (lab && !GENERIC.test(lab)) { const f = flat(lab); const i = capF.indexOf(f); if (i >= 0 && /\p{L}/u.test(lab) && lab.split(/\s+/).length <= 4) nameLabels++; }
  }
  const nPhones = (L.ph as any[]).filter((p) => p[1] !== 'other').length;
  if (nPhones > 0 && (L.ev ?? 1) === 1) { contactCaptions++; if (waPhone.length > 1 && nPhones <= waPhone.length) contactSplit++; }
}
out.fieldFill = { optionsTotal: optN, filled: fill };
out.nameAsLabel = { whatsAppOrPhoneOptions: waPhoneOpts, labelsThatReadAsAName: pct(nameLabels, waPhoneOpts) };
out.urlOnPhoneOptions = { whatsAppOrPhoneOptions: waPhoneOpts, withNumberInUrl: pct(waPhoneWithUrlDigits, waPhoneOpts) };
out.priceGrounding = { amountsChecked: priceChecked, foundInCaption: pct(priceGrounded, priceChecked) };
out.instruction = { emitted: instrN, verbatim: pct(instrVerbatim, instrN) };
out.contactSplitIntoManyOptions = pct(contactSplit, contactCaptions);
// event count equality split by single / multi
let s1 = 0, s1same = 0, m1 = 0, m1same = 0;
for (const id of paired) { const b = base.find((x) => x.id === id)!; for (const e of ext.filter((x) => x.id === id)) { const same = (e.json.events?.length ?? 0) === (b.json.events?.length ?? 0); if (labels[id].ev === 1) { s1++; if (same) s1same++; } else { m1++; if (same) m1same++; } } }
out.eventCountExtVsBase = { singleEventPosts: pct(s1same, s1), multiEventPosts: pct(m1same, m1) };
// highlight presence stability
let presStable = 0, presTotal = 0;
for (const id of new Set(ext.map((r) => r.id))) { const ps = ext.filter((r) => r.id === id).map((r) => (r.json.events ?? []).filter((e: any) => e.highlight).length > 0); if (ps.length > 1) { presTotal++; if (new Set(ps).size === 1) presStable++; } }
out.highlightPresenceStable = pct(presStable, presTotal);
out.registrations = { ...reg, channelKindPrecision: pct(reg.tpKinds, reg.tpKinds + reg.fpKinds), channelKindRecall: pct(reg.tpKinds, reg.tpKinds + reg.fnKinds), optionCountExactSingleEvent: pct(reg.singleEventCountExact, reg.singleEventCountChecked),
  phoneBearingCaptionsWithWaOrPhoneOption: pct(reg.phoneOptionEmitted, reg.phoneLabelled), labelledRegButNoOption: pct(reg.noOptionsWhenLabelledReg, reg.labelledReg), evidenceVerbatim: pct(reg.evidenceOk, reg.evidenceChecked) };
out.pii = { fieldsChecked, fieldsContainingNumberEmailOrWaLink: piiTotal, byField: piiFields, urlFieldHoldingWaLinkOrNumber: piiUrlWa };
out.priceTiers = { captionsWithLabelledAmounts: priceCov.length, meanAmountCoverage: avg(priceCov), fullCoverage: pct(priceCov.filter((c) => c >= 0.999).length, priceCov.length) };
out.eligibility = { ...el, recall: pct(el.tp, el.labelPos), falsePositive: pct(el.fp, el.labelNeg) };
out.template = { labelledRuns: tmpl.labelledRuns, extracted: pct(tmpl.extracted, tmpl.labelledRuns), verbatim: pct(tmpl.verbatim, tmpl.extracted), falseTemplates: pct(tmpl.falseTemplates, tmpl.nonLabelledRuns), examples: tmpl.examples };
out.d4 = Object.fromEntries(Object.entries(d4).filter(([id]) => labels[id].ev > 1));
// stability of channel sets across the 3 runs
let chanStable = 0, chanTotal = 0;
for (const id of new Set(ext.map((r) => r.id))) {
  const sets = ext.filter((r) => r.id === id).map((r) => [...new Set((r.json.events ?? []).flatMap((e: any) => (e.registrations ?? []).map((x: any) => x.channel)))].sort().join(','));
  if (sets.length > 1) { chanTotal++; if (new Set(sets).size === 1) chanStable++; }
}
out.channelSetStableAcrossRuns = pct(chanStable, chanTotal);
console.log(JSON.stringify(out, null, 1));
writeFileSync('out/gemini-summary.json', JSON.stringify(out, null, 1));
