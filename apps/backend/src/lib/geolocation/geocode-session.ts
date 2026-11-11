/**
 * A request-scoped geocoding session (slice 2a of the location keywords): one memo of lookups and one budget of uncached geocoder
 * calls, shared by everything one request geocodes. Created by the caller (an Apply, an extraction) and passed down, so the same
 * place used by many events or schedules is looked up once, and a request that geocodes many distinct places stays inside its time
 * limit (the moderator re-extract Apply runs in the 28 s API Lambda).
 */

/** The request's budget of uncached geocoder calls is spent; the lookup was refused (it is not "not found" and is not cached). */
export class GeocodeBudgetExhaustedError extends Error {
  constructor(budget: number) {
    super(`The request's geocode budget (${budget} uncached lookups) is spent`);
    this.name = 'GeocodeBudgetExhaustedError';
  }
}

export interface GeocodeSession {
  /** Runs `lookup` once per key: a repeat, also while the first is still in flight, shares its result (or its failure). */
  memo<T>(key: string, lookup: () => Promise<T>): Promise<T>;
  /** Counts one uncached geocoder call; throws `GeocodeBudgetExhaustedError` once the budget is spent. No budget = never throws. */
  spend(): void;
  readonly budget: number | undefined;
  readonly spent: number;
}

export function createGeocodeSession(options?: { budget?: number }): GeocodeSession {
  const memoized = new Map<string, Promise<unknown>>();
  const budget = options?.budget;
  let spent = 0;
  let exhaustedLogged = false;
  return {
    memo<T>(key: string, lookup: () => Promise<T>): Promise<T> {
      let existing = memoized.get(key) as Promise<T> | undefined;
      if (!existing) {
        existing = lookup();
        memoized.set(key, existing);
      }
      return existing;
    },
    spend(): void {
      if (budget !== undefined && spent >= budget) {
        if (!exhaustedLogged) {
          exhaustedLogged = true;
          console.warn(`[geocode] geocode-budget-exhausted budget=${budget}: the remaining lookups of this request are skipped`);
        }
        throw new GeocodeBudgetExhaustedError(budget);
      }
      spent++;
    },
    get budget() {
      return budget;
    },
    get spent() {
      return spent;
    },
  };
}
