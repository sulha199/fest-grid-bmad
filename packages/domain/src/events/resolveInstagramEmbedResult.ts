export interface InstagramEmbedAdapterResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  html?: string;
}

export interface ResolveInstagramEmbedResultInput {
  adapterResult: InstagramEmbedAdapterResult | null;
  isImageStorageOptedIn: boolean;
  durableImageUrl: string | null | undefined;
}

export interface InstagramEmbedResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  html: string | null;
  durableImageUrl: string | null;
}

export function resolveInstagramEmbedResult({
  adapterResult,
  isImageStorageOptedIn,
  durableImageUrl,
}: ResolveInstagramEmbedResultInput): InstagramEmbedResult | null {
  if (adapterResult == null) {
    return null;
  }

  if (adapterResult.status === 'AVAILABLE') {
    return { status: 'AVAILABLE', html: adapterResult.html ?? null, durableImageUrl: null };
  }

  if (isImageStorageOptedIn && durableImageUrl) {
    return { status: 'UNAVAILABLE', html: null, durableImageUrl };
  }

  return { status: 'UNAVAILABLE', html: null, durableImageUrl: null };
}
