// Scores detect-phones.ts against private/labels.json on private/sample.jsonl. Prints REDACTED output only
// (numbers masked, captions never printed) and writes out/detector-results.json (also redacted).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { detectRegistrationPhones, maskE164, type DetectedPhone } from './detect-phones.ts';

type Lbl = { ph: [string, 'reg' | 'cp' | 'other', string][]; reg: boolean };
const rows = readFileSync('private/sample.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const labels: Record<string, Lbl> = JSON.parse(readFileSync('private/labels.json', 'utf8'));

// 1. Are my own labels valid mobile numbers? (catches transcription errors and 9-digit numbers)
const labelCheck = { total: 0, valid: 0, invalid: [] as string[], notMobile: [] as string[] };
for (const [id, l] of Object.entries(labels)) {
  for (const [e164, role, flag] of l.ph) {
    if (role === 'other' && flag === 'landline') continue;
    labelCheck.total++;
    const p = parsePhoneNumberFromString(e164);
    if (!p || !p.isValid()) labelCheck.invalid.push(`${id} ${maskE164(e164)}(${e164.length - 3}d)`);
    else if (p.getType() !== 'MOBILE') labelCheck.notMobile.push(`${id} ${maskE164(e164)} type=${p.getType()}`);
    else labelCheck.valid++;
  }
}
console.log('LABEL VALIDITY', JSON.stringify(labelCheck));

type Variant = { name: string; requireCue: boolean; suppressRecap: boolean };
const variants: Variant[] = [
  { name: 'A cue required + recap filter', requireCue: true, suppressRecap: true },
  { name: 'B cue required, no recap filter', requireCue: true, suppressRecap: false },
  { name: 'C any valid mobile (no cue)', requireCue: false, suppressRecap: false },
];

const pr = (tp: number, fp: number, fn: number) => ({
  tp, fp, fn,
  precision: tp + fp === 0 ? null : +(tp / (tp + fp)).toFixed(3),
  recall: tp + fn === 0 ? null : +(tp / (tp + fn)).toFixed(3),
});

const results: any[] = [];
for (const v of variants) {
  let contact = { tp: 0, fp: 0, fn: 0 }; // truth = reg + cp, output = every detected number
  let strict = { tp: 0, fp: 0, fn: 0 };  // truth = reg only, output = numbers the detector called "reg"
  const fpOther: Record<string, number> = {};
  const fpUnlabelled: string[] = [];
  const fnList: string[] = [];
  const roleAgree = { reg_as_reg: 0, reg_as_cp: 0, cp_as_cp: 0, cp_as_reg: 0, unk: 0 };
  const byStratum: Record<string, { tp: number; fp: number; fn: number }> = {};
  const flagRecall: Record<string, { hit: number; all: number }> = { named: { hit: 0, all: 0 }, business: { hit: 0, all: 0 } };

  for (const r of rows) {
    const L = labels[r.sampleId];
    const out: DetectedPhone[] = detectRegistrationPhones(r.caption, { requireCue: v.requireCue, suppressRecap: v.suppressRecap });
    const truthContact = new Map(L.ph.filter((p) => p[1] !== 'other').map((p) => [p[0], p] as const));
    const truthOther = new Map(L.ph.filter((p) => p[1] === 'other').map((p) => [p[0], p] as const));
    const st = (byStratum[r.stratum] ??= { tp: 0, fp: 0, fn: 0 });
    const outSet = new Set(out.map((o) => o.e164));

    for (const o of out) {
      const t = truthContact.get(o.e164);
      if (t) {
        contact.tp++; st.tp++;
        if (t[1] === 'reg') (o.role === 'reg' ? roleAgree.reg_as_reg++ : o.role === 'cp' ? roleAgree.reg_as_cp++ : roleAgree.unk++);
        else (o.role === 'cp' ? roleAgree.cp_as_cp++ : o.role === 'reg' ? roleAgree.cp_as_reg++ : roleAgree.unk++);
      } else if (truthOther.has(o.e164)) {
        const k = truthOther.get(o.e164)![2] || 'other'; fpOther[k] = (fpOther[k] ?? 0) + 1; contact.fp++; st.fp++;
      } else { fpUnlabelled.push(`${r.sampleId} ${maskE164(o.e164)} role=${o.role} cue=${o.cue}`); contact.fp++; st.fp++; }
    }
    for (const [e164, t] of truthContact) {
      for (const [flag, key] of [['n', 'named'], ['b', 'business']] as const) {
        if (t[2].includes(flag)) { flagRecall[key].all++; if (outSet.has(e164)) flagRecall[key].hit++; }
      }
      if (!outSet.has(e164)) { contact.fn++; st.fn++; fnList.push(`${r.sampleId} ${maskE164(e164)} role=${t[1]} flags=${t[2] || '-'}`); }
    }
    // strict: reg numbers only
    const truthReg = new Set([...truthContact.values()].filter((p) => p[1] === 'reg').map((p) => p[0]));
    const outReg = new Set(out.filter((o) => o.role === 'reg').map((o) => o.e164));
    for (const e of outReg) truthReg.has(e) ? strict.tp++ : strict.fp++;
    for (const e of truthReg) if (!outReg.has(e)) strict.fn++;
  }
  const res = { variant: v.name, contact: pr(contact.tp, contact.fp, contact.fn), strictReg: pr(strict.tp, strict.fp, strict.fn), fpOtherClasses: fpOther, roleAgree, flagRecall, byStratum, fpUnlabelled, fnList };
  results.push(res);
  console.log('\n=== ' + v.name);
  console.log('contact set (reg+cp):', JSON.stringify(res.contact));
  console.log('strict (reg role only):', JSON.stringify(res.strictReg));
  console.log('FP that hit a labelled "other" class:', JSON.stringify(fpOther));
  console.log('role agreement on TPs:', JSON.stringify(roleAgree));
  console.log('recall on named / business numbers:', JSON.stringify(flagRecall));
  console.log('FP not in labels (' + fpUnlabelled.length + '):', fpUnlabelled.join(' | ') || '-');
  console.log('FN (' + fnList.length + '):', fnList.join(' | ') || '-');
}
mkdirSync('out', { recursive: true });
writeFileSync('out/detector-results.json', JSON.stringify({ labelCheck, results }, null, 1));
