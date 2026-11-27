// POC: title-based schedule-stage classifier (the code-side fallback and backfill rule). Pure function, no I/O.
// Order matters: on-site re-registration and check-in rows are preparation, not registration.
export const STAGE_RULES = [
  ['preparation', /(registrasi ulang|daftar ulang|re-?registration|check-?in|penukaran|redeem|technical meeting|\btm\b|race ?pack|pengambilan|gladi|rehearsal|load[- ]?in|briefing|manager meeting|congress)/i],
  ['registration', /(pendaftaran|registrasi|registration|\bdaftar\b|register|early ?bird|presale|pre-?sale|penjualan tiket|ticket ?sale|tiket (dibuka|on ?sale)|open recruitment|\bbatch\b|gelombang)/i],
  ['submission', /(pengumpulan|pengiriman|submission|submit|batas (akhir )?(kirim|pengumpulan)|open call|call for)/i],
  ['announcement', /(pengumuman|announcement|announce|hasil seleksi|winner announcement|line-?up reveal)/i],
  ['qualification', /(penyisihan|kualifikasi|seleksi|audisi|kurasi|babak|\bheat\b|semi ?final|qualif|preliminary|group stage|fase grup)/i],
  ['supporting', /(workshop|talk ?show|pre-?event|side event|bazaar|closing night|malam puncak)/i],
];
export function classifyStage(title) {
  const t = String(title ?? '');
  for (const [stage, re] of STAGE_RULES) if (re.test(t)) return stage;
  return 'event';
}
