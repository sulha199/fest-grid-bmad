export interface ResolveServedImageUrlInput {
  imageUrl: string | null | undefined;
  durableImageUrl: string | null | undefined;
  durableThumbnailUrl?: string | null | undefined;
  imageUrlExpiresAt: Date | null | undefined;
  isImageStorageOptedIn: boolean;
  now?: Date;
}

export function resolveServedImageUrl({
  imageUrl,
  durableImageUrl,
  durableThumbnailUrl = null,
  imageUrlExpiresAt,
  isImageStorageOptedIn,
  now = new Date(),
}: ResolveServedImageUrlInput): string | null {
  const isOriginalStillValid = imageUrlExpiresAt != null && now < imageUrlExpiresAt;
  if (isOriginalStillValid && imageUrl) {
    return imageUrl;
  }
  if (isImageStorageOptedIn) {
    return durableImageUrl || imageUrl || null;
  }
  return durableThumbnailUrl || null;
}
