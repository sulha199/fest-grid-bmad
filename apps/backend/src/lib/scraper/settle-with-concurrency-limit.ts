/**
 * `Promise.allSettled(items.map(fn))` with at most `limit` calls in flight. Results keep the input
 * order and a rejection is captured, never thrown, exactly as `allSettled` reports it.
 *
 * The daily batch fires one vendor trigger per target; Apify caps the memory an account may run at
 * once, so firing them all together gets most of them refused (402 `actor-memory-limit-exceeded`).
 */
export async function settleWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
