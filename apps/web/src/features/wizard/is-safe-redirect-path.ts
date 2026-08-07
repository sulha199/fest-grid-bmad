/**
 * Validates that a redirect path is a safe, same-origin relative path.
 * This guards against open-redirect security vulnerabilities.
 * A path is safe if it starts with a single '/' (not '//') and contains no '://' protocol indicator.
 */
export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}
