/**
 * Decodes a hex-Unix-timestamp query parameter (representing seconds since epoch) from a URL into a Date.
 * Returns null if the URL is invalid, the parameter is missing, has an invalid hex value, or is unparseable.
 *
 * @param url The URL to parse.
 * @param paramName The query parameter containing the hex-Unix-timestamp (defaults to 'oe').
 */
export function parseImageUrlExpiry(
  url: string | null | undefined,
  paramName: string = 'oe'
): Date | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const value = parsedUrl.searchParams.get(paramName);
    if (!value) {
      return null;
    }

    // Check if it's a valid hex string of any non-zero length
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(value)) {
      return null;
    }

    const timestampSeconds = parseInt(value, 16);
    if (isNaN(timestampSeconds)) {
      return null;
    }

    return new Date(timestampSeconds * 1000);
  } catch {
    return null;
  }
}
