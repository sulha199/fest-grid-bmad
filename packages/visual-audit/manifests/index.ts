/** Import-time side-effect registration: importing this module registers every example manifest
 * entry into `defaultRegistry` (mirrors `packages/graphql-select`'s own flat-module-per-concern
 * style; there is no dynamic directory scan since the registry rejects duplicates explicitly). */
import './event-card-masonry-thumbnail-fallback.js';
import './masonry-column-width-invariant.js';
import './count-badge-react-mount.js';
import './event-card-date-box-react-mount.js';
import './event-card-date-box-sizing.js';
import './grid-container-masonry.js';

export { entry as eventCardMasonryThumbnailFallback } from './event-card-masonry-thumbnail-fallback.js';
export { entry as masonryColumnWidthInvariant } from './masonry-column-width-invariant.js';
export { entry as countBadgeReactMount } from './count-badge-react-mount.js';
export { entry as eventCardDateBoxReactMount } from './event-card-date-box-react-mount.js';
// BUG-047: `event-card-date-box-overflow.ts` (Story 1.i1n/BUG-040's word/time-content overflow
// proof) is deleted — its motivating scenario (`EventCardDateBox`'s `dayVariant='word'` sizing)
// is dead code now that no content source ever produces word/time content (AC-DATE-1). Replaced
// by `event-card-date-box-sizing.ts`'s two entries below (AC-DATE-4/5, added during BUG-047's own
// code review after the width/height fixes were found to be under-guarded).
export { widthEntry as eventCardDateBoxWidthConsistency, heightEntry as eventCardDateBoxHeightMatchesThumbnail } from './event-card-date-box-sizing.js';
export { entry as gridContainerMasonry } from './grid-container-masonry.js';
