/**
 * Lower-case, strip Latin accents and punctuation, collapse spaces. Letters and digits of every script are kept (a name in
 * Thai, Arabic or Chinese must not normalize to '' and then "match" any other such name); combining marks stay so words of
 * scripts that use them are not split.
 */
export function normalizeText(value: string | undefined | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/** "19:00:00" and "19.00" both become "19:00"; anything else is returned normalized as text. */
export function normalizeTime(value: string | undefined | null): string {
  const raw = (value ?? '').trim();
  const match = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/.exec(raw);
  return match ? `${match[1]!.padStart(2, '0')}:${match[2]}` : normalizeText(raw);
}

export function normalizeDate(value: string | undefined | null): string {
  return (value ?? '').trim().slice(0, 10);
}

/** Every token of the label appears in the model text: "Kelapa Gading" is found in "Mall X, Kelapa Gading, Jakarta". */
export function locationMatches(label: string, model: string | undefined | null): boolean {
  const modelTokens = new Set(normalizeText(model).split(' ').filter(Boolean));
  const labelTokens = normalizeText(label).split(' ').filter(Boolean);
  return labelTokens.length > 0 && labelTokens.every((token) => modelTokens.has(token));
}

/** Equal, or one name is the other's whole words ("Turnamen Contoh" in "Turnamen Contoh Cabang 1"); "Fest" is not in "Festival". */
export function nameMatches(label: string, model: string | undefined | null): boolean {
  const a = normalizeText(label);
  const b = normalizeText(model);
  return a !== '' && b !== '' && (a === b || ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `));
}

export function digitsOnly(value: string | undefined | null): string {
  return (value ?? '').replace(/\D+/g, '');
}
