// POC: choose a cover slide per event from the slide-to-events map of one carousel post (the model only says which events each slide shows; code decides).
// Rule: an event takes the slide that shows it with the FEWEST events on it; ties go to the lowest slide number; a slide that shows no event is never chosen.
// With `maxEventsOnSlide: 1` (default) the slide must be dedicated to that event, else the event keeps the post cover (null).
//   decideCovers(slides, eventNames, { maxEventsOnSlide }) -> [{ event, slide|null, eventsOnSlide, candidates }]
export function decideCovers(slides, eventNames, opts = {}) {
  const maxEventsOnSlide = opts.maxEventsOnSlide ?? 1;
  const names = eventNames ?? [];
  const per = new Map();
  for (const s of slides ?? []) {
    const n = Number(s?.slide);
    if (!Number.isInteger(n) || n < 1) continue;
    const evs = [...new Set((s.events ?? []).filter((e) => names.includes(e)))];
    per.set(n, [...new Set([...(per.get(n) ?? []), ...evs])]);
  }
  return names.map((event) => {
    const cands = [...per.entries()].filter(([, evs]) => evs.includes(event)).map(([slide, evs]) => ({ slide, count: evs.length })).sort((a, b) => a.count - b.count || a.slide - b.slide);
    const best = cands[0];
    const ok = best && best.count <= maxEventsOnSlide;
    return { event, slide: ok ? best.slide : null, eventsOnSlide: best?.count ?? 0, candidates: cands.length };
  });
}
