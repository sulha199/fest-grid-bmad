export interface ResolveServedImageUrlInput {
  imageUrl: string | null | undefined;
  durableImageUrl: string | null | undefined;
  imageUrlExpiresAt: Date | null | undefined;
  isImageStorageOptedIn: boolean;
  now?: Date;
}

export function resolveServedImageUrl({
  imageUrl,
  durableImageUrl,
  imageUrlExpiresAt,
  isImageStorageOptedIn,
  now = new Date(),
}: ResolveServedImageUrlInput): string | null {
  const isOriginalStillValid = imageUrlExpiresAt != null && now < imageUrlExpiresAt;
  if (isOriginalStillValid && imageUrl) {
    return imageUrl;
  }
  if (!isImageStorageOptedIn) {
    return null;
  }
  return durableImageUrl || imageUrl || null;
}
