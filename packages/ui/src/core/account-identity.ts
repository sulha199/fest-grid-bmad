/**
 * Shared fallback-label chain for account identity text, used by
 * `AccountAvatar` (alt text) and `SubscribedAccountCard` (primary label).
 *
 * Resolution order: `displayName` if present, otherwise `@{username}` if
 * `username` is present, otherwise the caller-supplied terminal `fallback`.
 * Each caller supplies its own `fallback` rather than a single shared
 * hardcoded string, since `AccountAvatar`'s alt-text default ("User avatar")
 * and `SubscribedAccountCard`'s visible-label default ("Unknown account")
 * are deliberately different strings for different purposes.
 */
export function getAccountIdentityLabel(
  displayName: string | null | undefined,
  username: string | null | undefined,
  fallback: string
): string {
  return displayName || (username ? `@${username}` : fallback);
}
