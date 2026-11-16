/**
 * One transient-failure rule for every vendor client (FIND-082 "Story 0.i2d review deferrals: triplicated transient-error
 * classifier"): a 5xx status, or a network-level error code, is worth one retry; everything else (a 4xx, a refusal, an
 * unknown error) is not. Never a default-transient fallback.
 *
 * Each client keeps its own error-class checks (what is an Apify, Bright Data or Gemini API error is a vendor-SDK question)
 * and only extracts `statusCode` and `code` for this function. Pure.
 */
const TRANSIENT_CONNECTION_CODES: ReadonlySet<string> = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]);

export function isTransientVendorFailure(input: { statusCode?: unknown; code?: unknown }): boolean {
  const { statusCode, code } = input;
  if (typeof statusCode === "number" && statusCode >= 500 && statusCode <= 599) {
    return true;
  }
  return typeof code === "string" && TRANSIENT_CONNECTION_CODES.has(code);
}
