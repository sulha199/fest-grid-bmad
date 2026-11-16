/**
 * Inputs for {@link buildLocationSearchQuery}.
 *
 * `keywords` are place-name keywords ordered specific to general (e.g.
 * `["Pasar Porosjayan", "Gamping", "Sleman"]`). `name` is the display name used
 * when there are no keywords. `city` is only used for an account default
 * location, which has no keywords (geocoded place name plus city).
 */
export interface LocationSearchQueryInput {
  keywords?: readonly string[] | null;
  name?: string | null;
  city?: string | null;
}

/**
 * Builds the text a map search link should query. Never uses coordinates:
 * keywords joined with a space, else the display name; the optional city is
 * appended to the name (not to keywords) unless the name already contains it.
 * Returns an empty string when there is nothing to search for.
 */
export function buildLocationSearchQuery({ keywords, name, city }: LocationSearchQueryInput): string {
  const cleanKeywords = (keywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (cleanKeywords.length > 0) {
    return cleanKeywords.join(' ');
  }
  const cleanName = (name ?? '').trim();
  const cleanCity = (city ?? '').trim();
  if (cleanName && cleanCity && !cleanName.toLowerCase().includes(cleanCity.toLowerCase())) {
    return `${cleanName} ${cleanCity}`;
  }
  return cleanName || cleanCity;
}
