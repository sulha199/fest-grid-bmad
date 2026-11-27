// POC prototype of `detectRegistrationPhones` (handoff section 7B.1). Pure, no I/O. Throwaway: it would move to
// packages/domain (100% covered) if the slice ships. Never returns a name; the caller never sees the caption window.
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type PhoneRole = 'reg' | 'cp' | 'unknown';
export interface DetectedPhone {
  e164: string;
  role: PhoneRole;
  source: 'text' | 'wa-link';
  /** The cue word that decided the role (lower-cased), null for "unknown". Never a name or a number. */
  cue: string | null;
}
export interface DetectOptions {
  /** Drop numbers with no cue word in reach (default true). false = report them as role "unknown". */
  requireCue?: boolean;
  /** Suppress everything in a post-event recap caption (default true). */
  suppressRecap?: boolean;
  region?: 'ID';
}

const INVISIBLE = /[​-‏⁠-⁤﻿­]/g;
const DASHES = /[‐-―−]/g;

// Word-ish boundary that also works next to emoji and punctuation.
const B = String.raw`(?<![\p{L}\p{N}_])`;
const E = String.raw`(?![\p{L}\p{N}_])`;
const word = (alts: string) => new RegExp(`${B}(?:${alts})${E}`, 'iu');

const REG_CUE = word(
  'daftar|pendaftaran|mendaftar|daftarkan|registrasi|register|registration|reservasi|reserv|reservation|reservations|reserve|booking|book|rsvp|order|pesan|pemesanan|tiket|ticket'
);
const CP_CUE = word(
  'cp|c\\.p|contact|kontak|narahubung|hubungi|admin|info|informasi|information|konfirmasi|wa|whatsapp|watsap|wassap|telp|tlp|telepon|call|hotline|customer care|chat'
);
const NEG_CUE = word(
  'rek|rekening|bank|bca|bri|bni|bsi|mandiri|cimb|seabank|jago|gopay|ovo|dana|shopeepay|linkaja|qris|payment|pembayaran|transfer|a\\/n|atas nama|saluran|channel|grup|group|donasi|infaq|infak|sedekah|support kegiatan|sponsor|sponsorship|collaborate|kolaborasi|partnership|kerjasama|kerja sama'
);
// A post-event recap carries at least two DISTINCT recap cues ("dokumentasi" alone is a service an organizer offers).
const RECAP_CUES = [
  /terima kasih (?:kepada|atas)/iu,
  /selamat kepada (?:para )?pemenang/iu,
  /dokumentasi (?:acara|lomba|kegiatan|event)/iu,
  /telah (?:selesai|berlangsung)/iu,
  /hari terakhir/iu,
  /kemarin/iu,
];
const isRecap = (t: string) => RECAP_CUES.filter((r) => r.test(t)).length >= 2;

// Indonesian mobile: (+62 | 62 | 0) 8xx then 6-11 more digits; optional space/dash/dot/paren between digits, and
// optionally a space or dash right after the country code ("+62 857-...").
const PHONE_RE = /(?<![\p{L}\p{N}_+])(?:\(?\+?[ ]?62\)?[ \-.]?|0)8\d(?:[ \-.()]?\d){6,11}(?!\d)/gu;
// wa.me/<digits> (also api.whatsapp.com/send?phone=<digits>). Group invites (chat.whatsapp.com) never match.
const WA_LINK_RE = /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send\/?\?phone=|web\.whatsapp\.com\/send\?phone=)[/]*([+\d][\d \-.+]{6,22})/giu;
const URL_LIKE = /(?:https?:\/\/\S+|(?<![\w-])(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|bit\.ly|linktr\.ee|forms\.gle|lynk\.id)\S*|(?<![\w-])[\w-]+\.(?:com|id|co\.id|net|org|ac\.id|sch\.id)\S*)/giu;

export function normalizeCaption(raw: string): string {
  return raw.normalize('NFKC').replace(INVISIBLE, '').replace(DASHES, '-');
}

function toE164(raw: string, region: 'ID'): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  const candidate = digits.startsWith('+') ? digits : digits.startsWith('0') ? digits : `+${digits}`;
  const parsed = parsePhoneNumberFromString(candidate, region);
  if (!parsed || !parsed.isValid()) return null;
  if (parsed.getType() !== 'MOBILE') return null; // mobile only: no landlines, no premium/toll-free
  return parsed.number; // E.164
}

