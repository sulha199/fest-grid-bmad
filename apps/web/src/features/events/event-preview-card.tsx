"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"

interface EventPreviewCardProps {
  imageUrl?: string | null
  imageAlt: string
  className?: string
}

/**
 * A decorative, non-interactive "peek" preview shown on the adjacent Carousel
 * slides in EventDetailWrapper. Only the image is real (already loaded via the
 * list-navigation hook's target item, no extra fetch); everything else mirrors
 * EventDetailView's own `loading`-skeleton proportions (packages/ui/src/features/
 * events/EventDetailView.tsx) — not a smaller/generic shape — so the active and
 * peek slides don't visibly jump in size while swiping. Title/tags/schedules are
 * always skeleton placeholders, never real text, since this slide's full data is
 * intentionally not fetched unless/until it becomes the current slide.
 */
export const EventPreviewCard: React.FC<EventPreviewCardProps> = ({ imageUrl, imageAlt, className }) => {
  const [imgError, setImgError] = useState(false)

  return (
    <div aria-hidden="true" className={cn("animate-pulse flex flex-col gap-6", className)}>
      {/* Mirrors EventDetailView's "Header controls" row (favorite/add-to-calendar/more-actions
          icon buttons, right-aligned above the image) — EventDetailView's own loading skeleton
          omits this row entirely, but the populated view always reserves the space, so a peek
          card without it still shifts size once it becomes the real current slide. */}
      <div className="flex justify-end gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
      {/* Same aspect-video sizing as EventImage (packages/ui/src/features/events/EventImage.tsx),
          the real component this peek image is replaced by once the slide becomes current —
          keeps the swap from causing a visible resize. */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
        {!imgError && imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-20" />
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-24" />
      </div>
      <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded w-full" />
    </div>
  )
}
