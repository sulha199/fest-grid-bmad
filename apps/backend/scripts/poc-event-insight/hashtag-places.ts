/**
 * POC (pure, no I/O): places named by a post's hashtags. Done by CODE, not by the model (owner decision, 2026-10-27).
 *
 * A hashtag counts only when it is a plain place tag (`#jogja`) or a place plus a generic word (`#eventjogja`, `#kulinerjogja`, `#jogjaevent`).
 * A compound brand or origin tag is ignored: in prod, 18 of 3,135 posts named a different city in a hashtag and the ones read were product or
 * band origins (`#bandungcheesecuit` on a Jogja mall post, `#sanubarimalang` on a Jogja Expo Center post), not audiences.
 *
 * It is the weakest signal. `deriveTargetAreas` uses it only when the venue and the account give nothing, and a country-level tag
 * (`#indonesia`) is dropped as soon as anything else exists.
 */
import { normalizeAreaName, resolveArea, type GazetteerIndex } from './area-resolver.js';

/** Generic words that may prefix or suffix a place in a hashtag. Edit with the owner's agreement. */
export const GENERIC_TAG_WORDS: readonly string[] = [
  'event', 'events', 'info', 'infoevent', 'agenda', 'jadwal', 'kuliner', 'wisata', 'kajian', 'komunitas', 'lari', 'konser', 'pameran',
  'festival', 'bazar', 'musik', 'seni', 'budaya', 'ngopi', 'nongkrong', 'update', 'terkini', 'hits', 'viral', 'daily', 'city',
];

const MIN_ALIAS_LENGTH = 3;

const compactCache = new WeakMap<GazetteerIndex, Map<string, string>>();

const compact = (s: string): string => normalizeAreaName(s).replace(/[\s-]+/g, '');

/** compact alias (no spaces or hyphens) -> an alias string `resolveArea` understands. Built once per index. */
function compactAliases(ix: GazetteerIndex): Map<string, string> {
  const cached = compactCache.get(ix);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const alias of [...ix.byAlias.keys(), ...ix.aggByAlias.keys()]) {
    const c = compact(alias);
    if (c.length >= MIN_ALIAS_LENGTH && !map.has(c)) map.set(c, alias);
  }
  compactCache.set(ix, map);
  return map;
}

const cleanTag = (tag: string): string =>
  tag.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^#+/, '').replace(/[^a-z0-9]/g, '');

export interface HashtagPlaces {
  /** Gazetteer keys named by accepted tags (a tie such as Kota/Kabupaten Bandung yields both). */
  keys: string[];
  /** Tags accepted, as written. */
  used: string[];
  /** Tags ignored (no place, or a compound brand/origin tag). */
  ignored: string[];
}

export function placesFromHashtags(tags: readonly string[], ix: GazetteerIndex): HashtagPlaces {
  const aliases = compactAliases(ix);
  const keys: string[] = [];
  const used: string[] = [];
  const ignored: string[] = [];

  for (const raw of tags) {
    const t = cleanTag(raw);
    if (!t) continue;
    const candidates = new Set<string>([t]);
    for (const g of GENERIC_TAG_WORDS) {
      if (t.startsWith(g) && t.length > g.length) candidates.add(t.slice(g.length));
      if (t.endsWith(g) && t.length > g.length) candidates.add(t.slice(0, t.length - g.length));
    }
    let resolvedKeys: string[] | undefined;
    for (const c of candidates) {
      const alias = aliases.get(c);
      if (!alias) continue;
      const r = resolveArea(alias, ix, 'widest');
      if (r.ok) { resolvedKeys = r.area.keys; break; }
    }
    if (resolvedKeys) {
      used.push(raw);
      for (const k of resolvedKeys) if (!keys.includes(k)) keys.push(k);
    } else {
      ignored.push(raw);
    }
  }
  return { keys, used, ignored };
}