const stripUrls = (l: string) => l.replace(URL_LIKE, ' ');

interface Ctx { local: string; prevLines: string[]; prefixLen: number; }
/** Local window = up to 70 chars before and 25 after the number on its own line; plus up to 3 earlier non-empty lines. */
function contextAt(text: string, start: number, end: number): Ctx {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = text.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const before = text.slice(Math.max(lineStart, start - 70), start);
  const after = text.slice(end, Math.min(lineEnd, end + 25));
  const prefixLen = text.slice(lineStart, start).trim().length;
  const earlier = text.slice(0, Math.max(0, lineStart - 1)).split('\n');
  const prevLines: string[] = [];
  for (let i = earlier.length - 1; i >= 0 && prevLines.length < 3; i--) {
    const l = stripUrls(earlier[i]).trim();
    if (l) prevLines.push(l.slice(0, 120));
  }
  return { local: stripUrls(`${before} ${after}`), prevLines, prefixLen };
}

function readCues(l: string) {
  return { reg: REG_CUE.exec(l), cp: CP_CUE.exec(l), neg: NEG_CUE.exec(l) };
}

/** Decide a role from the cues around one number. Returns null when it should be dropped (payment, channel). */
function decide(ctx: Ctx): { role: PhoneRole; cue: string | null } | null {
  // Nearest evidence wins: the local window first; earlier lines only when the local window has no cue at all, or
  // the number starts its own line (a label such as "Contact Person:" sits on the line above).
  const lines = [ctx.local];
  const local = readCues(ctx.local);
  if (ctx.prefixLen < 8 && ctx.prevLines[0] && ctx.prevLines[0].length <= 40) {
    const h = readCues(ctx.prevLines[0]);
    if (h.neg && !h.reg) return null; // "Konfirmasi Donasi" / "Join Saluran WhatsApp" heading above the number
  }
  if ((!local.reg && !local.cp && !local.neg) || ctx.prefixLen < 3) lines.push(...ctx.prevLines);
  for (const l of lines) {
    const { reg, cp, neg } = readCues(l);
    if (!reg && !cp && !neg) continue;
    if (neg && !reg) return null; // payment wallet / bank / channel / donation
    if (reg) return { role: 'reg', cue: reg[0].toLowerCase() };
    return { role: 'cp', cue: cp![0].toLowerCase() };
  }
  return { role: 'unknown', cue: null };
}

const RANK: Record<PhoneRole, number> = { reg: 2, cp: 1, unknown: 0 };

export function detectRegistrationPhones(caption: string, opts: DetectOptions = {}): DetectedPhone[] {
  const { requireCue = true, suppressRecap = true, region = 'ID' } = opts;
  const text = normalizeCaption(caption);
  if (suppressRecap && isRecap(text)) return [];

  const found = new Map<string, DetectedPhone>();
  const keep = (e164: string, d: { role: PhoneRole; cue: string | null }, source: DetectedPhone['source']) => {
    if (d.role === 'unknown' && requireCue) return;
    const prev = found.get(e164);
    if (!prev || RANK[d.role] > RANK[prev.role]) {
      found.set(e164, { e164, role: d.role, cue: d.cue, source: prev?.source === 'wa-link' ? 'wa-link' : source });
    }
  };

  const waSpans: Array<[number, number]> = [];
  for (const m of text.matchAll(WA_LINK_RE)) {
    waSpans.push([m.index!, m.index! + m[0].length]);
    const e164 = toE164(m[1], region);
    if (!e164) continue;
    const d = decide(contextAt(text, m.index!, m.index! + m[0].length));
    if (d === null) continue;
    // A wa.me link is a WhatsApp contact by construction: at least "cp", even with no cue word around it.
    keep(e164, d.role === 'unknown' ? { role: 'cp', cue: 'wa.me' } : d, 'wa-link');
  }
  for (const m of text.matchAll(PHONE_RE)) {
    if (waSpans.some(([a, b]) => m.index! >= a && m.index! < b)) continue; // already handled as a wa.me link
    const e164 = toE164(m[0], region);
    if (!e164) continue;
    const d = decide(contextAt(text, m.index!, m.index! + m[0].length));
    if (d === null) continue;
    keep(e164, d, 'text');
  }
  return [...found.values()];
}

/** Redaction for logs and reports: keeps the country code and length, hides every other digit. */
export function maskE164(e164: string): string {
  return `+62${'x'.repeat(Math.max(0, e164.length - 3))}`;
}
