"use client";

import React, { useState } from 'react';
import { Image as ImageIcon, AlertCircle, ExternalLink } from 'lucide-react';

export interface EventImageProps {
  imageUrl?: string | null;
  imageAlt?: string | null;
  eventName: string;
  videoUrl?: string | null;
  videoAlt?: string | null;
  imageFallbackUrl?: string | null;
  originalPostUrl?: string | null;
  sourcePostUrl?: string | null;
  videoUnavailableLabel?: string | null;
  viewOriginalPostLabel?: string | null;
  viewSourceLabel?: string | null;
}

export const EventImage: React.FC<EventImageProps> = ({
  imageUrl,
  imageAlt,
  eventName,
  videoUrl,
  videoAlt,
  imageFallbackUrl,
  originalPostUrl,
  sourcePostUrl,
  videoUnavailableLabel,
  viewOriginalPostLabel,
  viewSourceLabel,
}) => {
  const [imageError, setImageError] = useState(false);
  const [currentImgSrc, setCurrentImgSrc] = useState<string | null | undefined>(imageUrl);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);

  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Sync state if imageUrl or videoUrl changes
  React.useEffect(() => {
    setCurrentImgSrc(imageUrl);
    setHasTriedFallback(false);
    setImageError(false);
  }, [imageUrl]);

  React.useEffect(() => {
    setVideoReady(false);
    setVideoError(false);
  }, [videoUrl]);

  const handleImageError = () => {
    if (imageFallbackUrl && !hasTriedFallback) {
      setHasTriedFallback(true);
      setCurrentImgSrc(imageFallbackUrl);
    } else {
      setImageError(true);
    }
  };

  const showVideo = !!(videoUrl && !videoError);
  const targetLink = originalPostUrl || sourcePostUrl;
  const targetLinkLabel = originalPostUrl
    ? (viewOriginalPostLabel || 'View original post')
    : (viewSourceLabel || 'View source');
  const showVideoErrorNote = !!(videoError && targetLink);

  const mediaContent = (
    <div className="w-full relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
      {showVideo && (
        <video
          src={videoUrl || undefined}
          aria-label={videoAlt || `Video of ${eventName}`}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoReady(true)}
          onLoadedData={() => setVideoReady(true)}
          onError={() => setVideoError(true)}
          className="w-full h-full object-cover"
          data-testid="event-video"
        />
      )}

      {/* Render poster image if we are not showing video, or if video is not ready yet */}
      {(!showVideo || !videoReady) && currentImgSrc && !imageError && (
        <img
          src={currentImgSrc}
          alt={imageAlt || eventName}
          onError={handleImageError}
          className={`${showVideo ? 'absolute inset-0' : ''} w-full h-full object-cover`}
        />
      )}

      {/* Render placeholder icon if we have no video and (no image src or image errored) */}
      {(!showVideo || (showVideo && videoReady && imageError)) && (!currentImgSrc || imageError) && (
        <div className="flex flex-col items-center justify-center text-gray-400">
          <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
        </div>
      )}
    </div>
  );

  if (!showVideoErrorNote) {
    return mediaContent;
  }

  return (
    <div className="w-full flex flex-col gap-2">
      {mediaContent}
      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5" data-testid="video-unavailable-note">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
        <span>
          {videoUnavailableLabel || "This video isn't available — view it on the original post"}
        </span>
        <a
          href={targetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
        >
          <span>{targetLinkLabel}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
