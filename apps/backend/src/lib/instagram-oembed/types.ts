// Shared between adapter.ts and cache-store.ts to avoid a circular import.
export type InstagramOEmbedAdapterResult =
  | { status: 'AVAILABLE'; html: string }
  | { status: 'UNAVAILABLE' };
