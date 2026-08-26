export interface ResolveServedImageUrlInput {
  imageUrl: string | null | undefined;
  durableImageUrl: string | null | undefined;
  imageUrlExpiresAt: Date | null | undefined;
  now?: Date;
}

export function resolveServedImageUrl({
  imageUrl,
  durableImageUrl,
  imageUrlExpiresAt,
  now = new Date(),
}: ResolveServedImageUrlInput): string | null {
  const isOriginalStillValid = imageUrlExpiresAt != null && now < imageUrlExpiresAt;
  if (isOriginalStillValid && imageUrl) {
    return imageUrl;
  }
  return durableImageUrl || imageUrl || null;
}
