/**
 * IDEA-110 -- one place written two ways. The same posting account lists one event twice and spells
 * its venue differently ("Atrium Rama, Ground Floor, X Hall" and "Atrium Rama, Lantai GF, X Hall";
 * "Lap. Danyang" and "Lapangan Danyang"), and an exact-text comparison calls them two places. This is
 * the tolerant comparison the dedup rules use: pure, text only, no geocoder.
 *
 * Two texts are the same place when their *place tokens* are equal, or the smaller set sits inside
 * the larger and holds at least `MIN_TOKENS_FOR_CONTAINMENT` tokens. The tokens are lowercase letters
 * and digits with accents folded, common abbreviations spelled out, and the words that say where
 * INSIDE a place ("ground floor", "lantai 3", "GF") dropped, because they never say which place.
 * City and country names are kept: "Mall Jogja" must not be the same place as "Other Mall Jogja".
 * A shorter containment ("Pakuwon Mall" inside "Pakuwon Mall Jogja") is deliberately not enough here:
 * with two tokens the extra word is more often the distinctive one than a sub-venue.
 */
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;
const COMBINING_MARKS = /\p{M}/gu;

const ABBREVIATIONS: Record<string, string> = { lap: 'lapangan', gd: 'gedung', jl: 'jalan', lt: 'lantai' };

// Say where inside a place, never which place. A number right after one ("lantai 3") goes with it.
const POSITION_WORDS = new Set(['ground', 'floor', 'lantai', 'gf', 'level', 'lv']);

const CONNECTIVES = new Set(['di', 'dan', 'and', 'the', 'of', 'at', 'in']);

/** The smaller token set must hold at least this many tokens to count as sitting inside the larger. */
export const MIN_TOKENS_FOR_CONTAINMENT = 3;

/** The place tokens of a venue text, as a set. Empty when nothing identifies a place. */
export function venuePlaceTokens(location: string | null | undefined): Set<string> {
  const words = (location ?? '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .split(' ')
    .filter((word) => word !== '')
    .map((word) => ABBREVIATIONS[word] ?? word);

  const tokens = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (POSITION_WORDS.has(word)) {
      if (/^\d+$/.test(words[i + 1] ?? '')) i++;
      continue;
    }
    if (!CONNECTIVES.has(word)) tokens.add(word);
  }
  return tokens;
}

/**
 * True when two venue texts name the same place under the token rule above. False when either has no
 * place token left (an empty text, or only "ground floor").
 */
export function venueTextsSamePlace(a: string | null | undefined, b: string | null | undefined): boolean {
  const tokensA = venuePlaceTokens(a);
  const tokensB = venuePlaceTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  const [smaller, larger] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  if (![...smaller].every((token) => larger.has(token))) return false;
  return smaller.size === larger.size || smaller.size >= MIN_TOKENS_FOR_CONTAINMENT;
}
