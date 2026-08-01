"use client";

import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export interface EventImageProps {
  imageUrl?: string | null;
  imageAlt?: string | null;
  eventName: string;
}

export const EventImage: React.FC<EventImageProps> = ({ imageUrl, imageAlt, eventName }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="w-full relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={imageAlt || eventName}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-400">
          <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
        </div>
      )}
    </div>
  );
};
