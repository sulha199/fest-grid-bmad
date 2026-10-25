/**
 * The fire time of an EventBridge scheduled invocation, or undefined for anything else (an empty
 * manual `{}` invoke, a hand-built test event, a payload whose `time` is not a valid timestamp).
 *
 * The daily rule (`ScraperScheduleRule`, `rate(1 day)`) delivers the stock scheduled-event envelope
 * -- `{ source: 'aws.events', 'detail-type': 'Scheduled Event', time: '<ISO>' , ... }` -- and a
 * duplicate delivery or Lambda async retry of one cycle carries the same `time`.
 */
export function getScheduledCycleTime(event: unknown): Date | undefined {
  if (typeof event !== 'object' || event === null) return undefined;
  const e = event as Record<string, unknown>;
  if (e.source !== 'aws.events' || e['detail-type'] !== 'Scheduled Event') return undefined;
  if (typeof e.time !== 'string') return undefined;
  const time = new Date(e.time);
  return Number.isNaN(time.getTime()) ? undefined : time;
}
