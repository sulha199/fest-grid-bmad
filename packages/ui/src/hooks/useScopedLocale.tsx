'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Fallback when no ScopedLocaleProvider is present anywhere in the tree.
 * Kept in one place so useScopedLocale() and its doc comments never drift apart.
 */
const DEFAULT_LOCALE = 'en-US';

interface LocaleContextValue {
  locale: string;
  /** IANA timezone (e.g. 'Asia/Jakarta'). Undefined lets Intl fall back to the runtime's default timezone. */
  timezone?: string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export interface ScopedLocaleProviderProps {
  locale: string;
  /** IANA timezone (e.g. 'Asia/Jakarta'). Optional — omit to inherit the nearest ancestor's timezone (if any), or let Intl use the runtime's default. */
  timezone?: string;
  children: ReactNode;
}

/**
 * Scopes a locale (and optional timezone) value to a subtree. Providers may be
 * nested — a component resolves the nearest ancestor ScopedLocaleProvider via
 * useScopedLocale()/useScopedTimezone(), so different subtrees can carry
 * different values. Named distinctly from next-intl's own `useLocale`/
 * `useTimeZone` (different semantics: subtree-scoped with an explicit
 * fallback, no dependency on NextIntlClientProvider) so the two are never
 * mistaken for each other in an app/ file that imports both.
 *
 * A nested provider that omits `timezone` inherits the outer provider's
 * timezone rather than resetting it to "unset" — only an explicitly-passed
 * `timezone` overrides the ambient value.
 */
export function ScopedLocaleProvider({ locale, timezone, children }: ScopedLocaleProviderProps) {
  const parent = useContext(LocaleContext);
  const resolvedTimezone = timezone ?? parent?.timezone;
  return (
    <LocaleContext.Provider value={{ locale, timezone: resolvedTimezone }}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Returns the nearest ancestor ScopedLocaleProvider's locale, or 'en-US' if none is present. */
export function useScopedLocale(): string {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}

/** Returns the nearest ancestor ScopedLocaleProvider's timezone, or undefined (runtime default) if none is present/set. */
export function useScopedTimezone(): string | undefined {
  return useContext(LocaleContext)?.timezone;
}

/**
 * The one place a component resolves "which timezone do I render this schedule/post in":
 * an explicit `timezoneOverride` (a component's own `timezone` prop, ignoring an accidental empty
 * string) beats the nearest ScopedLocaleProvider's timezone, which beats `undefined` (the runtime's
 * own timezone). Call it in the component that formats/compares, instead of receiving an
 * already-resolved value from a parent: a parent that forgets to pass `timezone` down then falls
 * back to the app timezone, not silently to whatever zone the viewer's device happens to be in.
 *
 * A per-event timezone (`Schedule.timezone`) is the intended next link in this chain
 * (override -> event -> ambient); it is deliberately NOT wired yet -- see the product decision on
 * event-local vs viewer-local display.
 */
export function useEventTimezone(timezoneOverride?: string | null): string | undefined {
  const contextTimezone = useScopedTimezone();
  return timezoneOverride || contextTimezone;
}
