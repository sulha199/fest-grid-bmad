/**
 * POC (pure, no I/O): do two ways of writing an audience area name the SAME area? Used by the scorer, because the labeller writes
 * `target_area_name` as free text ("Jogja") and the model reports its own wording ("DIY"); string equality would call that a miss.
 *
 * Names are resolved through the gazetteer (widest level for an ambiguous name, as everywhere else); keys nested inside another key of the same
 * set collapse to the container, so "Sleman" next to "DIY" is just "DIY". A name the gazetteer does not know falls back to its normalised text.
 * An empty list, "none" and a blank all mean "no area".
 */
import { buildIndex, normalizeAreaName, resolveAreas, SAMPLE_GAZETTEER, type GazetteerIndex } from './area-resolver.js';

const NONE = 'none';
const defaultIndex = buildIndex(SAMPLE_GAZETTEER);

/** A canonical string for a set of area names: sorted gazetteer keys (nested ones collapsed), then unresolved normalised names. `none` if empty. */
export function areaCanon(names: readonly string[], ix: GazetteerIndex = defaultIndex): string {
  const keys = new Set<string>();
  const unresolved = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name.toLowerCase() === NONE) continue;
    for (const r of resolveAreas(name, ix, 'widest')) {
      if (r.ok) for (const k of r.area.keys) keys.add(k);
      else if (r.reason === 'not-in-gazetteer') { const n = normalizeAreaName(name); if (n) unresolved.add(n); }
    }
  }
  const all = [...keys];
  const collapsed = all.filter((k) => !all.some((o) => o !== k && ix.pathOf(k).includes(o)));
  const parts = [...collapsed.sort(), ...[...unresolved].sort().map((u) => `?${u}`)];
  return parts.length ? parts.join('|') : NONE;
}

/** Whether the labeller's name and the model's names denote the same area. */
export function areaNamesAgree(labelName: string, modelNames: readonly string[], ix: GazetteerIndex = defaultIndex): boolean {
  return areaCanon([labelName], ix) === areaCanon(modelNames, ix);
}
