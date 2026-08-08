export function parseSocialMediaAccountHandle(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith('http')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      trimmed = segments[segments.length - 1] || '';
    } catch {
      const segments = trimmed.split('/').filter(Boolean);
      trimmed = segments[segments.length - 1] || trimmed;
    }
  }
  if (trimmed.startsWith('@')) {
    trimmed = trimmed.slice(1);
  }
  return trimmed;
}
