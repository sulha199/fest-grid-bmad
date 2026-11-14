/**
 * Story 10.4 Part B -- the one place that maps a refused or failed job start onto what the UI does. Every start point
 * (retry here, Subscribe in 10.7, Re-extract in 10.6a, ...) calls it, so none re-invents it (FR121, FR122, FR120).
 *
 * Accepts a start RESULT (`errorCode` plus the numbers, as `RetryJobResult` and the old `previewPostReextraction` carry)
 * or a thrown GraphQL error whose `extensions` carry `code` and the same numbers.
 */
export type JobStartFailure =
  | { kind: 'queue-full'; maxQueued: number | null }
  | { kind: 'cap'; activeCount: number; reservedCount: number; cap: number }
  | { kind: 'cooldown'; retryNotBefore: string | null }
  | { kind: 'generic' };

interface RawStartError {
  errorCode?: string | null;
  code?: string | null;
  activeCount?: number | null;
  reservedCount?: number | null;
  cap?: number | null;
  maxQueued?: number | null;
  retryNotBefore?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function extractRaw(input: unknown): RawStartError {
  if (!isRecord(input)) return {};
  // graphql-request ClientError: response.errors[0].extensions
  const response = input.response;
  if (isRecord(response) && Array.isArray(response.errors) && isRecord(response.errors[0]) && isRecord(response.errors[0].extensions)) {
    return response.errors[0].extensions as RawStartError;
  }
  if (isRecord(input.extensions)) return input.extensions as RawStartError;
  return input as RawStartError;
}

export function mapJobStartError(input: unknown): JobStartFailure {
  const raw = extractRaw(input);
  const code = raw.errorCode ?? raw.code ?? null;
  if (code === 'JOB_QUEUE_FULL') return { kind: 'queue-full', maxQueued: typeof raw.maxQueued === 'number' ? raw.maxQueued : null };
  if (code === 'SUBSCRIPTION_CAP_REACHED' && typeof raw.cap === 'number') {
    return { kind: 'cap', activeCount: raw.activeCount ?? 0, reservedCount: raw.reservedCount ?? 0, cap: raw.cap };
  }
  if (code === 'COOLDOWN') return { kind: 'cooldown', retryNotBefore: raw.retryNotBefore ? String(raw.retryNotBefore) : null };
  return { kind: 'generic' };
}
