/**
 * Deterministic guards applied to a model-produced insight before it would be persisted.
 *
 * Principle: the model proposes, cheap code verifies against the SOURCE TEXT, and every guard
 * degrades toward "no claim" — never toward a stronger one. A dropped claim makes an event
 * neutral in ranking; a wrong claim hides it from people or surfaces it to the wrong ones.
 * Pure and dependency-free so it can move to packages/domain unchanged.
 */
import type { EventInsight } from './insight-schema.js';
import { isVerbatimQuote } from './score.js';

const AGE_WORDS = /(usia|umur|age|aged|tahun|thn|years?|yrs?|yo|y\.o|th\b|di ?bawah|under|ke ?atas|above|older)/i;

const RESTRICTION_CUE = /(khusus|hanya (untuk|bagi)|eksklusif|exclusive|internal|undangan|invitation|invite[- ]only|members? only|only for|anggota|tidak (terbuka )?untuk umum|not open to|wajib (membawa|memiliki|menunjukkan)|private event)/i;

const GENDER_CUE = /(khusus|hanya|only|exclusive|eksklusif).{0,24}(perempuan|wanita|women|woman|ladies|putri|laki|pria|\bmen\b)|(women|ladies|perempuan|wanita|putri)[ -]?only|for (women|ladies|men) only/i;

export interface GuardResult { insight: EventInsight; actions: string[] }

const UPPER_BOUND_CUE = /(di ?bawah|kurang dari|under|below|younger than|max(imum)?)/i;
const LOWER_BOUND_CUE = /(di ?atas|lebih dari|over|above|older than|min(imum)?|ke ?atas|keatas|\+)/i;

// A number is accepted as a stated age only if it appears as a standalone numeric token inside a
// (verbatim-verified) evidence quote, within 25 characters of an age word. This is what separates
// "usia 7–16 tahun" from "1 - 3 SD" (a school level) and from a model-invented "60..120".
// Exclusive bounds are the one legitimate derivation: "di bawah 12 tahun" -> ageMax 11 (or 12),
// "di atas 17 tahun" -> ageMin 18 (or 17), so n±1 is accepted next to an under/over cue.
function ageNumberIsStated(n: number, quotes: string[], kind: 'min' | 'max'): boolean {
  const candidates = [n];
  if (kind === 'max') candidates.push(n + 1); else candidates.push(n - 1);
  return candidates.some((cand) => {
    const re = new RegExp(`(?<![\\d.,])${cand}(?![\\d.,]\\d)(?!\\d)`, 'g');
    return quotes.some((q) => {
      for (const m of q.matchAll(re)) {
        const lo = Math.max(0, m.index! - 25);
        const window = q.slice(lo, m.index! + String(cand).length + 25);
        if (!AGE_WORDS.test(window)) continue;
        if (cand === n) return true;
        // n±1 only counts next to an exclusive-bound cue pointing the right way.
        if (kind === 'max' ? UPPER_BOUND_CUE.test(window) : LOWER_BOUND_CUE.test(window)) return true;
      }
      return false;
    });
  });
}

export function applyGuards(input: EventInsight, source: string): GuardResult {
  const insight: EventInsight = { ...input, evidence: [...input.evidence] };
  const actions: string[] = [];

  const verified = insight.evidence.filter((q) => isVerbatimQuote(q, source));
  if (verified.length !== insight.evidence.length) {
    actions.push(`dropped ${insight.evidence.length - verified.length} non-verbatim evidence quote(s)`);
    insight.evidence = verified;
  }

  for (const key of ['ageMin', 'ageMax'] as const) {
    const n = insight[key];
    if (n === undefined || n === null) continue;
    if (!ageNumberIsStated(n, verified, key === 'ageMin' ? 'min' : 'max')) {
      actions.push(`dropped ${key}=${n}: no age-qualified evidence quote contains it`);
      delete insight[key];
    }
  }
  if (insight.ageMin !== undefined && insight.ageMax !== undefined && insight.ageMin > insight.ageMax) {
    actions.push('dropped inconsistent age range (min > max)');
    delete insight.ageMin;
    delete insight.ageMax;
  }

  // A verified age bound is itself a restriction (an age band), so it also satisfies this guard.
  const hasAgeBand = insight.ageMin !== undefined || insight.ageMax !== undefined;
  if (insight.eligibility === 'restricted' && !hasAgeBand && !RESTRICTION_CUE.test(source) && !GENDER_CUE.test(source)) {
    actions.push('restricted -> unspecified: no restriction wording in the post');
    insight.eligibility = 'unspecified';
  }

  // Consistency: a verified gender restriction IS a restriction. (Post-hoc rule: added after the
  // held-out v1 run showed "Lari khusus perempuan" returned as genderFocus=women + open_to_public.)
  if (insight.genderFocus !== 'all' && GENDER_CUE.test(source) && insight.eligibility !== 'restricted') {
    actions.push(`eligibility ${insight.eligibility} -> restricted: verified gender restriction`);
    insight.eligibility = 'restricted';
  }

  if (insight.genderFocus !== 'all' && !GENDER_CUE.test(source)) {
    actions.push(`genderFocus ${insight.genderFocus} -> all: no gender-restriction wording in the post`);
    insight.genderFocus = 'all';
  }

  return { insight, actions };
}
