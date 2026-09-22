/** Import-time side-effect registration: importing this module registers every example manifest
 * entry into `defaultRegistry` (mirrors `packages/graphql-select`'s own flat-module-per-concern
 * style; there is no dynamic directory scan since the registry rejects duplicates explicitly). */
import './event-card-masonry-thumbnail-fallback.js';
import './masonry-column-width-invariant.js';

export { entry as eventCardMasonryThumbnailFallback } from './event-card-masonry-thumbnail-fallback.js';
export { entry as masonryColumnWidthInvariant } from './masonry-column-width-invariant.js';
