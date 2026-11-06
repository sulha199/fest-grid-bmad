import React from 'react';

export interface EventDetailSkeletonProps {
  /** Accessible name announced while the event loads (usually `labels.loadingText`). */
  label?: string;
}

/**
 * Skeleton for the event-detail view: image on the left, title/meta/description blocks on the right.
 *
 * Single source of truth for the event-detail loading shape. `EventDetailView`'s own `loading` state
 * and the intercepted event modal's route-level loading boundary both render this, so the two can
 * never drift apart (project-context.md, "Keep Skeletons in Sync With Their Real Component"). When
 * `EventDetailView`'s layout changes (grid columns, image sizing), change it here too.
 */
export const EventDetailSkeleton: React.FC<EventDetailSkeletonProps> = ({ label }) => (
  <div className="animate-pulse flex flex-col gap-6" aria-busy="true" aria-label={label}>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
      {/* Left Column: Image Skeleton */}
      <div className="lg:col-span-3 min-w-0">
        <div className="w-full aspect-video max-h-[70vh] bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
      </div>

      {/* Right Column: Content Skeleton */}
      <div className="lg:col-span-2 min-w-0 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-20"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
        </div>
        <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      </div>
    </div>
  </div>
);
